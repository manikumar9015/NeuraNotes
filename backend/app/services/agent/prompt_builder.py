"""
Prompt Builder — constructs the dynamic 4-layer system prompt for the AI agent.
Personalizes context based on user profile and retrieved notes.
"""

from typing import Optional

from app.db.supabase_client import get_supabase_admin


# ── Layer 1: Identity (static) ─────────────────────────────
IDENTITY_PROMPT = """You are NeuraNotes, a personal knowledge assistant for {user_name}.
Your role is to help them capture, organize, retrieve, and generate value from their personal knowledge base.

You are intelligent, concise, and always cite your sources when referencing stored knowledge.
You format responses for mobile reading — short paragraphs, bullet points, and markdown."""


# ── Layer 4: Behavioral Rules (static) ─────────────────────
BEHAVIORAL_RULES = """
## Rules
- Always cite source notes when referencing stored knowledge using [Source: note_title]
- If information is not in the knowledge base, say so clearly — never fabricate
- Suggest capturing new information when the user mentions something worth remembering
- Respond concisely for mobile reading (short paragraphs, bullet points)
- Use markdown formatting for readability
- When performing multiple tasks, report progress on each subtask
- If a subtask fails, continue with remaining subtasks and report partial results"""


async def build_system_prompt(
    user_id: str,
    retrieved_context: Optional[list[dict]] = None,
) -> str:
    """
    Build the complete 4-layer system prompt for the AI agent.
    
    Layers:
    1. Identity — who the agent is
    2. User Profile — dynamic stats from database
    3. Retrieved Context — relevant note chunks (from RAG)
    4. Behavioral Rules — how to respond
    """
    supabase = get_supabase_admin()

    # ── Layer 2: User Profile (dynamic) ─────────────────────
    user_result = supabase.table("users").select("name").eq("id", user_id).single().execute()
    user_name = user_result.data.get("name", "User") if user_result.data else "User"

    # Get note count
    note_count_result = (
        supabase.table("notes")
        .select("id", count="exact")
        .eq("user_id", user_id)
        .eq("is_archived", False)
        .execute()
    )
    note_count = note_count_result.count or 0

    # Get top tags
    tags_result = (
        supabase.table("note_tags")
        .select("tags(name)")
        .execute()
    )
    tag_counts = {}
    if tags_result.data:
        for row in tags_result.data:
            tag_name = row.get("tags", {}).get("name", "")
            if tag_name:
                tag_counts[tag_name] = tag_counts.get(tag_name, 0) + 1
    top_tags = sorted(tag_counts.keys(), key=lambda t: tag_counts[t], reverse=True)[:10]

    # Build Layer 2
    user_profile = f"""
## User Profile
- Name: {user_name}
- Total notes in knowledge base: {note_count}
- Most used tags: {', '.join(top_tags) if top_tags else 'None yet'}"""

    # ── Layer 3: Retrieved Context (dynamic) ────────────────
    context_section = ""
    if retrieved_context:
        context_parts = ["<retrieved_notes>"]
        for ctx in retrieved_context:
            context_parts.append(f"""
<note index="{ctx['index']}" note_id="{ctx['note_id']}">
  <title>{ctx['title']}</title>
  <type>{ctx['content_type']}</type>
  <date>{ctx.get('created_at', 'unknown')}</date>
  <tags>{', '.join(ctx.get('tags', []))}</tags>
  <content>{ctx['content']}</content>
</note>""")
        context_parts.append("</retrieved_notes>")
        context_section = "\n".join(context_parts)

    # ── Assemble Full Prompt ────────────────────────────────
    parts = [
        IDENTITY_PROMPT.format(user_name=user_name),
        user_profile,
    ]

    if context_section:
        parts.append(f"\n## Relevant Notes from Knowledge Base\n{context_section}")

    parts.append(BEHAVIORAL_RULES)

    return "\n\n".join(parts)


def build_decomposition_prompt() -> str:
    """
    Build the system prompt for the Planner (task decomposition).
    This prompt instructs the LLM to break complex queries into subtasks.
    """
    return """You are a task planning agent for a personal knowledge assistant called NeuraNotes.

Given a user's request, analyze it and break it down into atomic subtasks that can be executed sequentially.

## Available Tools
1. **search_notes** — Search the user's knowledge base semantically
   Parameters: query (str), content_type (optional str), limit (optional int)

2. **create_note** — Save new content to the knowledge base
   Parameters: title (str), content (str), tags (list[str])

3. **summarize_notes** — Generate a summary from retrieved notes
   Parameters: content (str), style (str: "brief" | "detailed" | "bullet_points")

4. **generate_flashcards** — Create study flashcards from content
   Parameters: content (str), count (int)

5. **create_calendar_event** — Schedule an event
   Parameters: title (str), date (str), time (optional str), description (optional str)

6. **draft_email** — Draft an email based on context
   Parameters: to (str), subject (str), body_context (str)

7. **direct_response** — Respond directly without using any tool
   Parameters: message (str)

## Rules
1. Each subtask must use exactly ONE tool
2. Order subtasks by dependency (prerequisite subtasks first)
3. Keep subtasks atomic — one clear action each
4. If a subtask needs output from another, specify it in depends_on
5. For simple queries (greetings, quick answers), use a single direct_response subtask
6. Always output valid JSON

## Output Format
Respond with a JSON object:
{
  "complexity": "simple" | "retrieval" | "complex",
  "subtasks": [
    {
      "id": "s1",
      "description": "Human-readable description of this step",
      "tool_name": "tool_name_here",
      "parameters": { ... },
      "depends_on": []
    }
  ]
}"""
