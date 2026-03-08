"""
Checkpoint Router - Two endpoints:

  GET /api/v1/checkpoints?symbol=^NSEI&date=2026-02-20
      -> Returns all 7 checkpoint panels for the day.

  POST /api/v1/checkpoints/trigger?checkpoint_id=0915&symbol=^NSEI
      -> Manually triggers V2 engine and saves to that checkpoint slot.

The APScheduler inside main.py calls the trigger automatically at each
checkpoint time (IST) on weekdays.
"""

from fastapi import APIRouter, HTTPException, Query, BackgroundTasks
from datetime import datetime, timezone, timedelta, time, date as date_cls
from config import settings

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
    save_eod_close,
    load_eod_close,
)

router = APIRouter(prefix="/api/v1/checkpoints", tags=["checkpoints"])

IST = timezone(timedelta(hours=5, minutes=30))

SYMBOLS = ["^NSEI", "^NSEBANK"]


def _today_ist() -> str:
    return datetime.now(IST).strftime("%Y-%m-%d")


def _is_nse_trading_day(day: date_cls) -> bool:
    """
    Holiday-aware NSE session check for a specific IST date.
    Falls back to Mon-Fri if exchange_calendars is unavailable.
    """
    try:
        import exchange_calendars as xcals
        import pandas as pd

        cal = xcals.get_calendar("XNSE")
        return bool(cal.is_session(pd.Timestamp(day)))
    except Exception:
        return day.weekday() < 5


def _last_nse_trading_day(on_or_before: date_cls) -> date_cls:
    """Walk backward to find the most recent NSE trading session date."""
    probe = on_or_before
    for _ in range(14):
        if _is_nse_trading_day(probe):
            return probe
        probe -= timedelta(days=1)
    return on_or_before


def _resolve_default_date_ist(now_ist: datetime) -> tuple[str, str]:
    """
    Resolve default date when client does not pass ?date=.

    Rule:
    - Trading day and time >= 09:00 IST: use today.
    - Otherwise: use last NSE trading day (e.g. Friday on weekend).
    """
    today = now_ist.date()
    market_reset_time = time(9, 0)
    today_is_trading = _is_nse_trading_day(today)

    if today_is_trading and now_ist.time() >= market_reset_time:
        return today.strftime("%Y-%m-%d"), "today"

    search_from = today - timedelta(days=1) if today_is_trading else today
    last_trading_day = _last_nse_trading_day(search_from)
    return last_trading_day.strftime("%Y-%m-%d"), "last_trading_day"


async def _compute_session_close_price(symbol: str, date_str: str) -> float | None:
    """
    Compute session close reference price for a date using data sliced to 15:30 IST.
    Prefers 1m frame, then 5m, then 15m.
    """
    try:
        frames = await fetch_multi_timeframe_at_time(symbol, "1530", date_str)
    except Exception:
        return None

    for tf in ("1m", "5m", "15m"):
        df = frames.get(tf)
        if df is not None and not df.empty and "Close" in df.columns:
            try:
                return round(float(df["Close"].iloc[-1]), 2)
            except Exception:
                continue
    return None


# Read all 7 panels
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
    now_ist = datetime.now(IST)

    if date:
        date_str = date
        date_source = "explicit"
    else:
        date_str, date_source = _resolve_default_date_ist(now_ist)

    panels = await load_all_checkpoints(date_str, symbol)

    # Catch-up logic
    is_today = date_str == now_ist.strftime("%Y-%m-%d")
    is_market_day = _is_nse_trading_day(now_ist.date())
    missing_ids = []

    if is_today and is_market_day:
        current_hhmm = now_ist.strftime("%H%M")
        missing_ids = [
            p["id"] for p in panels
            if p["data"] is None and current_hhmm >= p["id"]
        ]
        if missing_ids:
            background_tasks.add_task(run_catchup_sequential, missing_ids)

    eod_close = await load_eod_close(date_str, symbol)
    today_str = now_ist.strftime("%Y-%m-%d")
    should_try_eod = (
        eod_close is None
        and (
            date_str < today_str
            or (date_str == today_str and now_ist.time() >= time(15, 30))
        )
    )
    if should_try_eod:
        close_price = await _compute_session_close_price(symbol, date_str)
        if close_price is not None:
            eod_close = {
                "price": close_price,
                "time": "15:30",
                "captured_at": datetime.now(IST).isoformat(),
            }
            await save_eod_close(date_str, symbol, eod_close)

    return {
        "date": date_str,
        "date_source": date_source,
        "symbol": symbol,
        "panels": panels,
        "eod_close": eod_close,
        "checkpoints_meta": CHECKPOINTS,
        "catchup_triggered": bool(missing_ids),
        "version": settings.app_version,
        "channel": settings.release_channel,
        "build_label": settings.build_label,
    }


