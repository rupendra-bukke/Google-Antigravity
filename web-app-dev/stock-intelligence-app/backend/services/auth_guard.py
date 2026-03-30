"""Supabase access-token verification dependency for FastAPI routes."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import httpx
from fastapi import Header, HTTPException

from config import settings

_TOKEN_CACHE_TTL_SECONDS = 120
_token_cache: dict[str, tuple[datetime, dict]] = {}


def _extract_bearer_token(authorization: str | None) -> str:
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing Authorization header.")

    parts = authorization.strip().split(" ", 1)
    if len(parts) != 2 or parts[0].lower() != "bearer" or not parts[1].strip():
        raise HTTPException(status_code=401, detail="Invalid Authorization header format.")

    return parts[1].strip()


async def require_authenticated_user(
    authorization: str | None = Header(default=None, alias="Authorization"),
) -> dict:
    """Validate Supabase JWT by calling Supabase Auth /user endpoint."""
    if not settings.auth_required:
        return {
            "id": "dev-bypass",
            "email": "dev@local",
            "aud": "authenticated",
            "role": "authenticated",
        }

    if not settings.supabase_url or not settings.supabase_publishable_key:
        raise HTTPException(
            status_code=503,
            detail="Authentication is not configured on backend. Missing SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY.",
        )

    token = _extract_bearer_token(authorization)
    now = datetime.now(timezone.utc)

    cached = _token_cache.get(token)
    if cached and cached[0] > now:
        return cached[1]

    url = f"{settings.supabase_url.rstrip('/')}/auth/v1/user"
    headers = {
        "Authorization": f"Bearer {token}",
        "apikey": settings.supabase_publishable_key,
    }

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(url, headers=headers)
    except Exception:
        raise HTTPException(status_code=503, detail="Auth service is unavailable. Please retry.")

    if resp.status_code == 401:
        raise HTTPException(status_code=401, detail="Session expired or invalid token.")
    if resp.status_code >= 400:
        raise HTTPException(status_code=503, detail="Auth verification failed upstream.")

    try:
        user = resp.json()
    except Exception:
        raise HTTPException(status_code=503, detail="Invalid auth response from provider.")

    if not isinstance(user, dict) or not user.get("id"):
        raise HTTPException(status_code=401, detail="Invalid user session.")

    _token_cache[token] = (now + timedelta(seconds=_TOKEN_CACHE_TTL_SECONDS), user)
    return user
