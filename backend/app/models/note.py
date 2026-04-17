"""
Pydantic models for Note, NoteChunk, Tag, and NoteTag entities.
"""

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class ContentType(str, Enum):
    """Supported note content types."""
    TEXT = "text"
    URL = "url"
    PDF = "pdf"
    VOICE = "voice"
    IMAGE = "image"


class TagBase(BaseModel):
    """Base tag fields."""
    name: str = Field(..., max_length=100)
    color: str = Field(default="#6366F1", max_length=7)


class TagCreate(TagBase):
    """Schema for creating a new tag."""
    pass


class TagResponse(TagBase):
    """Schema for tag data returned by the API."""
    id: str
    user_id: str

    class Config:
        from_attributes = True


class NoteChunkResponse(BaseModel):
    """Schema for a note chunk with its embedding status."""
    id: str
    chunk_index: int
    content: str
    token_count: Optional[int] = None
    has_embedding: bool = False

    class Config:
        from_attributes = True


class NoteBase(BaseModel):
    """Base note fields shared across schemas."""
    title: Optional[str] = Field(None, max_length=500)
    content: str = Field(..., min_length=1, max_length=50000)
    content_type: ContentType = ContentType.TEXT
    source_url: Optional[str] = Field(None, max_length=2048)


class NoteCreate(NoteBase):
    """Schema for creating a new note."""
    tags: list[str] = Field(default_factory=list)  # Tag names to auto-create


class NoteUpdate(BaseModel):
    """Schema for updating a note (all fields optional)."""
    title: Optional[str] = Field(None, max_length=500)
    content: Optional[str] = Field(None, min_length=1, max_length=50000)
    tags: Optional[list[str]] = None
    is_archived: Optional[bool] = None


class NoteResponse(NoteBase):
    """Schema for note data returned by the API."""
    id: str
    user_id: str
    word_count: int = 0
    is_archived: bool = False
    file_path: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    metadata: dict = Field(default_factory=dict)
    tags: list[TagResponse] = Field(default_factory=list)

    class Config:
        from_attributes = True


class NoteDetailResponse(NoteResponse):
    """Full note detail including chunks."""
    chunks: list[NoteChunkResponse] = Field(default_factory=list)


class NoteSearchRequest(BaseModel):
    """Schema for semantic search request."""
    query: str = Field(..., min_length=1, max_length=1000)
    content_type: Optional[ContentType] = None
    tags: Optional[list[str]] = None
    after: Optional[datetime] = None
    before: Optional[datetime] = None
    limit: int = Field(default=5, ge=1, le=20)


class NoteSearchResult(BaseModel):
    """A single search result with relevance score."""
    note_id: str
    title: Optional[str] = None
    content_snippet: str
    content_type: str
    similarity: float
    source_url: Optional[str] = None
    created_at: datetime
    tags: list[str] = Field(default_factory=list)


class NoteSearchResponse(BaseModel):
    """Response from semantic search."""
    query: str
    results: list[NoteSearchResult]
    total: int
