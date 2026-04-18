"""
Observability Service — Langfuse integration for tracking AI traces and tool usage.
"""

from langfuse import Langfuse
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)

# Initialize Langfuse client
langfuse = None

if settings.langfuse_public_key and settings.langfuse_secret_key:
    try:
        langfuse = Langfuse(
            public_key=settings.langfuse_public_key,
            secret_key=settings.langfuse_secret_key,
            host=settings.langfuse_host
        )
        logger.info("Langfuse observability initialized.")
    except Exception as e:
        logger.error(f"Failed to initialize Langfuse: {str(e)}")
else:
    logger.warning("Langfuse keys missing. Observability is disabled.")


def get_langfuse():
    """Returns the Langfuse client if configured."""
    return langfuse

def create_trace(name: str, user_id: str):
    """Create a new trace in Langfuse."""
    if not langfuse:
        return None
    
    return langfuse.trace(
        name=name,
        user_id=user_id,
        metadata={"env": settings.app_env}
    )
