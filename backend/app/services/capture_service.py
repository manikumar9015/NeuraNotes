"""
Capture Service — handles all note ingestion paths.
Validates input, stores in Supabase, triggers chunking + embedding.
"""

from typing import Optional
from uuid import uuid4

from app.db.supabase_client import get_supabase_admin
from app.models.note import ContentType
from app.utils.chunker import chunk_text, estimate_word_count


async def capture_text(
    user_id: str,
    content: str,
    title: Optional[str] = None,
    content_type: ContentType = ContentType.TEXT,
    source_url: Optional[str] = None,
    tags: Optional[list[str]] = None,
    metadata: Optional[dict] = None,
) -> dict:
    """
    Capture a text note: store in DB, chunk it, and queue embedding.
    
    Returns the created note dict.
    """
    supabase = get_supabase_admin()

    # Auto-generate title if not provided
    if not title:
        title = _generate_title(content, content_type)

    # Calculate word count
    word_count = estimate_word_count(content)

    # Store the note in Supabase
    note_data = {
        "user_id": user_id,
        "title": title,
        "content": content,
        "content_type": content_type.value,
        "source_url": source_url,
        "word_count": word_count,
        "metadata": metadata or {},
    }

    result = supabase.table("notes").insert(note_data).single().execute()
    note = result.data
    note_id = note["id"]

    # Chunk the content for embedding
    chunks = chunk_text(content)

    # Store chunks in database (embeddings will be generated separately)
    if chunks:
        chunk_records = [
            {
                "note_id": note_id,
                "chunk_index": chunk["chunk_index"],
                "content": chunk["content"],
                "token_count": chunk["token_count"],
            }
            for chunk in chunks
        ]
        supabase.table("note_chunks").insert(chunk_records).execute()

    # Handle tags
    if tags:
        await _apply_tags(supabase, user_id, note_id, tags)

    # Trigger async embedding (inline for now, will be background task later)
    try:
        from app.services.embedding_service import embed_note_chunks
        await embed_note_chunks(note_id)
    except Exception as e:
        # Don't fail the capture if embedding fails — note is still saved
        print(f"⚠️ Embedding failed for note {note_id}: {e}")

    # Return the note with tags
    return await get_note_with_details(note_id, user_id)


async def capture_url(
    user_id: str,
    url: str,
    tags: Optional[list[str]] = None,
) -> dict:
    """Capture a note from a URL — scrape, extract text, chunk, embed."""
    from app.utils.url_scraper import scrape_url

    extracted = await scrape_url(url)

    return await capture_text(
        user_id=user_id,
        content=extracted["content"],
        title=extracted.get("title"),
        content_type=ContentType.URL,
        source_url=url,
        tags=tags,
        metadata={
            "author": extracted.get("author"),
            "publish_date": extracted.get("publish_date"),
            "word_count_original": extracted.get("word_count"),
        },
    )


async def capture_pdf(
    user_id: str,
    file_bytes: bytes,
    filename: str,
    tags: Optional[list[str]] = None,
) -> dict:
    """Capture a note from a PDF — parse, extract text, store file, chunk, embed."""
    from app.utils.pdf_parser import parse_pdf

    extracted = parse_pdf(file_bytes)

    # Upload the PDF to Supabase Storage
    supabase = get_supabase_admin()
    file_path = f"{user_id}/pdfs/{uuid4()}/{filename}"
    supabase.storage.from_("neuranotes-files").upload(file_path, file_bytes)

    return await capture_text(
        user_id=user_id,
        content=extracted["content"],
        title=extracted.get("title", filename),
        content_type=ContentType.PDF,
        tags=tags,
        metadata={
            "file_path": file_path,
            "page_count": extracted.get("page_count"),
            "filename": filename,
        },
    )


async def capture_voice(
    user_id: str,
    audio_bytes: bytes,
    filename: str,
    tags: Optional[list[str]] = None,
) -> dict:
    """Capture a voice note — transcribe with Whisper, store audio, chunk, embed."""
    from app.services.ai_client import get_ai_client

    # Upload audio to Supabase Storage
    supabase = get_supabase_admin()
    file_path = f"{user_id}/audio/{uuid4()}/{filename}"
    supabase.storage.from_("neuranotes-files").upload(file_path, audio_bytes)

    # Transcribe with Whisper via Groq
    ai_client = get_ai_client()
    transcription = await ai_client.transcribe(audio_bytes, filename)

    return await capture_text(
        user_id=user_id,
        content=transcription,
        title=f"Voice Note — {filename}",
        content_type=ContentType.VOICE,
        tags=tags,
        metadata={
            "file_path": file_path,
            "filename": filename,
            "duration": None,  # Could extract from audio metadata
        },
    )


async def get_note_with_details(note_id: str, user_id: str) -> dict:
    """Fetch a note with its tags and chunk info."""
    supabase = get_supabase_admin()

    # Get the note
    note_result = (
        supabase.table("notes")
        .select("*")
        .eq("id", note_id)
        .eq("user_id", user_id)
        .single()
        .execute()
    )
    note = note_result.data
    if not note:
        return None

    # Get tags
    tag_result = (
        supabase.table("note_tags")
        .select("tag_id, tags(id, name, color)")
        .eq("note_id", note_id)
        .execute()
    )
    note["tags"] = [row["tags"] for row in tag_result.data] if tag_result.data else []

    # Get chunk count
    chunk_result = (
        supabase.table("note_chunks")
        .select("id", count="exact")
        .eq("note_id", note_id)
        .execute()
    )
    note["chunk_count"] = chunk_result.count or 0

    return note


async def _apply_tags(supabase, user_id: str, note_id: str, tag_names: list[str]):
    """Create tags if they don't exist, then link them to the note."""
    for tag_name in tag_names:
        tag_name = tag_name.strip().lower()
        if not tag_name:
            continue

        # Upsert tag
        existing = (
            supabase.table("tags")
            .select("id")
            .eq("user_id", user_id)
            .eq("name", tag_name)
            .maybe_single()
            .execute()
        )

        if existing.data:
            tag_id = existing.data["id"]
        else:
            new_tag = (
                supabase.table("tags")
                .insert({"user_id": user_id, "name": tag_name})
                .single()
                .execute()
            )
            tag_id = new_tag.data["id"]

        # Link tag to note (ignore if already linked)
        try:
            supabase.table("note_tags").insert({
                "note_id": note_id,
                "tag_id": tag_id,
            }).execute()
        except Exception:
            pass  # Already linked


def _generate_title(content: str, content_type: ContentType) -> str:
    """Auto-generate a title from the first line of content."""
    first_line = content.strip().split("\n")[0][:100]
    # Clean markdown headers
    first_line = first_line.lstrip("# ").strip()
    if len(first_line) > 80:
        first_line = first_line[:77] + "..."
    return first_line or f"Untitled {content_type.value} note"
