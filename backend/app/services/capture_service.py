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

    result = supabase.table("notes").insert(note_data).execute()
    note = result.data[0]
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
    description: Optional[str] = None,
) -> dict:
    """Capture a note from a URL — scrape, enhance with AI, chunk, embed."""
    from app.utils.url_scraper import scrape_url

    try:
        extracted = await scrape_url(url)
        raw_content = extracted["content"]
        title = extracted.get("title")

        # Enhance the scraped content with AI to produce clean, well-structured notes
        enhanced_content = await _enhance_with_ai(
            raw_content=raw_content,
            url=url,
            title=title,
            user_description=description,
        )

        # Use the AI-enhanced content (fall back to raw if AI fails)
        final_content = enhanced_content or raw_content

        # Prepend the user's description if provided and AI didn't already incorporate it
        if description and not enhanced_content:
            final_content = f"{description}\n\n{final_content}"

        metadata = {
            "author": extracted.get("author"),
            "publish_date": extracted.get("publish_date"),
            "word_count_original": extracted.get("word_count"),
            "user_description": description,
            "ai_enhanced": enhanced_content is not None,
            "scrape_failed": False,
        }
    except Exception as e:
        print(f"⚠️ URL scrape failed, falling back to basic bookmark: {e}")
        # Graceful fallback if scraping is impossible (e.g. strict login wall)
        final_content = description or f"Unable to extract content from this URL. Saved as a bookmark instead."
        title = "Saved Bookmark"
        metadata = {
            "user_description": description,
            "scrape_failed": True,
            "scrape_error": str(e),
        }

    return await capture_text(
        user_id=user_id,
        content=final_content,
        title=title,
        content_type=ContentType.URL,
        source_url=url,
        tags=tags,
        metadata=metadata,
    )


async def _enhance_with_ai(
    raw_content: str,
    url: str,
    title: Optional[str] = None,
    user_description: Optional[str] = None,
) -> Optional[str]:
    """
    Send raw scraped content to AI to produce a clean, well-structured note.
    Returns None if AI enhancement fails (caller falls back to raw content).
    """
    try:
        from app.services.ai_client import get_ai_client

        ai_client = get_ai_client()

        # Truncate very long content to avoid token limits
        truncated = raw_content[:8000]

        system_prompt = """You are a note-taking assistant. You receive raw scraped text from a web page.
Your job is to transform it into a clean, well-structured note in Markdown format.

Rules:
- Remove navigation text, footer links, cookie notices, ads, and other UI artifacts
- Keep ALL the meaningful content — facts, ideas, code, explanations
- Organize with proper headings (##), bullet points, and paragraphs
- If it's an article, preserve the author's structure and key points
- If it's a profile/repo page, extract the important info (name, description, tech stack, etc.)
- If there is code, preserve it in proper markdown code blocks
- Do NOT add your own opinions or commentary
- Do NOT add a title heading — we already store the title separately
- The output should read like a clean, well-organized study note"""

        user_prompt = f"URL: {url}\n"
        if title:
            user_prompt += f"Page title: {title}\n"
        if user_description:
            user_prompt += f"User's note about this: {user_description}\n"
        user_prompt += f"\n---\nRaw scraped content:\n{truncated}"

        response = await ai_client.chat(
            system_prompt=system_prompt,
            messages=[{"role": "user", "content": user_prompt}],
            temperature=0.3,
            max_tokens=2048,
        )

        enhanced = response.get("content", "").strip()

        # Only use if AI actually produced something meaningful
        if enhanced and len(enhanced) > 30:
            return enhanced

    except Exception as e:
        print(f"⚠️ AI content enhancement failed: {e}")

    return None


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
        .limit(1)
        .execute()
    )
    if not note_result.data:
        return None
    note = note_result.data[0]

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
            .limit(1)
            .execute()
        )

        if existing.data:
            tag_id = existing.data[0]["id"]
        else:
            new_tag = (
                supabase.table("tags")
                .insert({"user_id": user_id, "name": tag_name})
                .execute()
            )
            tag_id = new_tag.data[0]["id"]

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
