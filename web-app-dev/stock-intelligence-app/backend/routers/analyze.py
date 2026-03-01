"""Router for the /api/v1/ endpoints."""

from fastapi import APIRouter, HTTPException, Query
from datetime import datetime, timezone
import json

from models.schemas import (
    AnalyzeResponse,
    IndicatorData,
    BollingerData,
    MacdData,
    OhlcBar,
    AdvancedAnalysis,
    OptionStrikeData,
)
from services.market_data import (
    fetch_intraday,
    fetch_multi_timeframe,
    calc_ema20,
    calc_rsi,
    calc_vwap,
    calc_bollinger,
    calc_macd,
    get_ohlc_series,
    get_latest_price,
    is_indian_market_open,
)
from services.decision import make_decision
from services.decision_v2 import run_advanced_analysis
from services.ai_decision import get_ai_decision
from config import settings

router = APIRouter(prefix="/api/v1", tags=["analyze"])


# ── Basic Analyze Endpoint (preserved) ─────────────────────


def calculate_indicator_signals(price, indicators):
    """Compute BUY/SELL/NEUTRAL signals based on indicator rules."""
    # EMA 20 Signal
    ema_sig = "NEUTRAL"
    if price > indicators["ema20"] * 1.0005:  # Buffer
        ema_sig = "BUY"
    elif price < indicators["ema20"] * 0.9995:
        ema_sig = "SELL"

    # RSI Signal
    rsi_sig = "NEUTRAL"
    if indicators["rsi14"] < 35:
        rsi_sig = "BUY"
    elif indicators["rsi14"] > 65:
        rsi_sig = "SELL"

    # VWAP Signal
    vwap_sig = "NEUTRAL"
    if price > indicators["vwap"] * 1.0002:
        vwap_sig = "BUY"
    elif price < indicators["vwap"] * 0.9998:
        vwap_sig = "SELL"

    # Bollinger Bands Signal
    bb_sig = "NEUTRAL"
    if price < indicators["bollinger"][2]:  # Lower band
        bb_sig = "BUY"
    elif price > indicators["bollinger"][0]:  # Upper band
        bb_sig = "SELL"

    # MACD Signal
    macd_sig = "NEUTRAL"
    if indicators["macd"][0] > indicators["macd"][1]:  # MACD Line > Signal Line
        macd_sig = "BUY"
    elif indicators["macd"][0] < indicators["macd"][1]:
        macd_sig = "SELL"

    return {
        "ema20": ema_sig,
        "rsi14": rsi_sig,
        "vwap": vwap_sig,
        "bollinger": bb_sig,
        "macd": macd_sig
    }


@router.get("/analyze", response_model=AnalyzeResponse)
async def analyze(symbol: str = Query(default=None)):
    """Analyze endpoint using 3m timeframe for core indicators and signals."""
    sym = symbol or settings.default_symbol

    try:
        # Fetch multi-timeframe to get 3m data (resampled from 1m)
        frames = await fetch_multi_timeframe(sym)
        df = frames.get("3m")
        if df is None or df.empty:
            # Fallback to intraday if 3m fails
            df = await fetch_intraday(sym, interval="1m")
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to fetch data: {exc}")

    price = get_latest_price(df)
    ema20 = calc_ema20(df)
    rsi = calc_rsi(df)
    vwap = calc_vwap(df)
    bb_upper, bb_middle, bb_lower = calc_bollinger(df)
    macd_line, signal_line, histogram = calc_macd(df)
    candles = get_ohlc_series(df)

    indicator_vals = {
        "ema20": ema20,
        "rsi14": rsi,
        "vwap": vwap,
        "bollinger": (bb_upper, bb_middle, bb_lower),
        "macd": (macd_line, signal_line, histogram)
    }
    
    signals = calculate_indicator_signals(price, indicator_vals)

    decision, reasoning = make_decision(
        price, ema20, rsi, vwap,
        bollinger=(bb_upper, bb_middle, bb_lower),
        macd=(macd_line, signal_line, histogram),
    )

    from models.schemas import IndicatorSignals  # Import inside to avoid circular deps if any

    return AnalyzeResponse(
        symbol=sym,
        price=price,
        indicators=IndicatorData(
            ema20=ema20, rsi14=rsi, vwap=vwap,
            bollinger=BollingerData(upper=bb_upper, middle=bb_middle, lower=bb_lower),
            macd=MacdData(macd_line=macd_line, signal_line=signal_line, histogram=histogram),
            signals=IndicatorSignals(**signals)
        ),
        decision=decision,
        reasoning=reasoning,
        timestamp=datetime.now(timezone.utc),
        candles=[OhlcBar(**c) for c in candles],
    )


# ── Advanced Analysis Endpoint (v2) ───────────────────────


@router.get("/advanced-analyze", response_model=AdvancedAnalysis)
async def advanced_analyze(symbol: str = Query(default=None)):
    """
    Multi-timeframe advanced analysis with 6-step pipeline:
    HTF Filter → Reversal Check → Market Structure → Scalp → 3-min Confirm → Strike Selection → Risk.
    """
    sym = symbol or settings.default_symbol

    try:
        frames = await fetch_multi_timeframe(sym)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to fetch data: {exc}")

    now = datetime.now(timezone.utc)
    is_open, mkt_msg = is_indian_market_open(now)
    result = run_advanced_analysis(frames, sym, now)

    # Convert option dict to Pydantic model if present
    opt = result.get("option_strike")
    option_model = OptionStrikeData(**opt) if opt else None

    return AdvancedAnalysis(
        prompt_version=result["prompt_version"],
        date_time=result["date_time"],
        index=result["index"],
        spot_price=result["spot_price"],
        scalp_signal=result["scalp_signal"],
        three_min_confirm=result["three_min_confirm"],
        htf_trend=result["htf_trend"],
        trend_direction=result["trend_direction"],
        option_strike=option_model,
        execute=result["execute"],
        execute_reason=result["execute_reason"],
        is_market_open=is_open,
        market_message=mkt_msg,
        steps_detail=result["steps_detail"],
    )


# ── AI Price Action Decision Endpoint ────────────────────────────────────────

CACHE_KEY_PREFIX = "ai_decision:"
CACHE_TTL_SECONDS = 300  # 5 minutes


@router.get("/ai-decision")
async def ai_decision(symbol: str = Query(default=None)):
    """
    Gemini-powered price action analysis with live news grounding.
    Cached for 5 minutes per symbol to stay within free API limits.
    """
    import hashlib
    from services.checkpoint_store import get_redis

    sym = symbol or settings.default_symbol
    cache_key = f"{CACHE_KEY_PREFIX}{hashlib.md5(sym.encode()).hexdigest()}"

    # Try Redis cache first
    try:
        redis = get_redis()
        cached = redis.get(cache_key)
        if cached:
            return json.loads(cached)
    except Exception:
        pass  # Redis unavailable — proceed without cache

    # Fetch market data
    try:
        frames = await fetch_multi_timeframe(sym)
    except Exception as exc:
        # Market may be closed (weekend) — return fallback with no data
        from services.ai_decision import _fallback
        return _fallback(f"Market data unavailable: {exc}")

    now = datetime.now(timezone.utc)
    result = await get_ai_decision(frames, sym, now)

    # Store in Redis with 5-min TTL
    try:
        redis = get_redis()
        redis.setex(cache_key, CACHE_TTL_SECONDS, json.dumps(result))
    except Exception:
        pass

    return result

