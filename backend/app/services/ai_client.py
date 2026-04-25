"""
AI Client Abstraction — swap AI providers with one env var.
Supports Groq (free: Llama 3.3 70B + GPT-OSS 120B + Whisper) and Claude (paid upgrade).
"""

import json
import os
from typing import Optional

from app.core.config import settings


class BaseAIClient:
    """Abstract base for AI clients."""

    async def chat(
        self,
        system_prompt: str,
        messages: list[dict],
        tools: Optional[list[dict]] = None,
        temperature: float = 0.7,
        max_tokens: int = 1024,
        response_format: Optional[dict] = None,
    ) -> dict:
        """Send a chat completion request. Returns {"content": str, "tool_calls": list}."""
        raise NotImplementedError

    async def transcribe(self, audio_bytes: bytes, filename: str) -> str:
        """Transcribe audio to text."""
        raise NotImplementedError


class GroqClient(BaseAIClient):
    """
    Groq API client — uses llama-3.3-70b-versatile (primary) and
    openai/gpt-oss-120b (secondary/fallback). Both free.
    """

    PRIMARY_MODEL = "llama-3.3-70b-versatile"      # 12K req/day, 128K context
    SECONDARY_MODEL = "openai/gpt-oss-120b"         # 8K req/day, 200K context (auto-fallback)
    WHISPER_MODEL = "whisper-large-v3"

    def __init__(self):
        if not settings.groq_api_key:
            raise ValueError("GROQ_API_KEY must be set in .env")

    async def chat(
        self,
        system_prompt: str,
        messages: list[dict],
        tools: Optional[list[dict]] = None,
        temperature: float = 0.7,
        max_tokens: int = 1024,
        response_format: Optional[dict] = None,
        use_secondary: bool = False,
    ) -> dict:
        """
        Send chat completion to Groq API.
        
        Args:
            use_secondary: If True, uses GPT-OSS 120B instead of Llama 3.3 70B
        """
        from groq import Groq, RateLimitError, BadRequestError, PermissionDeniedError

        client = Groq(api_key=settings.groq_api_key)
        model = self.SECONDARY_MODEL if use_secondary else self.PRIMARY_MODEL
        fallback_model = self.PRIMARY_MODEL if use_secondary else self.SECONDARY_MODEL

        all_messages = [{"role": "system", "content": system_prompt}] + messages

        kwargs = {
            "model": model,
            "messages": all_messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }

        if tools:
            kwargs["tools"] = tools
            kwargs["tool_choice"] = "auto"

        if response_format:
            kwargs["response_format"] = response_format

        print(f"[AI DEBUG] Calling Groq API with model='{model}' | messages={len(all_messages)} | max_tokens={max_tokens}")
        try:
            response = client.chat.completions.create(**kwargs)
            print(f"[AI DEBUG] Primary model '{model}' succeeded!")
        except (RateLimitError, PermissionDeniedError, BadRequestError) as e:
            print(f"[AI DEBUG] Primary model '{model}' FAILED: {type(e).__name__}: {e}")
            print(f"[AI DEBUG] Falling back to '{fallback_model}'...")
            kwargs["model"] = model = fallback_model
            response = client.chat.completions.create(**kwargs)
            print(f"[AI DEBUG] Fallback model '{model}' succeeded!")

        choice = response.choices[0]
        print(f"[AI DEBUG] Response: model={model} | content_len={len(choice.message.content or '')} | usage={response.usage}")

        result = {
            "content": choice.message.content or "",
            "tool_calls": [],
            "model": model,
            "usage": {
                "prompt_tokens": response.usage.prompt_tokens if response.usage else 0,
                "completion_tokens": response.usage.completion_tokens if response.usage else 0,
            },
        }

        # Parse tool calls if present
        if choice.message.tool_calls:
            for tc in choice.message.tool_calls:
                result["tool_calls"].append({
                    "id": tc.id,
                    "name": tc.function.name,
                    "arguments": json.loads(tc.function.arguments),
                })

        return result

    async def transcribe(self, audio_bytes: bytes, filename: str) -> str:
        """Transcribe audio using Whisper via Groq (free, 2000 calls/day)."""
        from groq import Groq
        import tempfile
        import os

        client = Groq(api_key=settings.groq_api_key)

        # Write audio to temp file (Groq SDK requires file-like object)
        suffix = os.path.splitext(filename)[1] or ".webm"
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
            tmp.write(audio_bytes)
            tmp_path = tmp.name

        try:
            with open(tmp_path, "rb") as audio_file:
                transcription = client.audio.transcriptions.create(
                    model=self.WHISPER_MODEL,
                    file=audio_file,
                    response_format="text",
                )
            return transcription
        finally:
            os.unlink(tmp_path)


class ClaudeClient(BaseAIClient):
    """
    Anthropic Claude client — best quality, paid.
    Only activate when ready to upgrade from free Groq tier.
    """

    def __init__(self):
        if not settings.anthropic_api_key:
            raise ValueError("ANTHROPIC_API_KEY must be set to use Claude")

    async def chat(
        self,
        system_prompt: str,
        messages: list[dict],
        tools: Optional[list[dict]] = None,
        temperature: float = 0.7,
        max_tokens: int = 1024,
        response_format: Optional[dict] = None,
        **kwargs,
    ) -> dict:
        """Send chat completion to Claude API."""
        import anthropic

        client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

        api_kwargs = {
            "model": "claude-sonnet-4-5",
            "max_tokens": max_tokens,
            "system": system_prompt,
            "messages": messages,
            "temperature": temperature,
        }

        if tools:
            # Convert from OpenAI tool format to Claude format
            claude_tools = []
            for tool in tools:
                func = tool.get("function", tool)
                claude_tools.append({
                    "name": func["name"],
                    "description": func.get("description", ""),
                    "input_schema": func.get("parameters", {}),
                })
            api_kwargs["tools"] = claude_tools

        response = client.messages.create(**api_kwargs)

        result = {
            "content": "",
            "tool_calls": [],
            "model": "claude-sonnet-4-5",
            "usage": {
                "prompt_tokens": response.usage.input_tokens,
                "completion_tokens": response.usage.output_tokens,
            },
        }

        for block in response.content:
            if block.type == "text":
                result["content"] += block.text
            elif block.type == "tool_use":
                result["tool_calls"].append({
                    "id": block.id,
                    "name": block.name,
                    "arguments": block.input,
                })

        return result


# ── Factory Function ───────────────────────────────────────

_client_instance: Optional[BaseAIClient] = None


def get_ai_client() -> BaseAIClient:
    """Get the configured AI client based on AI_PROVIDER env var."""
    global _client_instance
    if _client_instance is None:
        provider = settings.ai_provider.lower()
        if provider == "groq":
            _client_instance = GroqClient()
        elif provider == "claude":
            _client_instance = ClaudeClient()
        else:
            raise ValueError(f"Unknown AI provider: {provider}. Use 'groq' or 'claude'.")
    return _client_instance
