"""
Executor — processes subtasks in dependency order, accumulating context.
Each subtask calls the appropriate tool and stores its result.
"""

from app.models.conversation import ExecutionPlan, Subtask, SubtaskStatus
from app.services.agent.tools import execute_tool
from app.services.ai_client import get_ai_client


async def execute_plan(
    plan: ExecutionPlan,
    user_id: str,
) -> ExecutionPlan:
    """
    Execute all subtasks in the plan in dependency order.
    
    Algorithm:
    1. Find subtasks whose dependencies are all completed
    2. Execute them (could be parallel, but sequential for simplicity)
    3. Store results in the subtask
    4. Repeat until all done or all remaining have failed dependencies
    
    Returns the plan with all subtasks updated with results/errors.
    """
    max_iterations = len(plan.subtasks) * 2  # Safety guard against infinite loops
    iteration = 0

    while iteration < max_iterations:
        iteration += 1

        # Find executable subtasks (pending, with all deps completed)
        executable = _get_executable_subtasks(plan)

        if not executable:
            break  # All done or blocked

        for subtask in executable:
            subtask.status = SubtaskStatus.RUNNING

            try:
                if subtask.tool_name == "direct_response":
                    # Direct response doesn't call a tool — it uses LLM
                    result = await _handle_direct_response(
                        subtask=subtask,
                        plan=plan,
                        user_id=user_id,
                    )
                else:
                    # Enrich parameters with results from dependencies
                    enriched_params = _enrich_parameters(subtask, plan)
                    result = await execute_tool(
                        tool_name=subtask.tool_name,
                        user_id=user_id,
                        parameters=enriched_params,
                    )

                subtask.result = result
                subtask.status = SubtaskStatus.COMPLETED

            except Exception as e:
                subtask.error = str(e)
                subtask.status = SubtaskStatus.FAILED
                print(f"⚠️ Subtask {subtask.id} failed: {e}")

    return plan


def _get_executable_subtasks(plan: ExecutionPlan) -> list[Subtask]:
    """Find subtasks that are pending and have all dependencies completed."""
    executable = []
    for subtask in plan.subtasks:
        if subtask.status != SubtaskStatus.PENDING:
            continue

        # Check if all dependencies are completed
        deps_met = all(
            _get_subtask_by_id(plan, dep_id) is not None
            and _get_subtask_by_id(plan, dep_id).status == SubtaskStatus.COMPLETED
            for dep_id in subtask.depends_on
        )

        # Also check for failed dependencies (skip these subtasks)
        deps_failed = any(
            _get_subtask_by_id(plan, dep_id) is not None
            and _get_subtask_by_id(plan, dep_id).status == SubtaskStatus.FAILED
            for dep_id in subtask.depends_on
        )

        if deps_failed:
            subtask.status = SubtaskStatus.FAILED
            subtask.error = "Dependency failed"
            continue

        if deps_met:
            executable.append(subtask)

    return executable


def _get_subtask_by_id(plan: ExecutionPlan, task_id: str) -> Subtask | None:
    """Find a subtask by ID."""
    for st in plan.subtasks:
        if st.id == task_id:
            return st
    return None


def _enrich_parameters(subtask: Subtask, plan: ExecutionPlan) -> dict:
    """
    Enrich subtask parameters with results from completed dependency subtasks.
    
    For example, if subtask S3 (summarize) depends on S1 (search_notes),
    inject the search results into S3's 'content' parameter.
    """
    params = subtask.parameters.copy()

    for dep_id in subtask.depends_on:
        dep_task = _get_subtask_by_id(plan, dep_id)
        if dep_task and dep_task.result:
            result = dep_task.result

            # If the dependency was a search, inject results as content
            if dep_task.tool_name == "search_notes" and isinstance(result, dict):
                search_results = result.get("results", [])
                if search_results:
                    # Concatenate search results as content
                    content_parts = []
                    for r in search_results:
                        title = r.get("title", "Untitled")
                        content = r.get("content", "")
                        content_parts.append(f"## {title}\n{content}")

                    combined_content = "\n\n---\n\n".join(content_parts)

                    # Inject into appropriate parameter
                    if "content" not in params or not params["content"]:
                        params["content"] = combined_content
                    if "body_context" in params and not params["body_context"]:
                        params["body_context"] = combined_content

            # If dependency was a summarize, inject summary as content
            elif dep_task.tool_name == "summarize_notes" and isinstance(result, dict):
                summary = result.get("summary", "")
                if summary and "content" not in params:
                    params["content"] = summary

    return params


async def _handle_direct_response(
    subtask: Subtask,
    plan: ExecutionPlan,
    user_id: str,
) -> dict:
    """Handle a direct_response subtask using the AI client."""
    ai_client = get_ai_client()

    # Gather context from completed subtasks
    context_parts = []
    for dep_id in subtask.depends_on:
        dep = _get_subtask_by_id(plan, dep_id)
        if dep and dep.result:
            context_parts.append(f"Result from '{dep.description}':\n{_format_result(dep.result)}")

    message = subtask.parameters.get("message", plan.original_query)
    if context_parts:
        message = f"{message}\n\nContext from previous steps:\n" + "\n\n".join(context_parts)

    from app.services.agent.prompt_builder import build_system_prompt
    system_prompt = await build_system_prompt(user_id)

    response = await ai_client.chat(
        system_prompt=system_prompt,
        messages=[{"role": "user", "content": message}],
        max_tokens=1024,
    )

    return {
        "tool": "direct_response",
        "success": True,
        "content": response["content"],
    }


def _format_result(result: dict) -> str:
    """Format a tool result for context injection."""
    if not isinstance(result, dict):
        return str(result)

    tool_name = result.get("tool", "unknown")

    if tool_name == "search_notes":
        items = result.get("results", [])
        if items:
            parts = [f"- {r.get('title', 'Untitled')}: {r.get('content', '')[:200]}" for r in items]
            return "\n".join(parts)
        return "No results found."

    elif tool_name == "summarize_notes":
        return result.get("summary", "No summary available.")

    elif tool_name == "generate_flashcards":
        cards = result.get("flashcards", [])
        parts = [f"Q: {c.get('front', '')} → A: {c.get('back', '')}" for c in cards]
        return "\n".join(parts)

    elif tool_name == "create_note":
        return result.get("message", "Note created.")

    elif tool_name == "create_calendar_event":
        return result.get("message", "Event created.")

    elif tool_name == "draft_email":
        draft = result.get("draft", {})
        return f"To: {draft.get('to', '')}\nSubject: {draft.get('subject', '')}\n\n{draft.get('body', '')}"

    return str(result)
