"""
Prompt Builder — assembles the final system prompt for the AI agent
by loading modular .prompt.txt templates and injecting dynamic context.
"""

from typing import Optional
from datetime import datetime

from app.db.supabase_client import get_supabase_admin
from app.services.agent.prompts import load_prompt


async def build_system_prompt(
    user_id: str,
    retrieved_context: Optional[list[dict]] = None,
) -> str:
    """
    Build the complete 4-layer system prompt for the AI agent.

    Layers:
    1. Identity  — who the agent is (from system_identity.prompt.txt)
    2. User Profile — dynamic stats from database
    3. Retrieved Context — relevant note chunks from RAG
    4. Behavioral Rules — hard output constraints (from system_rules.prompt.txt)
    """
    supabase = get_supabase_admin()

    # ── Layer 2: User Profile (dynamic) ────────────────────────────────────
    user_result = supabase.table("users").select("name, email").eq("id", user_id).single().execute()
    user_name = user_result.data.get("name", "User") if user_result.data else "User"
    user_email = user_result.data.get("email", "Unknown") if user_result.data else "Unknown"

    note_count_result = (
        supabase.table("notes")
        .select("id", count="exact")
        .eq("user_id", user_id)
        .eq("is_archived", False)
        .execute()
    )
    note_count = note_count_result.count or 0

    tags_result = supabase.table("note_tags").select("tags(name)").execute()
    tag_counts: dict[str, int] = {}
    if tags_result.data:
        for row in tags_result.data:
            tag_name = row.get("tags", {}).get("name", "")
            if tag_name:
                tag_counts[tag_name] = tag_counts.get(tag_name, 0) + 1
    top_tags = sorted(tag_counts.keys(), key=lambda t: tag_counts[t], reverse=True)[:10]

    user_profile = f"""## User Profile
- Name: {user_name}
- Total notes in knowledge base: {note_count}
- Most used tags: {', '.join(top_tags) if top_tags else 'None yet'}"""

    # ── Layer 3: Retrieved Context (dynamic) ────────────────────────────────
    context_section = ""
    if retrieved_context:
        context_parts = ["<retrieved_notes>"]
        for ctx in retrieved_context:
            source_url_tag = (
                f"\n  <source_url>{ctx['source_url']}</source_url>"
                if ctx.get("source_url")
                else ""
            )
            context_parts.append(f"""
<note index="{ctx['index']}" note_id="{ctx['note_id']}">
  <title>{ctx['title']}</title>
  <type>{ctx['content_type']}</type>{source_url_tag}
  <date>{ctx.get('created_at', 'unknown')}</date>
  <tags>{', '.join(ctx.get('tags', []))}</tags>
  <content>{ctx['content']}</content>
</note>""")
        context_parts.append("</retrieved_notes>")
        context_section = "\n".join(context_parts)

    # ── Assemble prompt from .txt templates ─────────────────────────────────
    identity_template = load_prompt("system_identity")
    rules_template = load_prompt("system_rules")

    identity = identity_template.format(
        user_name=user_name,
        user_email=user_email,
        current_datetime=datetime.now().strftime("%Y-%m-%d %H:%M:%S (%A)"),
        user_profile=user_profile,
        retrieved_context=(
            f"\n## Relevant Notes from Knowledge Base\n{context_section}"
            if context_section
            else "(No notes retrieved for this query.)"
        ),
    )

    return f"{identity}\n\n{rules_template}"


def build_decomposition_prompt() -> str:
    """
    Return the system prompt for the Planner (task decomposition).
    Loaded from planner.prompt.txt.
    """
    return load_prompt("planner")
