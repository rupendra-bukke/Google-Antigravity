"""Career / Data & AI Pulse API routes."""

from fastapi import APIRouter, Depends

from services.auth_guard import require_authenticated_user
from services.career_pulse import get_career_pulse_snapshot

router = APIRouter(
    prefix="/api/v1",
    tags=["career-pulse"],
    dependencies=[Depends(require_authenticated_user)],
)


@router.get("/career-pulse")
async def career_pulse_endpoint():
    """
    Daily Data & AI Pulse snapshot for BI / analytics professionals.
    Gemini runs only on scheduled jobs — this endpoint reads the cached digest.
    """
    return await get_career_pulse_snapshot()
