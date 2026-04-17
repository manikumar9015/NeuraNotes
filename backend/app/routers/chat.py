"""
Chat Router — conversation management and AI chat endpoints.
Includes WebSocket support for streaming responses.
"""

import json
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, status

from app.dependencies import get_current_user
from app.db.supabase_client import get_supabase_admin
from app.models.conversation import (
    ChatRequest,
    ChatResponse,
    ConversationCreate,
    ConversationResponse,
    MessageCreate,
    MessageResponse,
    MessageRole,
)

router = APIRouter()


# ── Conversations ───────────────────────────────────────────

@router.post("/conversations", response_model=dict, status_code=status.HTTP_201_CREATED)
async def create_conversation(
    body: ConversationCreate,
    user: dict = Depends(get_current_user),
):
    """Start a new conversation."""
    supabase = get_supabase_admin()
    result = (
        supabase.table("conversations")
        .insert({
            "user_id": user["id"],
            "title": body.title or "New Conversation",
        })
        .execute()
    )
    return result.data[0]


@router.get("/conversations", response_model=dict)
async def list_conversations(
    user: dict = Depends(get_current_user),
    page: int = 1,
    limit: int = 20,
):
    """List all conversations for the user, newest first."""
    supabase = get_supabase_admin()
    offset = (page - 1) * limit

    result = (
        supabase.table("conversations")
        .select("*", count="exact")
        .eq("user_id", user["id"])
        .order("updated_at", desc=True)
        .range(offset, offset + limit - 1)
        .execute()
    )

    # Get message counts for each conversation
    conversations = result.data or []
    for conv in conversations:
        msg_count = (
            supabase.table("messages")
            .select("id", count="exact")
            .eq("conversation_id", conv["id"])
            .execute()
        )
        conv["message_count"] = msg_count.count or 0

    return {
        "conversations": conversations,
        "total": result.count or 0,
        "page": page,
        "limit": limit,
    }


@router.get("/conversations/{conversation_id}/messages", response_model=dict)
async def get_messages(
    conversation_id: str,
    user: dict = Depends(get_current_user),
    page: int = 1,
    limit: int = 50,
):
    """Get message history for a conversation."""
    supabase = get_supabase_admin()

    # Verify ownership
    conv = (
        supabase.table("conversations")
        .select("id")
        .eq("id", conversation_id)
        .eq("user_id", user["id"])
        .maybe_single()
        .execute()
    )
    if not conv.data:
        raise HTTPException(status_code=404, detail="Conversation not found")

    offset = (page - 1) * limit
    messages = (
        supabase.table("messages")
        .select("*", count="exact")
        .eq("conversation_id", conversation_id)
        .order("created_at")
        .range(offset, offset + limit - 1)
        .execute()
    )

    return {
        "messages": messages.data or [],
        "total": messages.count or 0,
        "page": page,
        "limit": limit,
    }

@router.delete("/conversations/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_conversation(
    conversation_id: str,
    user: dict = Depends(get_current_user),
):
    """Delete a conversation and all its messages."""
    supabase = get_supabase_admin()

    # Verify ownership
    conv = (
        supabase.table("conversations")
        .select("id")
        .eq("id", conversation_id)
        .eq("user_id", user["id"])
        .limit(1)
        .execute()
    )
    if not conv.data:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Delete conversation (Cascade will delete messages)
    (
        supabase.table("conversations")
        .delete()
        .eq("id", conversation_id)
        .execute()
    )
    return None

# ── Send Message (Main Chat Endpoint) ──────────────────────

