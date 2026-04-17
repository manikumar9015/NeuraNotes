"""
Text Chunker — splits text into optimal chunks for embedding.
Uses tiktoken for accurate token counting.
Implements sliding window with configurable overlap.
"""

import re
from typing import Optional

import tiktoken


# Use cl100k_base encoding (same as used by modern embedding models)
_encoder: Optional[tiktoken.Encoding] = None


def _get_encoder() -> tiktoken.Encoding:
    """Lazy-load the tiktoken encoder."""
    global _encoder
    if _encoder is None:
        _encoder = tiktoken.get_encoding("cl100k_base")
    return _encoder


def count_tokens(text: str) -> int:
    """Count the number of tokens in a text string."""
    encoder = _get_encoder()
    return len(encoder.encode(text))


def chunk_text(
    text: str,
    chunk_size: int = 512,
    chunk_overlap: int = 50,
    min_chunk_size: int = 50,
) -> list[dict]:
    """
    Split text into chunks optimized for embedding and retrieval.
    
    Strategy:
    1. Split by paragraphs first (preserves natural boundaries)
    2. Merge small paragraphs into chunks up to chunk_size tokens
    3. Apply overlap between chunks for context continuity
    
    Args:
        text: The text to chunk
        chunk_size: Target token count per chunk (default 512)
        chunk_overlap: Number of overlapping tokens between chunks (default 50)
        min_chunk_size: Minimum tokens for a chunk to be kept (default 50)
    
    Returns:
        List of dicts with 'content', 'chunk_index', and 'token_count'
    """
    if not text or not text.strip():
        return []

    # Clean the text
    text = re.sub(r'\n{3,}', '\n\n', text.strip())

    # Split into paragraphs (preserve natural boundaries)
    paragraphs = re.split(r'\n\s*\n', text)
    paragraphs = [p.strip() for p in paragraphs if p.strip()]

    if not paragraphs:
        return []

    # If the entire text fits in one chunk, return it as-is
    total_tokens = count_tokens(text)
    if total_tokens <= chunk_size:
        return [{
            "content": text,
            "chunk_index": 0,
            "token_count": total_tokens,
        }]

    # Merge paragraphs into chunks up to chunk_size tokens
    chunks = []
    current_chunk_parts = []
    current_token_count = 0

    for paragraph in paragraphs:
        para_tokens = count_tokens(paragraph)

        # If a single paragraph exceeds chunk_size, split it by sentences
        if para_tokens > chunk_size:
            # Flush current chunk first
            if current_chunk_parts:
                chunk_text_content = "\n\n".join(current_chunk_parts)
                chunks.append(chunk_text_content)
                current_chunk_parts = []
                current_token_count = 0

            # Split long paragraph by sentences
            sentences = re.split(r'(?<=[.!?])\s+', paragraph)
            for sentence in sentences:
                sent_tokens = count_tokens(sentence)
                if current_token_count + sent_tokens > chunk_size and current_chunk_parts:
                    chunks.append(" ".join(current_chunk_parts))
                    current_chunk_parts = []
                    current_token_count = 0
                current_chunk_parts.append(sentence)
                current_token_count += sent_tokens
            continue

        # Check if adding this paragraph would exceed the limit
        if current_token_count + para_tokens > chunk_size and current_chunk_parts:
            # Flush current chunk
            chunks.append("\n\n".join(current_chunk_parts))
            current_chunk_parts = []
            current_token_count = 0

        current_chunk_parts.append(paragraph)
        current_token_count += para_tokens

    # Don't forget the last chunk
    if current_chunk_parts:
        chunks.append("\n\n".join(current_chunk_parts))

    # Apply overlap: prepend tail of previous chunk to current chunk
    if chunk_overlap > 0 and len(chunks) > 1:
        overlapped_chunks = [chunks[0]]
        encoder = _get_encoder()

        for i in range(1, len(chunks)):
            prev_tokens = encoder.encode(chunks[i - 1])
            overlap_tokens = prev_tokens[-chunk_overlap:] if len(prev_tokens) > chunk_overlap else prev_tokens
            overlap_text = encoder.decode(overlap_tokens)
            overlapped_chunks.append(overlap_text.strip() + " " + chunks[i])

        chunks = overlapped_chunks

    # Build final result with metadata
    result = []
    for i, chunk_content in enumerate(chunks):
        token_count = count_tokens(chunk_content)
        if token_count >= min_chunk_size:
            result.append({
                "content": chunk_content,
                "chunk_index": i,
                "token_count": token_count,
            })

    return result


def estimate_word_count(text: str) -> int:
    """Quick word count estimation."""
    return len(text.split())
