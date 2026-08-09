"""Lightweight dependency pings for free-tier keepalive checks."""

from __future__ import annotations

import os

import httpx

from config import settings

UPSTASH_URL = os.getenv("UPSTASH_REDIS_REST_URL", "").strip()
UPSTASH_TOKEN = os.getenv("UPSTASH_REDIS_REST_TOKEN", "").strip()


async def ping_supabase_auth() -> dict:
    base = (settings.supabase_url or "").strip().rstrip("/")
    api_key = (settings.supabase_publishable_key or "").strip()

    if not base or not api_key:
        return {
            "ok": False,
            "skipped": True,
            "detail": "Supabase env vars not configured on backend.",
        }

    url = f"{base}/auth/v1/settings"
    headers = {
        "apikey": api_key,
        "Authorization": f"Bearer {api_key}",
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(url, headers=headers)
        return {
            "ok": resp.status_code < 500,
            "status_code": resp.status_code,
            "detail": "Supabase auth settings reachable.",
        }
    except Exception as exc:
        return {
            "ok": False,
            "detail": f"Supabase ping failed: {exc}",
        }


async def ping_upstash_redis() -> dict:
    if not UPSTASH_URL or not UPSTASH_TOKEN:
        return {
            "ok": False,
            "skipped": True,
            "detail": "Upstash env vars not configured on backend.",
        }

    base = UPSTASH_URL.rstrip("/")
    headers = {"Authorization": f"Bearer {UPSTASH_TOKEN}"}

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            ping_resp = await client.get(f"{base}/ping", headers=headers)
            if ping_resp.status_code >= 400:
                return {
                    "ok": False,
                    "status_code": ping_resp.status_code,
                    "detail": "Upstash ping endpoint failed.",
                }

            touch_key = "keepalive:trade-craft"
            touch_resp = await client.post(
                f"{base}",
                headers={**headers, "Content-Type": "application/json"},
                json=["SET", touch_key, "1", "EX", "1209600"],
            )

        return {
            "ok": touch_resp.status_code < 400,
            "status_code": touch_resp.status_code,
            "detail": "Upstash ping + lightweight SET succeeded.",
        }
    except Exception as exc:
        return {
            "ok": False,
            "detail": f"Upstash ping failed: {exc}",
        }
