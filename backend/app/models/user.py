"""
Pydantic models for User entity.
Used for data validation and serialization throughout the app.
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field


class UserBase(BaseModel):
    """Base user fields shared across schemas."""
    email: EmailStr
    name: Optional[str] = None
    avatar_url: Optional[str] = None


class UserCreate(UserBase):
    """Schema for creating a new user (from Google OAuth)."""
    google_id: str


class UserResponse(UserBase):
    """Schema for user data returned by the API."""
    id: str
    google_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    settings: dict = Field(default_factory=dict)

    class Config:
        from_attributes = True


class UserProfile(BaseModel):
    """Enriched user profile with stats (used in agent context)."""
    id: str
    name: Optional[str] = None
    total_notes: int = 0
    top_tags: list[str] = Field(default_factory=list)
    recent_topics: list[str] = Field(default_factory=list)
    member_since: Optional[datetime] = None
