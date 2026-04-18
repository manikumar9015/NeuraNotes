"""
Notes Router — CRUD operations for notes + search + imports.
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, status
from pydantic import BaseModel

from app.dependencies import get_current_user
from app.db.supabase_client import get_supabase_admin
from app.models.note import (
    NoteCreate,
    NoteUpdate,
    NoteResponse,
    NoteDetailResponse,
    NoteSearchRequest,
    NoteSearchResponse,
)

router = APIRouter()


# ── Create Note ─────────────────────────────────────────────

@router.post("", response_model=dict, status_code=status.HTTP_201_CREATED)
async def create_note(
    note: NoteCreate,
    user: dict = Depends(get_current_user),
):
    """Create a new note. Triggers async embedding for semantic search."""
    from app.services.capture_service import capture_text

    result = await capture_text(
        user_id=user["id"],
        content=note.content,
        title=note.title,
        content_type=note.content_type,
        source_url=note.source_url,
        tags=note.tags,
    )
    return result


# ── List Notes ──────────────────────────────────────────────

@router.get("", response_model=dict)
async def list_notes(
    user: dict = Depends(get_current_user),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    content_type: Optional[str] = Query(None),
    tag: Optional[str] = Query(None),
    archived: bool = Query(False),
    search: Optional[str] = Query(None, description="Full-text search"),
):
    """List notes with pagination and filters."""
    supabase = get_supabase_admin()
    offset = (page - 1) * limit

    # Build query
    query = (
        supabase.table("notes")
        .select("*, note_tags(tag_id, tags(id, name, color))", count="exact")
        .eq("user_id", user["id"])
        .eq("is_archived", archived)
        .order("created_at", desc=True)
        .range(offset, offset + limit - 1)
    )

    if content_type:
        query = query.eq("content_type", content_type)

    if search:
        query = query.ilike("content", f"%{search}%")

    result = query.execute()

    # Format tags in response
    notes = []
    for note in result.data:
        note_tags = note.pop("note_tags", [])
        note["tags"] = [nt["tags"] for nt in note_tags if nt.get("tags")]
        notes.append(note)

    return {
        "notes": notes,
        "total": result.count or 0,
        "page": page,
        "limit": limit,
    }


# ── Get Single Note ────────────────────────────────────────

@router.get("/{note_id}", response_model=dict)
async def get_note(
    note_id: str,
    user: dict = Depends(get_current_user),
):
    """Get a single note with full content, tags, and chunks."""
    from app.services.capture_service import get_note_with_details

    note = await get_note_with_details(note_id, user["id"])
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    # Also fetch chunks
    supabase = get_supabase_admin()
    chunks = (
        supabase.table("note_chunks")
        .select("id, chunk_index, content, token_count")
        .eq("note_id", note_id)
        .order("chunk_index")
        .execute()
    )
    note["chunks"] = chunks.data or []

    return note


# ── Update Note ─────────────────────────────────────────────

@router.patch("/{note_id}", response_model=dict)
async def update_note(
    note_id: str,
    update: NoteUpdate,
    user: dict = Depends(get_current_user),
):
    """Update a note. Re-embeds if content changes."""
    supabase = get_supabase_admin()

    # Verify ownership
    existing = (
        supabase.table("notes")
        .select("id, content")
        .eq("id", note_id)
        .eq("user_id", user["id"])
        .limit(1)
        .execute()
    )
    if not existing.data:
        raise HTTPException(status_code=404, detail="Note not found")

    # Build update dict (only non-None fields)
    update_data = {}
    if update.title is not None:
        update_data["title"] = update.title
    if update.content is not None:
        update_data["content"] = update.content
        update_data["word_count"] = len(update.content.split())
    if update.is_archived is not None:
        update_data["is_archived"] = update.is_archived

    if update_data:
        result = (
            supabase.table("notes")
            .update(update_data)
            .eq("id", note_id)
            .execute()
        )

    # Re-embed if content changed
    if update.content is not None and update.content != existing.data[0]["content"]:
        # Delete old chunks
        supabase.table("note_chunks").delete().eq("note_id", note_id).execute()

        # Re-chunk and embed
        from app.utils.chunker import chunk_text
        chunks = chunk_text(update.content)
        if chunks:
            chunk_records = [
                {
                    "note_id": note_id,
                    "chunk_index": c["chunk_index"],
                    "content": c["content"],
                    "token_count": c["token_count"],
                }
                for c in chunks
            ]
            supabase.table("note_chunks").insert(chunk_records).execute()

            try:
                from app.services.embedding_service import embed_note_chunks
                await embed_note_chunks(note_id)
            except Exception as e:
                print(f"⚠️ Re-embedding failed for note {note_id}: {e}")

    # Handle tag updates
    if update.tags is not None:
        # Remove existing tags
        supabase.table("note_tags").delete().eq("note_id", note_id).execute()
        # Apply new tags
        from app.services.capture_service import _apply_tags
        await _apply_tags(supabase, user["id"], note_id, update.tags)

    from app.services.capture_service import get_note_with_details
    return await get_note_with_details(note_id, user["id"])


# ── Delete Note ─────────────────────────────────────────────

@router.delete("/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_note(
    note_id: str,
    user: dict = Depends(get_current_user),
):
    """Soft delete a note and remove its vectors."""
    supabase = get_supabase_admin()

    # Verify ownership
    existing = (
        supabase.table("notes")
        .select("id")
        .eq("id", note_id)
        .eq("user_id", user["id"])
        .limit(1)
        .execute()
    )
    if not existing.data:
        raise HTTPException(status_code=404, detail="Note not found")

    # Soft delete (set is_archived = true)
    supabase.table("notes").update({"is_archived": True}).eq("id", note_id).execute()

    # Remove chunks (and their embeddings)
    supabase.table("note_chunks").delete().eq("note_id", note_id).execute()


# ── Semantic Search ─────────────────────────────────────────

@router.post("/search", response_model=NoteSearchResponse)
async def search_notes(
    request: NoteSearchRequest,
    user: dict = Depends(get_current_user),
):
    """Semantic search across user's notes using vector similarity."""
    from app.services.retrieval_service import semantic_search

    results = await semantic_search(
        query=request.query,
        user_id=user["id"],
        content_type=request.content_type.value if request.content_type else None,
        after=request.after,
        before=request.before,
        limit=request.limit,
    )

    return NoteSearchResponse(
        query=request.query,
        results=results,
        total=len(results),
    )


