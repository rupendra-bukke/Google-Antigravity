"""
Checkpoint Store — Upstash Redis wrapper.

Each checkpoint snapshot is saved as a JSON string under the key:
    checkpoint:{YYYY-MM-DD}:{HHMM}:{symbol}

TTL is set to expire at 21:00 IST (end of trading day + buffer),
so all panels auto-reset the next day.
"""

import json
import os
from datetime import datetime, timezone, timedelta

import httpx

IST = timezone(timedelta(hours=5, minutes=30))

UPSTASH_URL = os.getenv("UPSTASH_REDIS_REST_URL", "")
UPSTASH_TOKEN = os.getenv("UPSTASH_REDIS_REST_TOKEN", "")

# 7 Indian market checkpoints (HH:MM IST)
CHECKPOINTS = [
    {"id": "0915", "label": "Market Open",       "time": "09:15"},
    {"id": "0930", "label": "Opening Range",      "time": "09:30"},
    {"id": "1000", "label": "Morning Trend",      "time": "10:00"},
    {"id": "1130", "label": "Mid-Morning",        "time": "11:30"},
    {"id": "1300", "label": "Lunch Lull",         "time": "13:00"},
    {"id": "1400", "label": "Afternoon Setup",    "time": "14:00"},
    {"id": "1500", "label": "Power Hour",         "time": "15:00"},
]


def _headers() -> dict:
    return {"Authorization": f"Bearer {UPSTASH_TOKEN}"}


def _make_key(date_str: str, checkpoint_id: str, symbol: str) -> str:
    """e.g. checkpoint:2026-02-20:0915:^NSEI"""
    return f"checkpoint:{date_str}:{checkpoint_id}:{symbol}"


def _ttl_seconds() -> int:
    """Seconds until 21:00 IST today (safe end-of-day expiry)."""
    now = datetime.now(IST)
    expire_at = now.replace(hour=21, minute=0, second=0, microsecond=0)
    if expire_at <= now:
        expire_at += timedelta(days=1)
    return max(int((expire_at - now).total_seconds()), 60)


async def save_checkpoint(date_str: str, checkpoint_id: str, symbol: str, payload: dict) -> bool:
    """Save checkpoint payload to Upstash Redis with auto-expiry at 21:00 IST."""
    if not UPSTASH_URL or not UPSTASH_TOKEN:
        return False

    key = _make_key(date_str, checkpoint_id, symbol)
    ttl = _ttl_seconds()
    value = json.dumps(payload)

    async with httpx.AsyncClient() as client:
        # SET key value EX ttl
        resp = await client.post(
            f"{UPSTASH_URL}/set/{key}/{value}/ex/{ttl}",
            headers=_headers(),
            timeout=10,
        )
        return resp.status_code == 200


async def load_checkpoint(date_str: str, checkpoint_id: str, symbol: str) -> dict | None:
    """Load a single checkpoint snapshot. Returns None if not yet captured."""
    if not UPSTASH_URL or not UPSTASH_TOKEN:
        return None

    key = _make_key(date_str, checkpoint_id, symbol)

    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{UPSTASH_URL}/get/{key}",
            headers=_headers(),
            timeout=10,
        )
        if resp.status_code != 200:
            return None
        result = resp.json().get("result")
        if not result:
            return None
        return json.loads(result)


async def load_all_checkpoints(date_str: str, symbol: str) -> list[dict]:
    """
    Load all 7 checkpoint slots for a given day + symbol.
    Returns a list of 7 dicts — data=None for slots not yet captured.
    """
    out = []
    for cp in CHECKPOINTS:
        data = await load_checkpoint(date_str, cp["id"], symbol)
        out.append({
            "id":    cp["id"],
            "label": cp["label"],
            "time":  cp["time"],
            "data":  data,          # None = not captured yet
        })
    return out
