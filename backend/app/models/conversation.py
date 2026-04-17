"""
Pydantic models for Conversation and Message entities.
"""

from datetime import datetime
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field


class MessageRole(str, Enum):
    """Chat message roles."""
    USER = "user"
    ASSISTANT = "assistant"


class SubtaskStatus(str, Enum):
    """Status of a decomposed subtask."""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class Subtask(BaseModel):
    """A single subtask in the agent's execution plan."""
    id: str                                   # e.g., "s1", "s2"
    description: str                          # Human-readable description
    tool_name: str                            # Which tool to call
    parameters: dict = Field(default_factory=dict)
    depends_on: list[str] = Field(default_factory=list)
    status: SubtaskStatus = SubtaskStatus.PENDING
    result: Optional[Any] = None
    error: Optional[str] = None


class ExecutionPlan(BaseModel):
    """The full execution plan produced by the Planner."""
    original_query: str
    complexity: str  # "simple", "retrieval", "complex"
    subtasks: list[Subtask] = Field(default_factory=list)


class ConversationCreate(BaseModel):
    """Schema for starting a new conversation."""
    title: Optional[str] = Field(None, max_length=500)


class ConversationResponse(BaseModel):
    """Schema for conversation metadata."""
    id: str
    user_id: str
    title: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    message_count: int = 0

    class Config:
        from_attributes = True


class MessageCreate(BaseModel):
    """Schema for sending a message."""
    content: str = Field(..., min_length=1, max_length=10000)


class MessageResponse(BaseModel):
    """Schema for message data returned by the API."""
    id: str
    conversation_id: str
    role: MessageRole
    content: str
    sources: list[dict] = Field(default_factory=list)
    subtasks: list[dict] = Field(default_factory=list)  # Task decomposition trace
    created_at: datetime

    class Config:
        from_attributes = True


class ChatRequest(BaseModel):
    """Full chat request with message content."""
    content: str = Field(..., min_length=1, max_length=10000)
    stream: bool = False  # Whether to stream the response


class ChatResponse(BaseModel):
    """Full chat response with AI answer and metadata."""
    message: MessageResponse
    execution_plan: Optional[ExecutionPlan] = None  # Shows subtask trace if complex
