"""
Supabase Client — initializes and provides the Supabase client for dependency injection.
Uses the service role key for backend operations (bypasses RLS for admin tasks).
"""

from supabase import create_client, Client
from app.core.config import settings

# ── Supabase Clients ───────────────────────────────────────
# Service role client: bypasses RLS — use for backend-to-backend operations
_supabase_admin: Client | None = None

# Anon client: respects RLS — use for user-scoped operations
_supabase_anon: Client | None = None


def get_supabase_admin() -> Client:
    """Get Supabase client with service role key (bypasses RLS)."""
    global _supabase_admin
    if _supabase_admin is None:
        if not settings.supabase_url or not settings.supabase_service_role_key:
            raise ValueError(
                "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env"
            )
        _supabase_admin = create_client(
            settings.supabase_url,
            settings.supabase_service_role_key,
        )
    return _supabase_admin


def get_supabase() -> Client:
    """Get Supabase client with anon key (respects RLS)."""
    global _supabase_anon
    if _supabase_anon is None:
        if not settings.supabase_url or not settings.supabase_anon_key:
            raise ValueError(
                "SUPABASE_URL and SUPABASE_ANON_KEY must be set in .env"
            )
        _supabase_anon = create_client(
            settings.supabase_url,
            settings.supabase_anon_key,
        )
    return _supabase_anon
