"""
Checkpoint Store - Upstash Redis wrapper.

Each checkpoint snapshot is saved as a JSON string under the key:
    checkpoint:{YYYY-MM-DD}:{HHMM}:{symbol}

TTL expires at 09:00 IST on the next NSE trading day so timeline data
remains visible across weekends/holidays until the next live market morning.
"""

import json
import os
from datetime import datetime, timezone, timedelta, time, date as date_cls

import httpx
from services.market_data import is_nse_trading_day as market_is_nse_trading_day

IST = timezone(timedelta(hours=5, minutes=30))

UPSTASH_URL = os.getenv("UPSTASH_REDIS_REST_URL", "")
UPSTASH_TOKEN = os.getenv("UPSTASH_REDIS_REST_TOKEN", "")

# 7 Indian market checkpoints (HH:MM IST)
CHECKPOINTS = [
    {"id": "0915", "label": "Market Open", "time": "09:15"},
    {"id": "0930", "label": "Opening Range", "time": "09:30"},
    {"id": "1000", "label": "Morning Trend", "time": "10:00"},
    {"id": "1130", "label": "Mid-Morning", "time": "11:30"},
    {"id": "1300", "label": "Lunch Lull", "time": "13:00"},
    {"id": "1400", "label": "Afternoon Setup", "time": "14:00"},
    {"id": "1500", "label": "Power Hour", "time": "15:00"},
]


def _headers() -> dict:
    return {"Authorization": f"Bearer {UPSTASH_TOKEN}"}


def _make_key(date_str: str, checkpoint_id: str, symbol: str) -> str:
    """e.g. checkpoint:2026-02-20:0915:^NSEI"""
    return f"checkpoint:{date_str}:{checkpoint_id}:{symbol}"


def _make_eod_close_key(date_str: str, symbol: str) -> str:
    """e.g. checkpoint:2026-02-20:eod_close:^NSEI"""
    return f"checkpoint:{date_str}:eod_close:{symbol}"


def _is_nse_trading_day(day: date_cls) -> bool:
    """Shared helper so Redis TTL follows the same holiday rules as the API."""
    return market_is_nse_trading_day(day)

def _next_nse_reset_9am_ist(now_ist: datetime) -> datetime:
    """Return next 09:00 IST boundary on an actual NSE trading session day."""
    today_reset = now_ist.replace(hour=9, minute=0, second=0, microsecond=0)
    candidate = now_ist.date() if now_ist < today_reset else (now_ist.date() + timedelta(days=1))

    for _ in range(14):
        if _is_nse_trading_day(candidate):
            return datetime.combine(candidate, time(9, 0), tzinfo=IST)
        candidate += timedelta(days=1)

    # Safety fallback (should never happen)
    return datetime.combine(now_ist.date() + timedelta(days=1), time(9, 0), tzinfo=IST)


def _ttl_seconds() -> int:
    """
    Seconds until 09:00 AM IST on the next NSE trading day.
    """
    now = datetime.now(IST)
    next_reset = _next_nse_reset_9am_ist(now)
    ttl = int((next_reset - now).total_seconds())
    return max(ttl, 60)


def _get_base_url() -> str:
    """Normalize Upstash URL to base (no trailing slash)."""
    url = UPSTASH_URL.strip()
    if url.endswith("/"):
        url = url[:-1]
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
                timeout=5,
            )
    except Exception:
        pass


async def save_checkpoint(date_str: str, checkpoint_id: str, symbol: str, payload: dict) -> bool:
    """Save checkpoint payload to Upstash Redis using command array for safety."""
    base_url = _get_base_url()
    if not base_url or not UPSTASH_TOKEN:
        print("[REDIS] missing credentials - cannot save")
        return False

    key = _make_key(date_str, checkpoint_id, symbol)
    ttl = _ttl_seconds()
    value = json.dumps(payload)

    async with httpx.AsyncClient() as client:
        try:
            command = ["SET", key, value, "EX", str(ttl)]
            resp = await client.post(
                base_url,
                json=command,
                headers=_headers(),
                timeout=15,
            )
            if resp.status_code != 200:
                print(f"[REDIS] SET failed for {key} | Status: {resp.status_code} | Body: {resp.text}")
                return False
            return True
        except Exception as e:
            print(f"[REDIS] connection error during SET {key}: {e}")
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
                print(f"[REDIS] GET failed for {key} | Status: {resp.status_code}")
                return None

            result = resp.json().get("result")
            if not result:
                return None
            return json.loads(result)
        except Exception as e:
            print(f"[REDIS] connection error during GET {key}: {e}")
            return None


async def load_all_checkpoints(date_str: str, symbol: str) -> list[dict]:
    """
    Load all 7 checkpoint slots for a given day + symbol.
    Returns a list of 7 dicts; data=None for slots not yet captured.
    """
    out = []
    for cp in CHECKPOINTS:
        data = await load_checkpoint(date_str, cp["id"], symbol)
        out.append(
            {
                "id": cp["id"],
                "label": cp["label"],
                "time": cp["time"],
                "data": data,
            }
        )
    return out


async def save_eod_close(date_str: str, symbol: str, payload: dict) -> bool:
    """Save session close payload (e.g. 15:30 close) for a day + symbol."""
    base_url = _get_base_url()
    if not base_url or not UPSTASH_TOKEN:
        return False

    key = _make_eod_close_key(date_str, symbol)
    ttl = _ttl_seconds()
    value = json.dumps(payload)

    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post(
                base_url,
                json=["SET", key, value, "EX", str(ttl)],
                headers=_headers(),
                timeout=15,
            )
            return resp.status_code == 200
        except Exception:
            return False


async def load_eod_close(date_str: str, symbol: str) -> dict | None:
    """Load saved session close payload for day + symbol."""
    base_url = _get_base_url()
    if not base_url or not UPSTASH_TOKEN:
        return None

    key = _make_eod_close_key(date_str, symbol)

    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post(
                base_url,
                json=["GET", key],
                headers=_headers(),
                timeout=10,
            )
            if resp.status_code != 200:
                return None
            result = resp.json().get("result")
            return json.loads(result) if result else None
        except Exception:
            return None
