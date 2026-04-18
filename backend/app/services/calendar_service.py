"""
Calendar Service — handles interaction with the Google Calendar API.
Provides utility for creating events using OAuth2 credentials.
"""

from datetime import datetime
from typing import Dict, Optional
import dateutil.parser

from googleapiclient.discovery import build
from app.services.gmail_service import _get_user_credentials


async def create_google_calendar_event(
    user_id: str,
    title: str,
    date_str: str,
    time_str: Optional[str] = None,
    description: Optional[str] = None,
) -> Dict:
    """
    Create an event in the user's primary Google Calendar.
    Parses natural language or ISO dates/times into correct format.
    """
    creds = _get_user_credentials(user_id)
    if not creds:
        return {
            "success": False,
            "error": "Google Calendar connection not found. Please connect your Google account in Settings."
        }
    
    try:
        # Construct start and end times
        # Combine date and time if time is provided
        if time_str:
            combined_str = f"{date_str} {time_str}"
        else:
            combined_str = date_str
            
        start_dt = dateutil.parser.parse(combined_str)
        # Default duration: 1 hour
        from datetime import timedelta
        end_dt = start_dt + timedelta(hours=1)
        
        event_body = {
            'summary': title,
            'description': description or 'Created via NeuraNotes',
            'start': {
                'dateTime': start_dt.isoformat(),
                'timeZone': 'UTC', # Should ideally get user's timezone from settings
            },
            'end': {
                'dateTime': end_dt.isoformat(),
                'timeZone': 'UTC',
            },
        }
        
        service = build("calendar", "v3", credentials=creds)
        event = service.events().insert(calendarId='primary', body=event_body).execute()
        
        return {
            "success": True,
            "event_id": event.get('id'),
            "html_link": event.get('htmlLink'),
            "start": start_dt.isoformat(),
            "message": f"Successfully scheduled '{title}' for {start_dt.strftime('%B %d, %Y at %I:%M %p')}"
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": f"Failed to create Calendar event: {str(e)}"
        }
