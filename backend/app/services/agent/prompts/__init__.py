"""
Prompt Loader Utility
---------------------
Provides a single helper to load .prompt.txt files from the prompts/ directory.
All prompts are cached in memory after first load to avoid repeated file I/O.

Usage:
    from app.services.agent.prompts import load_prompt

    identity = load_prompt("system_identity")
    planner  = load_prompt("planner")
"""

import os
from functools import lru_cache

PROMPTS_DIR = os.path.dirname(__file__)


@lru_cache(maxsize=None)
def load_prompt(name: str) -> str:
    """
    Load a prompt template from the prompts directory by name (without extension).
    Files must follow the naming convention: <name>.prompt.txt

    Args:
        name: The prompt filename without extension or suffix
              e.g. "system_identity" loads "system_identity.prompt.txt"

    Returns:
        The full raw text content of the prompt file.

    Raises:
        FileNotFoundError: If the named prompt file does not exist.
    """
    path = os.path.join(PROMPTS_DIR, f"{name}.prompt.txt")
    if not os.path.exists(path):
        raise FileNotFoundError(
            f"Prompt '{name}' not found. Expected file: {path}\n"
            f"Available prompts: {list_available_prompts()}"
        )
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


def list_available_prompts() -> list[str]:
    """Return the names of all available .prompt.txt files."""
    return [
        f.replace(".prompt.txt", "")
        for f in os.listdir(PROMPTS_DIR)
        if f.endswith(".prompt.txt")
    ]
