"""
Embedding Service — generates embeddings via Google AI Studio and stores in Supabase pgvector.
Uses gemini-embedding-001 (3072 dimensions, free tier).
"""

import asyncio
from typing import Optional

import httpx

from app.core.config import settings
from app.db.supabase_client import get_supabase_admin

# ── Constants ──────────────────────────────────────────────
EMBEDDING_MODEL = "gemini-embedding-001"
EMBEDDING_DIMENSIONS = 3072
BATCH_SIZE = 20  # Max texts per API call
MAX_RETRIES = 3
RETRY_DELAY = 1.0  # seconds


async def generate_embedding(text: str) -> list[float]:
    """
    Generate a single embedding vector for a text string.
    Uses Google AI Studio's gemini-embedding-001 model.
    
    Returns a list of 3072 floats.
    """
    if not settings.google_ai_api_key:
        raise ValueError("GOOGLE_AI_API_KEY must be set in .env")

    url = (
        f"https://generativelanguage.googleapis.com/v1beta/models/{EMBEDDING_MODEL}"
        f":embedContent?key={settings.google_ai_api_key}"
    )

    payload = {
        "model": f"models/{EMBEDDING_MODEL}",
        "content": {
            "parts": [{"text": text}]
        },
    }

    for attempt in range(MAX_RETRIES):
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(url, json=payload)

            if response.status_code == 200:
                data = response.json()
                return data["embedding"]["values"]
            elif response.status_code == 429:
                # Rate limited — wait and retry
                wait_time = RETRY_DELAY * (2 ** attempt)
                print(f"⚠️ Embedding rate limited, retrying in {wait_time}s...")
                await asyncio.sleep(wait_time)
            else:
                raise Exception(
                    f"Embedding API error {response.status_code}: {response.text}"
                )
        except httpx.TimeoutException:
            if attempt < MAX_RETRIES - 1:
                await asyncio.sleep(RETRY_DELAY)
            else:
                raise

    raise Exception("Embedding generation failed after max retries")


async def batch_embed(texts: list[str]) -> list[list[float]]:
    """
    Generate embeddings for multiple texts.
    Processes in batches of BATCH_SIZE to respect API limits.
    """
    all_embeddings = []

    for i in range(0, len(texts), BATCH_SIZE):
        batch = texts[i:i + BATCH_SIZE]

        # Process batch concurrently
        tasks = [generate_embedding(text) for text in batch]
        batch_embeddings = await asyncio.gather(*tasks, return_exceptions=True)

        for j, result in enumerate(batch_embeddings):
            if isinstance(result, Exception):
                print(f"⚠️ Failed to embed text {i + j}: {result}")
                all_embeddings.append(None)
            else:
                all_embeddings.append(result)

        # Brief pause between batches to avoid rate limiting
        if i + BATCH_SIZE < len(texts):
            await asyncio.sleep(0.5)

    return all_embeddings


async def embed_note_chunks(note_id: str) -> int:
    """
    Generate and store embeddings for all chunks of a note.
    
    Returns the number of successfully embedded chunks.
    """
    supabase = get_supabase_admin()

    # Fetch chunks that need embedding
    chunks = (
        supabase.table("note_chunks")
        .select("id, content")
        .eq("note_id", note_id)
        .is_("embedding", "null")
        .order("chunk_index")
        .execute()
    )

    if not chunks.data:
        return 0

    # Generate embeddings
    texts = [chunk["content"] for chunk in chunks.data]
    embeddings = await batch_embed(texts)

    # Store embeddings in Supabase
    embedded_count = 0
    for chunk_data, embedding in zip(chunks.data, embeddings):
        if embedding is not None:
            supabase.table("note_chunks").update(
                {"embedding": embedding}
            ).eq("id", chunk_data["id"]).execute()
            embedded_count += 1

    print(f"✅ Embedded {embedded_count}/{len(chunks.data)} chunks for note {note_id}")
    return embedded_count