@router.post("/conversations/{conversation_id}/messages", response_model=dict)
async def send_message(
    conversation_id: str,
    body: ChatRequest,
    user: dict = Depends(get_current_user),
):
    """
    Send a message in a conversation and get an AI response.
    
    This is the main chat endpoint. It:
    1. Saves the user's message
    2. Loads conversation history
    3. Routes through the Orchestrator (classify → plan → execute → synthesize)
    4. Saves and returns the assistant's response
    """
    supabase = get_supabase_admin()

    # Verify ownership
    conv = (
        supabase.table("conversations")
        .select("id")
        .eq("id", conversation_id)
        .eq("user_id", user["id"])
        .limit(1)
        .execute()
    )
    if not conv.data:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Save user message
    user_msg = (
        supabase.table("messages")
        .insert({
            "conversation_id": conversation_id,
            "role": MessageRole.USER.value,
            "content": body.content,
        })
        .execute()
    )

    # Load conversation history (last 20 messages for context)
    history_result = (
        supabase.table("messages")
        .select("role, content")
        .eq("conversation_id", conversation_id)
        .order("created_at")
        .limit(20)
        .execute()
    )
    conversation_history = [
        {"role": msg["role"], "content": msg["content"]}
        for msg in (history_result.data or [])
    ]

    # Route through the Orchestrator
    from app.services.agent.orchestrator import orchestrate

    try:
        result = await orchestrate(
            user_id=user["id"],
            message=body.content,
            conversation_history=conversation_history[:-1],  # Exclude the message we just added
        )
    except Exception as e:
        # Save error response
        error_content = f"I encountered an error processing your request: {str(e)}. Please try again."
        result = {
            "content": error_content,
            "sources": [],
            "execution_plan": None,
        }

    # Save assistant response
    assistant_msg = (
        supabase.table("messages")
        .insert({
            "conversation_id": conversation_id,
            "role": MessageRole.ASSISTANT.value,
            "content": result["content"],
            "sources": result.get("sources", []),
            "subtasks": (
                result["execution_plan"].get("subtasks", [])
                if result.get("execution_plan")
                else []
            ),
        })
        .execute()
    )

    # Update conversation title if it's the first real message
    if len(conversation_history) <= 2:
        title = body.content[:80] + ("..." if len(body.content) > 80 else "")
        supabase.table("conversations").update(
            {"title": title}
        ).eq("id", conversation_id).execute()

    # Update conversation timestamp
    supabase.table("conversations").update(
        {"updated_at": "now()"}
    ).eq("id", conversation_id).execute()

    return {
        "user_message": user_msg.data[0],
        "assistant_message": assistant_msg.data[0],
        "execution_plan": result.get("execution_plan"),
    }


# ── WebSocket Chat (Streaming) ─────────────────────────────

@router.websocket("/ws/{conversation_id}")
async def websocket_chat(
    websocket: WebSocket,
    conversation_id: str,
):
    """
    WebSocket endpoint for streaming AI responses.
    
    Protocol:
    - Client sends: {"content": "user message", "token": "jwt_token"}
    - Server sends: {"type": "chunk", "content": "partial response"}
    - Server sends: {"type": "done", "message": {...full message...}}
    - Server sends: {"type": "error", "detail": "error message"}
    """
    await websocket.accept()

    try:
        while True:
            # Receive message from client
            data = await websocket.receive_json()
            content = data.get("content", "")
            token = data.get("token", "")

            if not content:
                await websocket.send_json({"type": "error", "detail": "Empty message"})
                continue

            # Validate token
            from app.core.security import verify_token
            payload = verify_token(token)
            if not payload:
                await websocket.send_json({"type": "error", "detail": "Invalid token"})
                continue

            user_id = payload.get("sub")
            supabase = get_supabase_admin()

            # Verify conversation ownership
            conv = (
                supabase.table("conversations")
                .select("id")
                .eq("id", conversation_id)
                .eq("user_id", user_id)
                .limit(1)
                .execute()
            )
            if not conv.data:
                await websocket.send_json({"type": "error", "detail": "Conversation not found"})
                continue

            # Save user message
            supabase.table("messages").insert({
                "conversation_id": conversation_id,
                "role": "user",
                "content": content,
            }).execute()

            # Send processing indicator
            await websocket.send_json({"type": "status", "content": "Processing your request..."})

            # Process through orchestrator
            history = (
                supabase.table("messages")
                .select("role, content")
                .eq("conversation_id", conversation_id)
                .order("created_at")
                .limit(20)
                .execute()
            )
            conversation_history = [
                {"role": m["role"], "content": m["content"]}
                for m in (history.data or [])
            ]

            from app.services.agent.orchestrator import orchestrate

            try:
                result = await orchestrate(
                    user_id=user_id,
                    message=content,
                    conversation_history=conversation_history[:-1],
                )

                # Send response in chunks (simulating streaming)
                response_text = result["content"]
                chunk_size = 50  # characters per chunk
                for i in range(0, len(response_text), chunk_size):
                    chunk = response_text[i:i + chunk_size]
                    await websocket.send_json({"type": "chunk", "content": chunk})

                # Save assistant message
                msg = supabase.table("messages").insert({
                    "conversation_id": conversation_id,
                    "role": "assistant",
                    "content": response_text,
                    "sources": result.get("sources", []),
                }).execute()

                # Send done signal
                await websocket.send_json({
                    "type": "done",
                    "message": msg.data[0],
                    "sources": result.get("sources", []),
                })

            except Exception as e:
                await websocket.send_json({"type": "error", "detail": str(e)})

    except WebSocketDisconnect:
        pass
