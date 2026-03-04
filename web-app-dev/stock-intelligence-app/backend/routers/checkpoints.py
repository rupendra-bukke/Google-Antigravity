"""
Checkpoint Router — Two endpoints:

  GET /api/v1/checkpoints?symbol=^NSEI&date=2026-02-20
      → Returns all 7 checkpoint panels for the day.

  POST /api/v1/checkpoints/trigger?checkpoint_id=0915&symbol=^NSEI
      → Manually triggers V2 engine and saves to that checkpoint slot.

The APScheduler inside main.py calls the trigger automatically at each
checkpoint time (IST) on weekdays.
"""

from fastapi import APIRouter, HTTPException, Query, BackgroundTasks
from datetime import datetime, timezone, timedelta, time

from services.market_data import (
    fetch_multi_timeframe,
    fetch_multi_timeframe_at_time,
    is_indian_market_open,
)
from services.decision_v2 import run_advanced_analysis
from services.checkpoint_store import (
    save_checkpoint,
    load_all_checkpoints,
    load_checkpoint,
    CHECKPOINTS,
    UPSTASH_URL,
    UPSTASH_TOKEN,
    log_debug,
)

router = APIRouter(prefix="/api/v1/checkpoints", tags=["checkpoints"])

IST = timezone(timedelta(hours=5, minutes=30))

SYMBOLS = ["^NSEI", "^NSEBANK"]


def _today_ist() -> str:
    return datetime.now(IST).strftime("%Y-%m-%d")


# ── Read all 7 panels ──────────────────────────────────────────────────────

@router.get("")
async def get_checkpoints(
    background_tasks: BackgroundTasks,
    symbol: str = Query(default="^NSEI"),
    date: str = Query(default=None),
):
    """
    Return all 7 checkpoint snapshots for a given day.
    If today's checkpoints are missing but should have been captured, 
    trigger a catch-up in the background.
    """
    date_str = date or _today_ist()
    panels = await load_all_checkpoints(date_str, symbol)

    # ── Catch-up Logic ──
    # Only run catch-up on actual NSE trading days (holiday-aware via exchange_calendars)
    now_utc = datetime.now(timezone.utc)
    now_ist = datetime.now(IST)
    is_today = date_str == now_ist.strftime("%Y-%m-%d")
    is_market_day, _ = is_indian_market_open(now_utc)  # checks weekdays + NSE holidays
    missing_ids = []  # IMPORTANT: must be defined before the if block

    if is_today and is_market_day:
        current_hhmm = now_ist.strftime("%H%M")
        missing_ids = [
            p["id"] for p in panels
            if p["data"] is None and current_hhmm >= p["id"]
        ]
        if missing_ids:
            background_tasks.add_task(run_catchup_sequential, missing_ids)

    return {
        "date": date_str,
        "symbol": symbol,
        "panels": panels,
        "checkpoints_meta": CHECKPOINTS,
        "catchup_triggered": bool(missing_ids),
        "version": "2.1"  # bump so we can verify deployment
    }


LAST_ERROR = "None yet"

@router.get("/diag")
async def checkpoint_diag():
    """Diagnostic endpoint to check backend status on live server."""
    now_ist = datetime.now(IST)
    now_utc = datetime.now(timezone.utc)
    is_market_open, market_msg = is_indian_market_open(now_utc)
    debug_val = await load_checkpoint("debug", "last", "run")
    return {
        "status": "ok",
        "version": "2.2-holiday-fix",   # bump → forces Render redeploy
        "server_time_ist": now_ist.isoformat(),
        "weekday": now_ist.weekday(),
        "is_weekday": now_ist.weekday() < 5,
        "is_market_open": is_market_open,   # NEW: holiday-aware check
        "market_message": market_msg,
        "redis_configured": bool(UPSTASH_URL and UPSTASH_TOKEN),
        "redis_url_normalized": UPSTASH_URL[:15] + "..." if UPSTASH_URL else None,
        "checkpoints_count": len(CHECKPOINTS),
        "last_error": LAST_ERROR,
        "durable_debug": debug_val
    }


async def run_catchup_sequential(checkpoint_ids: list[str]):
    """Runs missing checkpoints using HISTORICAL data at each slot's time."""
    import asyncio
    global LAST_ERROR
    date_str = _today_ist()
    await log_debug(f"Starting historical catch-up for {checkpoint_ids} on {date_str}")
    for cp_id in checkpoint_ids:
        try:
            await run_checkpoint_for_all_symbols(cp_id, date_str=date_str, use_historical=True)
            await asyncio.sleep(3)  # extra breathing room between historical fetches
        except Exception as e:
            LAST_ERROR = str(e)
            await log_debug(f"Error in {cp_id}: {e}")
    await log_debug("Historical catch-up finished")