LAST_ERROR = "None yet"


@router.get("/diag")
async def checkpoint_diag():
    """Diagnostic endpoint to check backend status on live server."""
    now_ist = datetime.now(IST)
    now_utc = datetime.now(timezone.utc)
    is_market_open, market_msg = is_indian_market_open(now_utc)
    debug_val = await load_checkpoint("debug", "last", "run")

    # Test Redis read for today's 0915 checkpoint
    today_str = now_ist.strftime("%Y-%m-%d")
    test_0915 = await load_checkpoint(today_str, "0915", "^NSEI")

    return {
        "status": "ok",
        "version": settings.app_version,
        "channel": settings.release_channel,
        "build_label": settings.build_label,
        "server_time_ist": now_ist.isoformat(),
        "weekday": now_ist.weekday(),
        "is_weekday": now_ist.weekday() < 5,
        "is_market_open": is_market_open,
        "market_message": market_msg,
        "redis_configured": bool(UPSTASH_URL and UPSTASH_TOKEN),
        "redis_url_normalized": UPSTASH_URL[:15] + "..." if UPSTASH_URL else None,
        "checkpoints_count": len(CHECKPOINTS),
        "last_error": LAST_ERROR,
        "durable_debug": debug_val,
        "test_0915_loaded": test_0915 is not None,
        "test_0915_signal": test_0915.get("scalp_signal") if test_0915 else None,
    }


async def reconcile_missing_checkpoints(date_str: str | None = None) -> dict:
    """
    Fill any missing checkpoint slots for a target date using historical slice mode.
    Intended for EOD safety reconciliation (e.g. 15:31 / 15:36 IST).
    """
    import asyncio

    global LAST_ERROR
    target_date = date_str or _today_ist()

    try:
        target_day = datetime.strptime(target_date, "%Y-%m-%d").date()
    except ValueError:
        return {
            "date": target_date,
            "skipped": True,
            "reason": "invalid_date_format",
            "filled_checkpoint_ids": [],
            "missing_by_symbol": {},
        }

    if not _is_nse_trading_day(target_day):
        return {
            "date": target_date,
            "skipped": True,
            "reason": "non_trading_day",
            "filled_checkpoint_ids": [],
            "missing_by_symbol": {},
        }

    await log_debug(f"EOD reconcile started for {target_date}")
    missing_by_symbol: dict[str, list[str]] = {}
    missing_union: set[str] = set()

    for sym in SYMBOLS:
        panels = await load_all_checkpoints(target_date, sym)
        missing_ids = [p["id"] for p in panels if p["data"] is None]
        if missing_ids:
            missing_by_symbol[sym] = missing_ids
            missing_union.update(missing_ids)

    filled_ids: list[str] = []
    failed_ids: list[str] = []

    for cp_id in sorted(missing_union):
        try:
            await run_checkpoint_for_all_symbols(cp_id, date_str=target_date, use_historical=True)
            filled_ids.append(cp_id)
            await asyncio.sleep(1)
        except Exception as e:
            LAST_ERROR = str(e)
            failed_ids.append(cp_id)
            await log_debug(f"EOD reconcile failed for {target_date} {cp_id}: {e}")

    eod_saved_for: dict[str, float] = {}
    for sym in SYMBOLS:
        eod_payload = await load_eod_close(target_date, sym)
        if eod_payload is None:
            close_price = await _compute_session_close_price(sym, target_date)
            if close_price is not None:
                payload = {
                    "price": close_price,
                    "time": "15:30",
                    "captured_at": datetime.now(IST).isoformat(),
                }
                ok = await save_eod_close(target_date, sym, payload)
                if ok:
                    eod_saved_for[sym] = close_price

    await log_debug(
        f"EOD reconcile done for {target_date} | filled={filled_ids} failed={failed_ids}"
    )

    return {
        "date": target_date,
        "skipped": False,
        "reason": None,
        "filled_checkpoint_ids": filled_ids,
        "failed_checkpoint_ids": failed_ids,
        "missing_by_symbol": missing_by_symbol,
        "eod_close_saved_for": eod_saved_for,
    }


