from fastapi import APIRouter, Depends
from app.routers.auth import get_current_user
from app.services.digest_service import generate_daily_digest

router = APIRouter()

@router.get("/daily", response_model=dict)
async def get_daily_digest(user: dict = Depends(get_current_user)):
    """
    Get an AI-generated daily digest of all notes captured by the user in the last 24 hours.
    """
    digest_text = await generate_daily_digest(user_id=user["id"])
    return {"digest": digest_text}