# ── Manual / Scheduled Trigger ─────────────────────────────────────────────

@router.post("/trigger")
async def trigger_checkpoint(
    checkpoint_id: str = Query(..., description="e.g. 0915, 0930, 1000 …"),
    symbol: str = Query(default="^NSEI"),
):
    """
    Run V2 engine and save result to the specified checkpoint slot.
    Called by APScheduler at market times, or manually for testing.
    """
    import traceback

    # Validate checkpoint id
    valid_ids = {cp["id"] for cp in CHECKPOINTS}
    if checkpoint_id not in valid_ids:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid checkpoint_id. Valid: {sorted(valid_ids)}"
        )

    now_utc = datetime.now(timezone.utc)
    date_str = _today_ist()

    try:
        frames = await fetch_multi_timeframe(symbol)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Data fetch failed: {exc}")

    # Run V2 decision engine — wrapped for detailed error reporting
    try:
        result = run_advanced_analysis(frames, symbol, now_utc)
    except Exception as exc:
        tb = traceback.format_exc()
        global LAST_ERROR
        LAST_ERROR = f"V2 crash in {checkpoint_id}: {tb[-500:]}"
        await log_debug(f"V2 CRASH {checkpoint_id}: {tb}")
        raise HTTPException(status_code=500, detail=f"V2 engine crashed: {exc}\n{tb[-300:]}")

    is_open, mkt_msg = is_indian_market_open(now_utc)

    # Build the snapshot payload
    payload = {
        "captured_at": datetime.now(IST).isoformat(),
        "is_market_open": is_open,
        "market_message": mkt_msg,
        "prompt_version": result.get("prompt_version"),
        "index": result.get("index"),
        "spot_price": result.get("spot_price"),
        "scalp_signal": result.get("scalp_signal"),
        "three_min_confirm": result.get("three_min_confirm"),
        "htf_trend": result.get("htf_trend"),
        "trend_direction": result.get("trend_direction"),
        "execute": result.get("execute"),
        "execute_reason": result.get("execute_reason"),
        "option_strike": result.get("option_strike"),
        "forecast": result.get("forecast"),
        "steps_detail": result.get("steps_detail"),
    }

    saved = await save_checkpoint(date_str, checkpoint_id, symbol, payload)
    if not saved:
        raise HTTPException(
            status_code=503,
            detail="Redis save failed — check UPSTASH_REDIS_REST_URL / TOKEN env vars."
        )

    return {
        "status": "saved",
        "date": date_str,
        "checkpoint_id": checkpoint_id,
        "symbol": symbol,
        "signal": payload["scalp_signal"],
        "execute": payload["execute"],
    }


# ── Trigger ALL symbols for a checkpoint ──────────────────────────────────

async def run_checkpoint_for_all_symbols(
    checkpoint_id: str,
    date_str: str = None,
    use_historical: bool = False,
):
    """
    Internal function called by APScheduler (use_historical=False)
    or catch-up (use_historical=True).
    """
    import traceback
    global LAST_ERROR

    now_utc = datetime.now(timezone.utc)
    date_str = date_str or _today_ist()

    for sym in SYMBOLS:
        try:
            if use_historical:
                frames = await fetch_multi_timeframe_at_time(sym, checkpoint_id, date_str)
            else:
                frames = await fetch_multi_timeframe(sym)

            result = run_advanced_analysis(frames, sym, now_utc)
            is_open, mkt_msg = is_indian_market_open(now_utc)

            payload = {
                "captured_at": datetime.now(IST).isoformat(),
                "is_market_open": is_open,
                "market_message": mkt_msg,
                "prompt_version": result.get("prompt_version"),
                "index": result.get("index"),
                "spot_price": result.get("spot_price"),
                "scalp_signal": result.get("scalp_signal"),
                "three_min_confirm": result.get("three_min_confirm"),
                "htf_trend": result.get("htf_trend"),
                "trend_direction": result.get("trend_direction"),
                "execute": result.get("execute"),
                "execute_reason": result.get("execute_reason"),
                "option_strike": result.get("option_strike"),
                "forecast": result.get("forecast"),
                "steps_detail": result.get("steps_detail"),
            }
            await save_checkpoint(date_str, checkpoint_id, sym, payload)
            print(f"[CHECKPOINT] ✅ {checkpoint_id} | {sym} | {payload['scalp_signal']}")
        except Exception as e:
            tb = traceback.format_exc()
            LAST_ERROR = f"{checkpoint_id}|{sym}: {tb[-300:]}"
            await log_debug(f"CHECKPOINT CRASH {checkpoint_id}|{sym}: {tb}")
            print(f"[CHECKPOINT] ❌ {checkpoint_id} | {sym} | Error: {e}")