@router.post("/reconcile")
async def reconcile_checkpoints(date: str = Query(default=None)):
    """
    Manual reconcile endpoint:
    POST /api/v1/checkpoints/reconcile?date=YYYY-MM-DD
    """
    result = await reconcile_missing_checkpoints(date_str=date)
    return {"status": "ok", **result}


async def run_catchup_sequential(checkpoint_ids: list[str]):
    """Runs missing checkpoints using historical data at each slot's time."""
    import asyncio

    global LAST_ERROR
    date_str = _today_ist()
    await log_debug(f"Starting historical catch-up for {checkpoint_ids} on {date_str}")

    for cp_id in checkpoint_ids:
        try:
            await run_checkpoint_for_all_symbols(cp_id, date_str=date_str, use_historical=True)
            await asyncio.sleep(3)
        except Exception as e:
            LAST_ERROR = str(e)
            await log_debug(f"Error in {cp_id}: {e}")

    await log_debug("Historical catch-up finished")


# Manual / scheduled trigger
@router.post("/trigger")
async def trigger_checkpoint(
    checkpoint_id: str = Query(..., description="e.g. 0915, 0930, 1000"),
    symbol: str = Query(default="^NSEI"),
):
    """
    Run V2 engine and save result to the specified checkpoint slot.
    Called by APScheduler at market times, or manually for testing.
    """
    import traceback

    valid_ids = {cp["id"] for cp in CHECKPOINTS}
    if checkpoint_id not in valid_ids:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid checkpoint_id. Valid: {sorted(valid_ids)}",
        )

    now_utc = datetime.now(timezone.utc)
    date_str = _today_ist()

    try:
        frames = await fetch_multi_timeframe(symbol)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Data fetch failed: {exc}")

    try:
        result = run_advanced_analysis(frames, symbol, now_utc)
    except Exception as exc:
        tb = traceback.format_exc()
        global LAST_ERROR
        LAST_ERROR = f"V2 crash in {checkpoint_id}: {tb[-500:]}"
        await log_debug(f"V2 CRASH {checkpoint_id}: {tb}")
        raise HTTPException(status_code=500, detail=f"V2 engine crashed: {exc}\n{tb[-300:]}")

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

    saved = await save_checkpoint(date_str, checkpoint_id, symbol, payload)
    if not saved:
        raise HTTPException(
            status_code=503,
            detail="Redis save failed - check UPSTASH_REDIS_REST_URL / TOKEN env vars.",
        )

    return {
        "status": "saved",
        "date": date_str,
        "checkpoint_id": checkpoint_id,
        "symbol": symbol,
        "signal": payload["scalp_signal"],
        "execute": payload["execute"],
    }


# Trigger all symbols for a checkpoint
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
            print(f"[CHECKPOINT] ok {checkpoint_id} | {sym} | {payload['scalp_signal']}")
        except Exception as e:
            tb = traceback.format_exc()
            LAST_ERROR = f"{checkpoint_id}|{sym}: {tb[-300:]}"
            await log_debug(f"CHECKPOINT CRASH {checkpoint_id}|{sym}: {tb}")
            print(f"[CHECKPOINT] error {checkpoint_id} | {sym} | Error: {e}")
