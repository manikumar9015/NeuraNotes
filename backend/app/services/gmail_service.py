"""
Gmail Service — handles interaction with the Google Gmail API.
Provides utility for creating drafts and sending emails using OAuth2 credentials.
"""

import base64
from email.mime.text import MIMEText
from typing import Dict, Optional

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

from app.core.config import settings
from app.db.supabase_client import get_supabase_admin


def _get_user_credentials(user_id: str) -> Optional[Credentials]:
    """Retrieve and refresh Google OAuth2 credentials for the user."""
    supabase = get_supabase_admin()
    
    # Fetch settings from DB
    result = supabase.table("users").select("settings").eq("id", user_id).maybe_single().execute()
    
    if not result.data or not result.data.get("settings"):
        return None
    
    settings_data = result.data["settings"]
    google_token = settings_data.get("google_token")
    
    if not google_token:
        return None
    
    creds = Credentials(
        token=None,  # Will be refreshed
        refresh_token=google_token.get("refresh_token"),
        token_uri=settings.google_token_uri,
        client_id=settings.google_client_id,
        client_secret=settings.google_client_secret,
        scopes=["https://www.googleapis.com/auth/gmail.compose", "https://www.googleapis.com/auth/calendar.events"]
    )
    
    # Refresh the token if needed
    if not creds.valid:
        creds.refresh(Request())
        
        # Save the new access token back to the DB to avoid frequent refreshes (optional but recommended)
        # For simplicity, we mostly rely on the refresh token, but updating the stored data is good.
        google_token["access_token"] = creds.token
        supabase.table("users").update({"settings": settings_data}).eq("id", user_id).execute()
        
    return creds


async def create_gmail_draft(user_id: str, to: str, subject: str, body: str) -> Dict:
    """
    Create a draft email in the user's Gmail account.
    """
    creds = _get_user_credentials(user_id)
    if not creds:
        return {
            "success": False,
            "error": "Gmail connection not found. Please connect your Google account in Settings."
        }
    
    try:
        service = build("gmail", "v1", credentials=creds)
        
        message = MIMEText(body)
        message["to"] = to
        message["subject"] = subject
        
        raw_message = base64.urlsafe_b64encode(message.as_bytes()).decode("utf-8")
        
        draft_body = {"message": {"raw": raw_message}}
        
        draft = service.users().drafts().create(userId="me", body=draft_body).execute()
        
        return {
            "success": True,
            "draft_id": draft["id"],
            "message": "Draft created successfully in your Gmail account."
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": f"Failed to create Gmail draft: {str(e)}"
        }

async def check_gmail_status(user_id: str) -> bool:
    """Check if the user has a valid Gmail connection."""
    creds = _get_user_credentials(user_id)
    return creds is not None and creds.refresh_token is not None
