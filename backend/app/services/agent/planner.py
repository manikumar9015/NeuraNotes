"""
Planner — decomposes complex user queries into ordered subtasks.
Uses the LLM with structured output to create an execution plan.
"""

import json

from app.models.conversation import ExecutionPlan, Subtask, SubtaskStatus
from app.services.ai_client import get_ai_client
from app.services.agent.prompt_builder import build_decomposition_prompt


async def decompose_task(
    message: str,
    conversation_history: list[dict],
) -> ExecutionPlan:
    """
    Break a complex user request into atomic subtasks.
    
    Uses the LLM with the decomposition prompt to produce a structured
    execution plan with dependencies.
    
    Args:
        message: The user's complex request
        conversation_history: Recent conversation context
        
    Returns:
        ExecutionPlan with ordered subtasks
    """
    ai_client = get_ai_client()
    system_prompt = build_decomposition_prompt()

    # Include recent conversation context for continuity
    context_messages = conversation_history[-4:] if conversation_history else []
    context_messages.append({"role": "user", "content": message})

    response = await ai_client.chat(
        system_prompt=system_prompt,
        messages=context_messages,
        temperature=0.3,  # Low temperature for reliable structured output
        max_tokens=1500,
        response_format={"type": "json_object"},
    )

    # Parse the plan
    try:
        plan_data = json.loads(response["content"])
    except json.JSONDecodeError:
        # Fallback: treat as a simple retrieval task
        return ExecutionPlan(
            original_query=message,
            complexity="retrieval",
            subtasks=[
                Subtask(
                    id="s1",
                    description="Search knowledge base for relevant notes",
                    tool_name="search_notes",
                    parameters={"query": message},
                ),
                Subtask(
                    id="s2",
                    description="Generate response from retrieved context",
                    tool_name="direct_response",
                    parameters={"message": message},
                    depends_on=["s1"],
                ),
            ],
        )

    # Build ExecutionPlan from parsed JSON
    subtasks = []
    for st_data in plan_data.get("subtasks", []):
        subtask = Subtask(
            id=st_data.get("id", f"s{len(subtasks) + 1}"),
            description=st_data.get("description", ""),
            tool_name=st_data.get("tool_name", "direct_response"),
            parameters=st_data.get("parameters", {}),
            depends_on=st_data.get("depends_on", []),
            status=SubtaskStatus.PENDING,
        )
        subtasks.append(subtask)

    # Validate: ensure no circular dependencies
    subtask_ids = {st.id for st in subtasks}
    for st in subtasks:
        st.depends_on = [dep for dep in st.depends_on if dep in subtask_ids]

    plan = ExecutionPlan(
        original_query=message,
        complexity=plan_data.get("complexity", "complex"),
        subtasks=subtasks,
    )

    # Validate DAG (no cycles)
    _validate_dag(plan)

    return plan


def _validate_dag(plan: ExecutionPlan) -> None:
    """Ensure the subtask dependency graph has no cycles."""
    visited = set()
    in_progress = set()

    def dfs(task_id: str):
        if task_id in in_progress:
            raise ValueError(f"Circular dependency detected at task {task_id}")
        if task_id in visited:
            return

        in_progress.add(task_id)
        task = next((t for t in plan.subtasks if t.id == task_id), None)
        if task:
            for dep in task.depends_on:
                dfs(dep)
        in_progress.remove(task_id)
        visited.add(task_id)

    for subtask in plan.subtasks:
        dfs(subtask.id)
