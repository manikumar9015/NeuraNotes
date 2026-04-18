import os
from datetime import datetime, timedelta, timezone
from pathlib import Path

from app.db.supabase_client import get_supabase_admin
from app.services.ai_client import get_ai_client

def get_digest_prompt() -> str:
    prompt_path = Path(__file__).parent.parent / "prompts" / "digest.prompt.txt"
    try:
        with open(prompt_path, "r", encoding="utf-8") as f:
            return f.read()
    except FileNotFoundError:
        return "You are an AI assistant. Summarize these notes."

async def generate_daily_digest(user_id: str) -> str:
    supabase = get_supabase_admin()
    ai_client = get_ai_client()

    # Get notes from last 24 hours
    twenty_four_hours_ago = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()

    notes_result = (
        supabase.table("notes")
        .select("title, content")
        .eq("user_id", user_id)
        .gte("created_at", twenty_four_hours_ago)
        .execute()
    )

    notes = notes_result.data or []

    if not notes:
        return "It looks like you haven't captured any notes in the last 24 hours! Remember to capture any interesting links, ideas, or voice memos you come across, and I'll summarize them for you here!"

    # Format notes for prompt
    notes_text = []
    for idx, note in enumerate(notes, 1):
        title = note.get("title", "Untitled")
        content = note.get("content", "")
        # Limit content length just in case it's massive to avoid token limit overflow
        if len(content) > 3000:
            content = content[:3000] + "... [truncated]"
        notes_text.append(f"--- Note {idx} ---\nTitle: {title}\nContent:\n{content}\n")

    user_message = "\n".join(notes_text)

    # Generate digest using AI
    system_prompt = get_digest_prompt()

    try:
        response = await ai_client.chat(
            system_prompt=system_prompt,
            messages=[{"role": "user", "content": f"Here are my notes from the last 24 hours:\n\n{user_message}"}],
            temperature=0.5,
            max_tokens=2048,
        )
        return response.get("content", "Failed to generate digest.")
    except Exception as e:
        return f"An error occurred while generating your daily digest: {str(e)}"
