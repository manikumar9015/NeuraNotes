"""
Integrations Router — handles Google OAuth2 flow for Gmail and Calendar.
Stores refresh tokens in user settings for future background access.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import RedirectResponse
from google_auth_oauthlib.flow import Flow
import json

from app.core.config import settings
from app.db.supabase_client import get_supabase_admin
from app.dependencies import get_current_user
from app.services.gmail_service import check_gmail_status

router = APIRouter()

# Scopes required for Gmail drafting and Calendar event creation
SCOPES = [
    "https://www.googleapis.com/auth/gmail.compose",
    "https://www.googleapis.com/auth/calendar.events"
]

@router.get("/google/connect")
async def connect_google(user: dict = Depends(get_current_user)):
    """
    Generate Google OAuth2 authorization URL.
    The user is redirected to this URL to grant permissions.
    """
    flow = Flow.from_client_config(
        {
            "web": {
                "client_id": settings.google_client_id,
                "client_secret": settings.google_client_secret,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": settings.google_token_uri,
            }
        },
        scopes=SCOPES,
        redirect_uri=settings.google_redirect_uri
    )
    
    # Store user ID in state to verify upon callback
    authorization_url, _ = flow.authorization_url(
        access_type='offline',
        include_granted_scopes='true',
        prompt='consent',
        state=user["id"]
    )
    
    return {"url": authorization_url}


@router.get("/google/callback")
async def google_callback(
    state: str,
    code: str = Query(None),
    error: str = Query(None)
):
    """
    Callback URI for Google OAuth2.
    Exchanges code for tokens and saves the refresh token to the user's settings.
    """
    if error:
        return RedirectResponse(url=f"neuranotes://settings?error={error}")

    user_id = state
    
    flow = Flow.from_client_config(
        {
            "web": {
                "client_id": settings.google_client_id,
                "client_secret": settings.google_client_secret,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": settings.google_token_uri,
            }
        },
        scopes=SCOPES,
        redirect_uri=settings.google_redirect_uri
    )
    
    try:
        flow.fetch_token(code=code)
        credentials = flow.credentials
        
        # Save tokens to Supabase
        supabase = get_supabase_admin()
        
        # Get current settings
        result = supabase.table("users").select("settings").eq("id", user_id).maybe_single().execute()
        user_settings = result.data.get("settings", {}) if result.data else {}
        
        # Store refresh token (crucial for background access)
        user_settings["google_token"] = {
            "refresh_token": credentials.refresh_token,
            "access_token": credentials.token,
            "token_uri": credentials.token_uri,
            "client_id": credentials.client_id,
            "client_secret": credentials.client_secret,
            "scopes": credentials.scopes
        }
        
        supabase.table("users").update({"settings": user_settings}).eq("id", user_id).execute()
        
        # Redirect back to the mobile app
        return RedirectResponse(url="neuranotes://settings?success=google_connected")
        
    except Exception as e:
        return RedirectResponse(url=f"neuranotes://settings?error={str(e)}")


@router.get("/status")
async def get_integration_status(user: dict = Depends(get_current_user)):
    """Check connection status for various integrations."""
    gmail_connected = await check_gmail_status(user["id"])
    return {
        "gmail": gmail_connected,
        "calendar": gmail_connected, # Sharing same token for now
        "storage": "supabase"
    }


@router.post("/google/disconnect")
async def disconnect_google(user: dict = Depends(get_current_user)):
    """Remove Google OAuth2 tokens from user settings."""
    supabase = get_supabase_admin()
    
    result = supabase.table("users").select("settings").eq("id", user["id"]).maybe_single().execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="User not found")
        
    user_settings = result.data.get("settings", {})
    if "google_token" in user_settings:
        del user_settings["google_token"]
        supabase.table("users").update({"settings": user_settings}).eq("id", user["id"]).execute()
        
    return {"message": "Disconnected successfully"}