# ── URL Import ──────────────────────────────────────────────

class UrlImportRequest(BaseModel):
    url: str
    tags: list[str] = []
    description: Optional[str] = None


@router.post("/import/url", response_model=dict, status_code=status.HTTP_201_CREATED)
async def import_url(
    request: UrlImportRequest,
    user: dict = Depends(get_current_user),
):
    """Scrape a URL and import it as a note."""
    from app.services.capture_service import capture_url

    try:
        result = await capture_url(
            user_id=user["id"],
            url=request.url,
            tags=request.tags,
            description=request.description,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ── PDF Import ──────────────────────────────────────────────

@router.post("/import/pdf", response_model=dict, status_code=status.HTTP_201_CREATED)
async def import_pdf(
    file: UploadFile = File(...),
    tags: Optional[str] = Query(None, description="Comma-separated tags"),
    user: dict = Depends(get_current_user),
):
    """Upload and import a PDF document as a note."""
    if not file.content_type or "pdf" not in file.content_type:
        raise HTTPException(status_code=400, detail="File must be a PDF")

    if file.size and file.size > 10 * 1024 * 1024:  # 10MB limit
        raise HTTPException(status_code=400, detail="File size must be under 10MB")

    from app.services.capture_service import capture_pdf

    file_bytes = await file.read()
    tag_list = [t.strip() for t in tags.split(",")] if tags else []

    result = await capture_pdf(
        user_id=user["id"],
        file_bytes=file_bytes,
        filename=file.filename or "document.pdf",
        tags=tag_list,
    )
    return result


# ── Voice Import ────────────────────────────────────────────

@router.post("/import/voice", response_model=dict, status_code=status.HTTP_201_CREATED)
async def import_voice(
    file: UploadFile = File(...),
    tags: Optional[str] = Query(None, description="Comma-separated tags"),
    user: dict = Depends(get_current_user),
):
    """Upload and transcribe a voice recording as a note."""
    allowed_types = ["audio/mpeg", "audio/wav", "audio/mp4", "audio/webm", "audio/ogg"]
    if file.content_type and file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail=f"Unsupported audio format: {file.content_type}")

    if file.size and file.size > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File size must be under 10MB")

    from app.services.capture_service import capture_voice

    audio_bytes = await file.read()
    tag_list = [t.strip() for t in tags.split(",")] if tags else []

    result = await capture_voice(
        user_id=user["id"],
        audio_bytes=audio_bytes,
        filename=file.filename or "recording.webm",
        tags=tag_list,
    )
    return result


# ── AI Flashcards Generation ────────────────────────────────

@router.post("/{note_id}/flashcards", response_model=dict, status_code=status.HTTP_200_OK)
async def generate_flashcards(
    note_id: str,
    user: dict = Depends(get_current_user),
):
    """Generate flashcards from a note's content using AI."""
    import json
    from app.db.supabase_client import get_supabase_admin
    from app.services.ai_client import get_ai_client

    supabase = get_supabase_admin()

    # Verify ownership and get content
    note_result = (
        supabase.table("notes")
        .select("content, title")
        .eq("id", note_id)
        .eq("user_id", user["id"])
        .execute()
    )

    if not note_result.data:
        raise HTTPException(status_code=404, detail="Note not found")

    note = note_result.data[0]
    content = note["content"]
    title = note["title"]

    ai_client = get_ai_client()
    
    system_prompt = """You are a study assistant that generates flashcards.
You will be provided with a note's content.
Extract the most important facts, concepts, and definitions.
Create flashcards from this info. Each flashcard should have a 'front' (the question or concept) and a 'back' (the answer or definition).
You MUST output ONLY valid JSON in the following format, with no markdown formatting around it:
{"flashcards": [{"front": "concept", "back": "definition"}]}
Create between 5 and 15 flashcards depending on the length and density of the note."""

    user_prompt = f"Note Title: {title}\n\nNote Content:\n{content}"

    try:
        response = await ai_client.chat(
            system_prompt=system_prompt,
            messages=[{"role": "user", "content": user_prompt}],
            temperature=0.3,
            response_format={"type": "json_object"},
            max_tokens=2048,
        )
        
        # Parse the JSON response
        raw_json = response.get("content", "{}")
        # Ensure it's valid JSON even if the model accidentally included markdown
        if raw_json.startswith("```json"):
            raw_json = raw_json[7:-3].strip()
        
        flashcards_data = json.loads(raw_json)
        
        return flashcards_data
        
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="AI failed to generate valid JSON format")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Generation failed: {str(e)}")
