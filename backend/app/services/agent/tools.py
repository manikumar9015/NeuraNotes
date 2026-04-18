"""
Agent Tools — the 6 tools available to the NeuraNotes AI agent.
Each tool is a narrow, reliable function that the agent can call.
"""

from typing import Optional

from app.db.supabase_client import get_supabase_admin
from app.services.ai_client import get_ai_client


async def search_notes(
    user_id: str,
    query: str,
    content_type: Optional[str] = None,
    limit: int = 5,
) -> dict:
    """Search the user's knowledge base semantically."""
    from app.services.retrieval_service import semantic_search

    results = await semantic_search(
        query=query,
        user_id=user_id,
        content_type=content_type,
        limit=limit,
    )

    return {
        "tool": "search_notes",
        "success": True,
        "results": [
            {
                "note_id": r.note_id,
                "title": r.title,
                "content": r.content_snippet,
                "similarity": r.similarity,
                "tags": r.tags,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in results
        ],
        "count": len(results),
    }


async def create_note(
    user_id: str,
    title: str,
    content: str,
    tags: Optional[list[str]] = None,
) -> dict:
    """Save a new note to the knowledge base."""
    from app.services.capture_service import capture_text

    note = await capture_text(
        user_id=user_id,
        content=content,
        title=title,
        tags=tags or [],
    )

    return {
        "tool": "create_note",
        "success": True,
        "note_id": note["id"],
        "title": note.get("title", title),
        "message": f"Note '{title}' saved successfully",
    }


async def summarize_notes(
    user_id: str,
    content: str,
    style: str = "brief",
) -> dict:
    """Generate a summary from provided content."""
    ai_client = get_ai_client()

    style_instructions = {
        "brief": "Write a concise 2-3 sentence summary.",
        "detailed": "Write a comprehensive summary covering all key points in 2-3 paragraphs.",
        "bullet_points": "Summarize as a bulleted list of key points (5-10 bullets).",
    }

    prompt = f"""Summarize the following content.
Style: {style_instructions.get(style, style_instructions['brief'])}

Content to summarize:
{content}"""

    response = await ai_client.chat(
        system_prompt="You are a precise summarization assistant. Output only the summary.",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=800,
    )

    return {
        "tool": "summarize_notes",
        "success": True,
        "summary": response["content"],
        "style": style,
    }


async def generate_flashcards(
    user_id: str,
    content: str,
    count: int = 5,
) -> dict:
    """Generate study flashcards from content."""
    ai_client = get_ai_client()

    prompt = f"""Generate exactly {count} flashcards from the following content.
Each flashcard should have a clear question on the front and a concise answer on the back.

Content:
{content}

Output as a JSON array:
[{{"front": "question", "back": "answer"}}]

Output ONLY the JSON array, nothing else."""

    response = await ai_client.chat(
        system_prompt="You are a flashcard generation assistant. Output only valid JSON.",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=1500,
        temperature=0.5,
        response_format={"type": "json_object"},
    )

    # Parse flashcards
    try:
        import json
        content_text = response["content"].strip()
        # Handle both direct array and wrapped object
        parsed = json.loads(content_text)
        if isinstance(parsed, dict):
            flashcards = parsed.get("flashcards", parsed.get("cards", []))
        elif isinstance(parsed, list):
            flashcards = parsed
        else:
            flashcards = []
    except (json.JSONDecodeError, Exception):
        flashcards = []

    return {
        "tool": "generate_flashcards",
        "success": True,
        "flashcards": flashcards[:count],
        "count": len(flashcards[:count]),
    }


async def create_calendar_event(
    user_id: str,
    title: str,
    date: str,
    time: Optional[str] = None,
    description: Optional[str] = None,
) -> dict:
    """
    Create a calendar event.
    Parses details and creates a real event in the user's primary Google Calendar.
    """
    from app.services.calendar_service import create_google_calendar_event
    
    result = await create_google_calendar_event(
        user_id=user_id,
        title=title,
        date_str=date,
        time_str=time,
        description=description
    )
    
    if result["success"]:
        return {
            "tool": "create_calendar_event",
            "success": True,
            "event_id": result["event_id"],
            "html_link": result["html_link"],
            "message": f"📅 {result['message']}",
            "note": f"You can view the event here: {result['html_link']}",
        }
    else:
        return {
            "tool": "create_calendar_event",
            "success": False,
            "error": result["error"],
            "message": f"❌ I couldn't create the calendar event: {result['error']}",
        }


async def draft_email(
    user_id: str,
    to: str,
    subject: str,
    body_context: str,
) -> dict:
    """
    Draft an email based on context.
    Uses AI to generate a professional email draft and creates it in the user's Gmail.
    """
    from app.services.gmail_service import create_gmail_draft
    ai_client = get_ai_client()

    prompt = f"""Draft a professional email with the following details:
To: {to}
Subject: {subject}
Context/Notes: {body_context}

Write a clear, professional email body. Do not include the To/Subject headers in your output."""

    response = await ai_client.chat(
        system_prompt="You are an email drafting assistant. Write clear, professional emails.",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=600,
    )

    draft_content = response["content"]

    # Try to create a real Gmail draft
    gmail_result = await create_gmail_draft(
        user_id=user_id,
        to=to,
        subject=subject,
        body=draft_content
    )

    if gmail_result["success"]:
        return {
            "tool": "draft_email",
            "success": True,
            "draft": {
                "to": to,
                "subject": subject,
                "body": draft_content,
                "draft_id": gmail_result["draft_id"]
            },
            "message": f"📧 Email draft to {to} has been created in your Gmail account (Draft ID: {gmail_result['draft_id']}).",
        }
    else:
        return {
            "tool": "draft_email",
            "success": True, # Still success because we generated the draft text
            "draft": {
                "to": to,
                "subject": subject,
                "body": draft_content,
            },
            "message": f"📧 I've drafted an email to {to}, but couldn't create it in your Gmail: {gmail_result['error']}.",
            "note": "You can manually copy and send the draft below.",
        }


# ── Tool Registry ──────────────────────────────────────────

TOOL_REGISTRY = {
    "search_notes": search_notes,
    "create_note": create_note,
    "summarize_notes": summarize_notes,
    "generate_flashcards": generate_flashcards,
    "create_calendar_event": create_calendar_event,
    "draft_email": draft_email,
}


async def execute_tool(tool_name: str, user_id: str, parameters: dict) -> dict:
    """Execute a tool by name with given parameters."""
    if tool_name not in TOOL_REGISTRY:
        return {
            "tool": tool_name,
            "success": False,
            "error": f"Unknown tool: {tool_name}",
        }

    tool_fn = TOOL_REGISTRY[tool_name]

    try:
        result = await tool_fn(user_id=user_id, **parameters)
        return result
    except Exception as e:
        return {
            "tool": tool_name,
            "success": False,
            "error": str(e),
        }
