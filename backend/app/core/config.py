"""
NeuraNotes Configuration — loads all settings from environment variables.
Uses pydantic-settings for type-safe env var loading with validation.
"""

from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional


class Settings(BaseSettings):
    """Application settings loaded from .env file and environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── App ─────────────────────────────────────────────────
    app_env: str = "development"
    app_name: str = "NeuraNotes"
    secret_key: str = "change-me-in-production"
    allowed_origins: str = "http://localhost:3000,http://localhost:8081"

    # ── Supabase ────────────────────────────────────────────
    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_role_key: str = ""

    # ── Upstash Redis ───────────────────────────────────────
    upstash_redis_rest_url: str = ""
    upstash_redis_rest_token: str = ""

    # ── Groq API (Llama 3.3 70B + GPT-OSS 120B + Whisper) ──
    groq_api_key: str = ""

    # ── Google AI Studio (Embeddings) ──────────────────────
    google_ai_api_key: str = ""

    # ── AI Provider Switch ─────────────────────────────────
    ai_provider: str = "groq"  # "groq" (free) or "claude" (paid)

    # ── Anthropic (Optional paid upgrade) ──────────────────
    anthropic_api_key: Optional[str] = None

    # ── Langfuse (Observability) ───────────────────────────
    langfuse_public_key: str = ""
    langfuse_secret_key: str = ""
    langfuse_host: str = "https://cloud.langfuse.com"

    # ── Google OAuth ───────────────────────────────────────
    google_client_id: str = ""
    google_client_secret: str = ""
    google_redirect_uri: str = "http://localhost:8000/integrations/google/callback"
    google_token_uri: str = "https://oauth2.googleapis.com/token"

    # ── JWT ─────────────────────────────────────────────────
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 30

    @property
    def cors_origins(self) -> list[str]:
        """Parse comma-separated CORS origins into a list."""
        return [origin.strip() for origin in self.allowed_origins.split(",")]

    @property
    def is_development(self) -> bool:
        return self.app_env == "development"


# Singleton settings instance — import this everywhere
settings = Settings()
