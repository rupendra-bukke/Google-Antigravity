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
    """
    Seconds until 09:00 AM IST the NEXT trading day.
    Data persists overnight for review, then auto-clears before market open.
    """
    now = datetime.now(IST)
    # Next day at 9:00 AM IST
    next_day = now.replace(hour=9, minute=0, second=0, microsecond=0) + timedelta(days=1)
    # If today is Friday (weekday=4), skip to Monday (add 3 days instead of 1)
    if now.weekday() == 4:  # Friday
        next_day = now.replace(hour=9, minute=0, second=0, microsecond=0) + timedelta(days=3)
    ttl = int((next_day - now).total_seconds())
    return max(ttl, 60)


def _get_base_url() -> str:
    """Normalize Upstash URL to base (no trailing slash)."""
    url = UPSTASH_URL.strip()
    if url.endswith("/"):
        url = url[:-1]
    # If user accidentally included '/set' or others, strip it
    for suffix in ["/set", "/get", "/keys", "/pipeline"]:
        if url.endswith(suffix):
            url = url[:-len(suffix)]
    return url


async def log_debug(msg: str):
    """Save a durable debug log to Redis."""
    try:
        url = _get_base_url()
        timestamp = datetime.now(IST).strftime("%H:%M:%S")
        entry = f"[{timestamp}] {msg}"
        async with httpx.AsyncClient() as client:
            await client.post(
                url,
                json=["SET", "debug:last_run", entry, "EX", "3600"],
                headers=_headers(),
                timeout=5
            )
    except:
        pass


async def save_checkpoint(date_str: str, checkpoint_id: str, symbol: str, payload: dict) -> bool:
    """Save checkpoint payload to Upstash Redis using command array for safety."""
    base_url = _get_base_url()
    if not base_url or not UPSTASH_TOKEN:
        print("[REDIS] ❌ Missing credentials - cannot save.")
        return False

    key = _make_key(date_str, checkpoint_id, symbol)
    ttl = _ttl_seconds()
    value = json.dumps(payload)

    async with httpx.AsyncClient() as client:
        try:
            # Use JSON array command for absolute safety with JSON strings
            command = ["SET", key, value, "EX", str(ttl)]
            resp = await client.post(
                base_url,
                json=command,
                headers=_headers(),
                timeout=15,
            )
            if resp.status_code != 200:
                print(f"[REDIS] ❌ SET failed for {key} | Status: {resp.status_code} | Body: {resp.text}")
                return False
            return True
        except Exception as e:
            print(f"[REDIS] ❌ Connection error during SET {key}: {e}")
            return False


async def load_checkpoint(date_str: str, checkpoint_id: str, symbol: str) -> dict | None:
    """Load a single checkpoint snapshot using GET command."""
    base_url = _get_base_url()
    if not base_url or not UPSTASH_TOKEN:
        return None

    key = _make_key(date_str, checkpoint_id, symbol)

    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post(
                base_url,
                json=["GET", key],
                headers=_headers(),
                timeout=10,
            )
            if resp.status_code != 200:
                print(f"[REDIS] ⚠️ GET failed for {key} | Status: {resp.status_code}")
                return None
            
            # Upstash returns {"result": "..."} for command arrays
            result = resp.json().get("result")
            if not result:
                return None
            return json.loads(result)
        except Exception as e:
            print(f"[REDIS] ❌ Connection error during GET {key}: {e}")
            return None


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
