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


async def _generate_title(user_message: str, assistant_response: str) -> str:
    """Generate a short title for a new conversation based on the first exchange."""
    from app.services.ai_client import get_ai_client
    ai_client = get_ai_client()
    
    prompt = f"""Generate a short 4-6 word title for this conversation. Output ONLY the title, no quotes.

User: {user_message}
Assistant: {assistant_response}"""

    response = await ai_client.chat(
        system_prompt="You are a title generator. Output only a short 4-6 word title.",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.3,
        max_tokens=20,
    )
    
    title = response["content"].strip().strip('"\'*')
    return title


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
        title = await _generate_title(body.content, result["content"])
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
    print(f"\n{'='*60}")
    print(f"[WS DEBUG] WebSocket connection request for conversation: {conversation_id}")
    await websocket.accept()
    print(f"[WS DEBUG] WebSocket ACCEPTED")

    try:
        while True:
            # Receive message from client
            print(f"[WS DEBUG] Waiting for client message...")
            data = await websocket.receive_json()
            content = data.get("content", "")
            token = data.get("token", "")
            print(f"[WS DEBUG] Received message: '{content[:50]}...' | Token present: {bool(token)}")

            if not content:
                print(f"[WS DEBUG] ERROR: Empty message")
                await websocket.send_json({"type": "error", "detail": "Empty message"})
                continue

            # Validate token
            from app.core.security import verify_token
            payload = verify_token(token)
            if not payload:
                print(f"[WS DEBUG] ERROR: Invalid token")
                await websocket.send_json({"type": "error", "detail": "Invalid token"})
                continue

            user_id = payload.get("sub")
            print(f"[WS DEBUG] Token valid. User ID: {user_id}")
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
                print(f"[WS DEBUG] ERROR: Conversation not found for user {user_id}")
                await websocket.send_json({"type": "error", "detail": "Conversation not found"})
                continue
            print(f"[WS DEBUG] Conversation ownership verified")

            # Save user message
            user_msg = supabase.table("messages").insert({
                "conversation_id": conversation_id,
                "role": "user",
                "content": content,
            }).execute()
            print(f"[WS DEBUG] User message saved to DB: {user_msg.data[0]['id']}")

            # Send processing indicator
            await websocket.send_json({"type": "status", "content": "Processing your request..."})
            print(f"[WS DEBUG] Sent 'Processing' status to client")

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
            print(f"[WS DEBUG] Loaded {len(conversation_history)} messages from history")

            from app.services.agent.orchestrator import orchestrate

            try:
                print(f"[WS DEBUG] Calling orchestrate()...")
                result = await orchestrate(
                    user_id=user_id,
                    message=content,
                    conversation_history=conversation_history[:-1],
                )
                print(f"[WS DEBUG] orchestrate() returned successfully!")
                print(f"[WS DEBUG]   - Content length: {len(result.get('content', ''))}")
                print(f"[WS DEBUG]   - Sources count: {len(result.get('sources', []))}")
                print(f"[WS DEBUG]   - Has execution_plan: {bool(result.get('execution_plan'))}")

                # Send response in chunks (simulating streaming)
                response_text = result["content"]
                chunk_size = 50  # characters per chunk
                for i in range(0, len(response_text), chunk_size):
                    chunk = response_text[i:i + chunk_size]
                    await websocket.send_json({"type": "chunk", "content": chunk})
                print(f"[WS DEBUG] All chunks sent to client")

                # Save assistant message
                msg_data = {
                    "conversation_id": conversation_id,
                    "role": "assistant",
                    "content": response_text,
                    "sources": result.get("sources", []),
                }
                
                # If there's an execution plan, include the subtasks
                subtasks = []
                if result.get("execution_plan"):
                    subtasks = result["execution_plan"].get("subtasks", [])
                    msg_data["subtasks"] = subtasks
                    
                print(f"[WS DEBUG] Saving assistant message to DB...")
                msg = supabase.table("messages").insert(msg_data).execute()
                print(f"[WS DEBUG] Assistant message saved: {msg.data[0]['id']}")

                # Send done signal
                assistant_msg_response = msg.data[0]
                if subtasks and "subtasks" not in assistant_msg_response:
                    assistant_msg_response["subtasks"] = subtasks

                await websocket.send_json({
                    "type": "done",
                    "user_message": user_msg.data[0],
                    "assistant_message": assistant_msg_response,
                    "sources": result.get("sources", []),
                })
                print(f"[WS DEBUG] 'done' signal sent to client. SUCCESS!")

                # Update conversation title if it's the first real message
                if len(conversation_history) <= 2:
                    print(f"[WS DEBUG] Generating title for new conversation...")
                    title = await _generate_title(content, response_text)
                    supabase.table("conversations").update(
                        {"title": title}
                    ).eq("id", conversation_id).execute()
                    print(f"[WS DEBUG] Title set: '{title}'")

            except Exception as e:
                import traceback
                print(f"\n[WS DEBUG] !!!!! EXCEPTION IN ORCHESTRATOR !!!!!")
                print(f"[WS DEBUG] Error type: {type(e).__name__}")
                print(f"[WS DEBUG] Error message: {str(e)}")
                traceback.print_exc()
                await websocket.send_json({"type": "error", "detail": str(e)})

    except WebSocketDisconnect:
        print(f"[WS DEBUG] Client disconnected")
    except Exception as e:
        import traceback
        print(f"\n[WS DEBUG] !!!!! OUTER EXCEPTION !!!!!")
        print(f"[WS DEBUG] Error type: {type(e).__name__}")
        print(f"[WS DEBUG] Error message: {str(e)}")
        traceback.print_exc()
