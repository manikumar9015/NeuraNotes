"""
Synthesizer — merges all subtask results into a coherent final response.
Ensures proper citations and mobile-friendly formatting.
"""

from app.models.conversation import ExecutionPlan, SubtaskStatus
from app.services.ai_client import get_ai_client
from app.services.agent.prompts import load_prompt


async def synthesize_results(
    plan: ExecutionPlan,
    original_query: str,
    user_id: str,
) -> str:
    """
    Take all completed subtask results and produce a coherent final response.
    
    If only one subtask with a direct_response, returns it directly.
    For multi-step plans, uses LLM to weave results together.
    """
    completed = [st for st in plan.subtasks if st.status == SubtaskStatus.COMPLETED]
    failed = [st for st in plan.subtasks if st.status == SubtaskStatus.FAILED]

    if not completed:
        return "I wasn't able to complete any of the steps for your request. Please try rephrasing or breaking it into smaller parts."

    # If there's only one completed subtask that's a direct response, return it
    if (
        len(completed) == 1
        and completed[0].tool_name == "direct_response"
        and isinstance(completed[0].result, dict)
    ):
        return completed[0].result.get("content", "")

    # For multi-step results, synthesize with LLM
    ai_client = get_ai_client()

    # Build context from all results
    results_context = []
    for st in completed:
        result_text = _format_subtask_result(st)
        results_context.append(f"### Step: {st.description}\n{result_text}")

    # Add failure notices
    failure_notices = ""
    if failed:
        failure_parts = [f"- {st.description}: {st.error or 'Unknown error'}" for st in failed]
        failure_notices = f"\n\n**Note:** The following steps could not be completed:\n" + "\n".join(failure_parts)

    synthesis_prompt = (
        load_prompt("synthesizer")
        + f'\n\nUser\'s original request: "{original_query}"\n\n'
        + "\n\n".join(results_context)
        + failure_notices
    )

    full_system_prompt = load_prompt("synthesizer") + "\n\n" + load_prompt("system_rules")

    response = await ai_client.chat(
        system_prompt=full_system_prompt,
        messages=[{"role": "user", "content": synthesis_prompt}],
        max_tokens=2000,
    )

    return response["content"]


def _format_subtask_result(subtask) -> str:
    """Format a subtask's result for the synthesis prompt."""
    result = subtask.result
    if not isinstance(result, dict):
        return str(result)

    tool = result.get("tool", subtask.tool_name)

    if tool == "search_notes":
        items = result.get("results", [])
        if items:
            parts = []
            for r in items:
                title = r.get("title", "Untitled")
                content = r.get("content", "")[:500]
                tags = ", ".join(r.get("tags", []))
                parts.append(f"**{title}** (tags: {tags})\n{content}")
            return "\n\n".join(parts)
        return "No relevant notes found."

    elif tool == "summarize_notes":
        return result.get("summary", "Summary unavailable.")

    elif tool == "generate_flashcards":
        cards = result.get("flashcards", [])
        if cards:
            parts = [f"**Q:** {c.get('front', '')}\n**A:** {c.get('back', '')}" for c in cards]
            return "\n\n".join(parts)
        return "No flashcards generated."

    elif tool == "create_note":
        return result.get("message", "Note saved.")

    elif tool == "create_calendar_event":
        return result.get("message", "Event created.")

    elif tool == "draft_email":
        draft = result.get("draft", {})
        return f"**To:** {draft.get('to', '')}\n**Subject:** {draft.get('subject', '')}\n\n{draft.get('body', '')}"

    elif tool == "direct_response":
        return result.get("content", "")

    return str(result)
