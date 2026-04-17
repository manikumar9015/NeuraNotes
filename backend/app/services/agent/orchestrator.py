"""
Orchestrator — the entry point for all AI interactions.
Classifies user intent and routes to the appropriate handler:
  - Simple queries → direct LLM response
  - Knowledge retrieval → RAG pipeline
  - Complex tasks → Planner → Executor → Synthesizer
"""

import json
from typing import Optional

from app.models.conversation import ExecutionPlan, Subtask, SubtaskStatus
from app.services.ai_client import get_ai_client
from app.services.agent.prompt_builder import build_system_prompt
from app.services.retrieval_service import retrieve_context_for_agent


async def orchestrate(
    user_id: str,
    message: str,
    conversation_history: list[dict],
) -> dict:
    """
    Main entry point for processing user messages.
    
    Flow:
    1. Classify intent and complexity
    2. Route to appropriate handler
    3. Return response with metadata
    
    Returns:
        {
            "content": str,           # The AI response
            "sources": list[dict],    # Referenced notes
            "execution_plan": dict,   # Subtask trace (if complex)
        }
    """
    # Step 1: Classify the intent
    complexity = await _classify_intent(message, conversation_history)

    if complexity == "simple":
        # Direct response — no RAG, no decomposition
        return await _handle_simple(user_id, message, conversation_history)

    elif complexity == "retrieval":
        # Single-step RAG — retrieve context, generate response
        return await _handle_retrieval(user_id, message, conversation_history)

    elif complexity == "complex":
        # Multi-step — decompose into subtasks, execute each, synthesize
        return await _handle_complex(user_id, message, conversation_history)

    else:
        # Fallback to retrieval
        return await _handle_retrieval(user_id, message, conversation_history)


async def _classify_intent(
    message: str,
    conversation_history: list[dict],
) -> str:
    """
    Classify the complexity of a user message.
    Uses a fast LLM call with constrained output.
    
    Returns: "simple" | "retrieval" | "complex"
    """
    ai_client = get_ai_client()

    classify_prompt = """Classify this user message into exactly one category:

- "simple": Greetings, small talk, simple questions that don't need the knowledge base
  Examples: "Hi", "How are you?", "What can you do?", "Thanks"

- "retrieval": Questions that need to search the user's notes/knowledge base (single step)
  Examples: "What did I learn about X?", "Find my notes on Y", "What are my notes about Z?"

- "complex": Multi-part requests that need multiple steps or tools
  Examples: "Summarize my ML notes and create flashcards", "Find my notes about X, then schedule a study session"

Respond with ONLY the category word: simple, retrieval, or complex"""

    response = await ai_client.chat(
        system_prompt=classify_prompt,
        messages=[{"role": "user", "content": message}],
        temperature=0.1,
        max_tokens=20,
    )

    result = response["content"].strip().lower().strip('"\'.')
    if result in ("simple", "retrieval", "complex"):
        return result
    # Default to retrieval for ambiguous cases
    return "retrieval"


async def _handle_simple(
    user_id: str,
    message: str,
    conversation_history: list[dict],
) -> dict:
    """Handle simple queries with a direct LLM response (no RAG)."""
    ai_client = get_ai_client()
    system_prompt = await build_system_prompt(user_id)

    response = await ai_client.chat(
        system_prompt=system_prompt,
        messages=conversation_history + [{"role": "user", "content": message}],
        max_tokens=500,
    )

    return {
        "content": response["content"],
        "sources": [],
        "execution_plan": None,
    }


async def _handle_retrieval(
    user_id: str,
    message: str,
    conversation_history: list[dict],
) -> dict:
    """Handle knowledge retrieval with RAG pipeline."""
    ai_client = get_ai_client()

    # Retrieve relevant context
    context_chunks = await retrieve_context_for_agent(
        query=message,
        user_id=user_id,
        limit=5,
    )

    # Build prompt with retrieved context
    system_prompt = await build_system_prompt(
        user_id=user_id,
        retrieved_context=context_chunks,
    )

    response = await ai_client.chat(
        system_prompt=system_prompt,
        messages=conversation_history + [{"role": "user", "content": message}],
        max_tokens=1024,
    )

    # Extract source references
    sources = [
        {"note_id": ctx["note_id"], "title": ctx["title"], "similarity": ctx["similarity"]}
        for ctx in context_chunks
    ]

    return {
        "content": response["content"],
        "sources": sources,
        "execution_plan": None,
    }


async def _handle_complex(
    user_id: str,
    message: str,
    conversation_history: list[dict],
) -> dict:
    """
    Handle complex multi-step requests using the full
    Orchestrator → Planner → Executor → Synthesizer pipeline.
    """
    from app.services.agent.planner import decompose_task
    from app.services.agent.executor import execute_plan
    from app.services.agent.synthesizer import synthesize_results

    # Step 1: Decompose into subtasks
    plan = await decompose_task(message, conversation_history)

    # Step 2: Execute each subtask
    completed_plan = await execute_plan(
        plan=plan,
        user_id=user_id,
    )

    # Step 3: Synthesize results into final response
    final_response = await synthesize_results(
        plan=completed_plan,
        original_query=message,
        user_id=user_id,
    )

    # Collect all sources from search results
    sources = []
    for subtask in completed_plan.subtasks:
        if subtask.result and isinstance(subtask.result, dict):
            for result_item in subtask.result.get("results", []):
                if isinstance(result_item, dict) and "note_id" in result_item:
                    sources.append({
                        "note_id": result_item["note_id"],
                        "title": result_item.get("title"),
                        "similarity": result_item.get("similarity"),
                    })

    return {
        "content": final_response,
        "sources": sources,
        "execution_plan": completed_plan.model_dump(),
    }
