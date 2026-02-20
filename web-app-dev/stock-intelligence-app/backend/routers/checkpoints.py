"""
Checkpoint Router — Two endpoints:

  GET /api/v1/checkpoints?symbol=^NSEI&date=2026-02-20
      → Returns all 7 checkpoint panels for the day.

  POST /api/v1/checkpoints/trigger?checkpoint_id=0915&symbol=^NSEI
      → Manually triggers V2 engine and saves to that checkpoint slot.

The APScheduler inside main.py calls the trigger automatically at each
checkpoint time (IST) on weekdays.
"""

from fastapi import APIRouter, HTTPException, Query
from datetime import datetime, timezone, timedelta

from services.market_data import fetch_multi_timeframe, is_indian_market_open
from services.decision_v2 import run_advanced_analysis
from services.checkpoint_store import (
    save_checkpoint,
    load_all_checkpoints,
    CHECKPOINTS,
)

router = APIRouter(prefix="/api/v1/checkpoints", tags=["checkpoints"])

IST = timezone(timedelta(hours=5, minutes=30))

SYMBOLS = ["^NSEI", "^NSEBANK"]


def _today_ist() -> str:
    return datetime.now(IST).strftime("%Y-%m-%d")


# ── Read all 7 panels ──────────────────────────────────────────────────────

@router.get("")
async def get_checkpoints(
    symbol: str = Query(default="^NSEI"),
    date: str = Query(default=None),
):
    """Return all 7 checkpoint snapshots for a given day."""
    date_str = date or _today_ist()
    panels = await load_all_checkpoints(date_str, symbol)
    return {
        "date": date_str,
        "symbol": symbol,
        "panels": panels,
        "checkpoints_meta": CHECKPOINTS,
    }


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

    # Run V2 decision engine
    result = run_advanced_analysis(frames, symbol, now_utc)
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

async def run_checkpoint_for_all_symbols(checkpoint_id: str):
    """
    Internal function called by APScheduler.
    Runs V2 for both Nifty50 + BankNifty at the given checkpoint.
    """
    now_utc = datetime.now(timezone.utc)
    date_str = _today_ist()

    for sym in SYMBOLS:
        try:
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
                "steps_detail": result.get("steps_detail"),
            }
            await save_checkpoint(date_str, checkpoint_id, sym, payload)
            print(f"[CHECKPOINT] ✅ {checkpoint_id} | {sym} | {payload['scalp_signal']}")
        except Exception as e:
            print(f"[CHECKPOINT] ❌ {checkpoint_id} | {sym} | Error: {e}")
