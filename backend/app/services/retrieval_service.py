"""
Retrieval Service — semantic search over user's notes using pgvector.
Converts query to embedding, calls Supabase match_chunks RPC, returns ranked results.
"""

from datetime import datetime
from typing import Optional

from app.db.supabase_client import get_supabase_admin
from app.models.note import NoteSearchResult
from app.services.embedding_service import generate_embedding


async def semantic_search(
    query: str,
    user_id: str,
    content_type: Optional[str] = None,
    tags: Optional[list[str]] = None,
    after: Optional[datetime] = None,
    before: Optional[datetime] = None,
    limit: int = 5,
    similarity_threshold: float = 0.4,
) -> list[NoteSearchResult]:
    """
    Perform semantic search over a user's notes.
    
    Pipeline:
    1. Convert query to embedding (3072-dim)
    2. Call Supabase match_chunks() RPC (cosine similarity, top-20)
    3. Apply metadata filters
    4. Group by note_id (best chunk per note)
    5. Return top results with source citations
    """

    # Step 1: Generate query embedding
    query_embedding = await generate_embedding(query)

    # Step 2: Call match_chunks RPC
    supabase = get_supabase_admin()

    rpc_params = {
        "query_embedding": query_embedding,
        "match_threshold": similarity_threshold,
        "match_count": limit * 4,  # Fetch more candidates for dedup
        "filter_user_id": user_id,
    }

    if content_type:
        rpc_params["filter_content_type"] = content_type
    if after:
        rpc_params["filter_after"] = after.isoformat()
    if before:
        rpc_params["filter_before"] = before.isoformat()

    result = supabase.rpc("match_chunks", rpc_params).execute()

    if not result.data:
        return []

    # Step 3: Group by note_id — keep best chunk per note
    seen_notes = {}
    for row in result.data:
        note_id = row["note_id"]
        if note_id not in seen_notes or row["similarity"] > seen_notes[note_id]["similarity"]:
            seen_notes[note_id] = row

    # Step 4: Sort by similarity and limit
    ranked = sorted(seen_notes.values(), key=lambda x: x["similarity"], reverse=True)[:limit]

    # Step 5: Fetch tags for each result note
    note_ids = [r["note_id"] for r in ranked]
    tags_result = (
        supabase.table("note_tags")
        .select("note_id, tags(name)")
        .in_("note_id", note_ids)
        .execute()
    )

    note_tags = {}
    if tags_result.data:
        for row in tags_result.data:
            nid = row["note_id"]
            tag_name = row.get("tags", {}).get("name", "")
            if nid not in note_tags:
                note_tags[nid] = []
            if tag_name:
                note_tags[nid].append(tag_name)

    # Filter by tags if specified
    if tags:
        tags_lower = [t.lower() for t in tags]
        ranked = [
            r for r in ranked
            if any(
                t.lower() in tags_lower
                for t in note_tags.get(r["note_id"], [])
            )
        ]

    # Step 6: Build response
    results = []
    for row in ranked:
        results.append(NoteSearchResult(
            note_id=row["note_id"],
            title=row.get("note_title"),
            content_snippet=row["chunk_content"][:300] + "..." if len(row["chunk_content"]) > 300 else row["chunk_content"],
            content_type=row.get("note_content_type", "text"),
            similarity=round(row["similarity"], 4),
            source_url=row.get("note_source_url"),
            created_at=row["note_created_at"],
            tags=note_tags.get(row["note_id"], []),
        ))

    return results


async def retrieve_context_for_agent(
    query: str,
    user_id: str,
    limit: int = 5,
) -> list[dict]:
    """
    Retrieve relevant note chunks formatted for the AI agent's context window.
    Returns chunks with source metadata for citations.
    """
    results = await semantic_search(
        query=query,
        user_id=user_id,
        limit=limit,
        similarity_threshold=0.60,  # Stricter threshold to avoid fetching irrelevant notes
    )

    # Format for agent context
    context_chunks = []
    for i, result in enumerate(results, 1):
        context_chunks.append({
            "index": i,
            "note_id": result.note_id,
            "title": result.title or "Untitled",
            "content": result.content_snippet,
            "content_type": result.content_type,
            "similarity": result.similarity,
            "source_url": result.source_url,
            "created_at": result.created_at.isoformat() if result.created_at else None,
            "tags": result.tags,
        })

    return context_chunks
