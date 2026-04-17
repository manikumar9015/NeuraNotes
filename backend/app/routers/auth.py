"""
Authentication Router — Google OAuth2 login, token refresh, and logout.
Uses Supabase Auth for Google OAuth validation and user management.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.core.security import create_access_token, create_refresh_token, verify_token
from app.db.supabase_client import get_supabase_admin
from app.dependencies import get_current_user

router = APIRouter()


# ── Request/Response Schemas ────────────────────────────────

class GoogleAuthRequest(BaseModel):
    """Request body for Google OAuth login."""
    id_token: str = Field(..., description="Google OAuth ID token from mobile app")


class TokenResponse(BaseModel):
    """JWT token pair returned after successful auth."""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int  # seconds until access token expires
    user: dict


class RefreshRequest(BaseModel):
    """Request body for token refresh."""
    refresh_token: str


# ── Endpoints ───────────────────────────────────────────────

@router.post("/google", response_model=TokenResponse)
async def google_auth(request: GoogleAuthRequest):
    """
    Authenticate with Google OAuth.
    
    Flow:
    1. Mobile app gets Google ID token via expo-auth-session
    2. Sends ID token to this endpoint
    3. We verify with Google and create/update user in Supabase
    4. Return JWT access + refresh tokens
    """
    try:
        import httpx

        # Verify the Google ID token
        async with httpx.AsyncClient() as client:
            google_response = await client.get(
                f"https://oauth2.googleapis.com/tokeninfo?id_token={request.id_token}"
            )

        if google_response.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid Google ID token",
            )

        google_data = google_response.json()
        google_id = google_data.get("sub")
        email = google_data.get("email")
        name = google_data.get("name", "")
        avatar_url = google_data.get("picture", "")

        if not google_id or not email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Google token missing required fields",
            )

        # Check if user exists, create if not
        supabase = get_supabase_admin()

        existing = (
            supabase.table("users")
            .select("*")
            .eq("google_id", google_id)
            .execute()
        )

        if existing.data and len(existing.data) > 0:
            # Update existing user
            user = (
                supabase.table("users")
                .update({"name": name, "avatar_url": avatar_url})
                .eq("id", existing.data[0]["id"])
                .execute()
            ).data[0]
        else:
            # Create new user
            user = (
                supabase.table("users")
                .insert({
                    "email": email,
                    "name": name,
                    "avatar_url": avatar_url,
                    "google_id": google_id,
                })
                .execute()
            ).data[0]

        # Generate JWT tokens
        token_data = {"sub": user["id"], "email": user["email"]}
        access_token = create_access_token(token_data)
        refresh_token = create_refresh_token(token_data)

        from app.core.config import settings

        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            expires_in=settings.access_token_expire_minutes * 60,
            user=user,
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Authentication failed: {str(e)}",
        )


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(request: RefreshRequest):
    """Refresh an expired access token using a valid refresh token."""
    payload = verify_token(request.refresh_token, expected_type="refresh")

    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )

    user_id = payload.get("sub")
    email = payload.get("email")

    # Verify user still exists
    supabase = get_supabase_admin()
    result = (
        supabase.table("users")
        .select("*")
        .eq("id", user_id)
        .limit(1)
        .execute()
    )

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User no longer exists",
        )

    # Issue new tokens
    token_data = {"sub": user_id, "email": email}
    new_access = create_access_token(token_data)
    new_refresh = create_refresh_token(token_data)

    from app.core.config import settings

    return TokenResponse(
        access_token=new_access,
        refresh_token=new_refresh,
        expires_in=settings.access_token_expire_minutes * 60,
        user=result.data[0],
    )


@router.post("/logout")
async def logout(user: dict = Depends(get_current_user)):
    """
    Logout the current user.
    Note: JWT tokens are stateless — actual invalidation would require
    a token blacklist in Redis. For now, the client simply discards the token.
    """
    return {"message": "Logged out successfully", "user_id": user["id"]}


@router.post("/dev-login", response_model=TokenResponse)
async def dev_login():
    """Create a temporary test user for local development without Google OAuth."""
    supabase = get_supabase_admin()
    
    # Check if dev user exists
    existing = (
        supabase.table("users")
        .select("*")
        .eq("email", "dev@neuranotes.com")
        .execute()
    )
    
    if existing.data and len(existing.data) > 0:
        user = existing.data[0]
    else:
        user = (
            supabase.table("users")
            .insert({
                "email": "dev@neuranotes.com",
                "name": "Dev User",
                "google_id": "dev_mock_id",
            })
            .execute()
        ).data[0]
        
    # Issue new tokens
    token_data = {"sub": user["id"], "email": user["email"]}
    from app.core.security import create_access_token, create_refresh_token
    new_access = create_access_token(token_data)
    new_refresh = create_refresh_token(token_data)
    
    from app.core.config import settings
    return TokenResponse(
        access_token=new_access,
        refresh_token=new_refresh,
        expires_in=settings.access_token_expire_minutes * 60,
        user=user,
    )
