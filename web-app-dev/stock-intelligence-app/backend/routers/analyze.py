"""Router for the /api/v1/ endpoints."""

from fastapi import APIRouter, HTTPException, Query
from datetime import datetime, timezone

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
)
from services.decision import make_decision
from services.decision_v2 import run_advanced_analysis
from config import settings

router = APIRouter(prefix="/api/v1", tags=["analyze"])


# ── Basic Analyze Endpoint (preserved) ─────────────────────


@router.get("/analyze", response_model=AnalyzeResponse)
async def analyze(symbol: str = Query(default=None)):
    """Basic single-timeframe analysis with indicators + decision."""
    sym = symbol or settings.default_symbol

    try:
        df = await fetch_intraday(sym)
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

    decision, reasoning = make_decision(
        price, ema20, rsi, vwap,
        bollinger=(bb_upper, bb_middle, bb_lower),
        macd=(macd_line, signal_line, histogram),
    )

    return AnalyzeResponse(
        symbol=sym,
        price=price,
        indicators=IndicatorData(
            ema20=ema20, rsi14=rsi, vwap=vwap,
            bollinger=BollingerData(upper=bb_upper, middle=bb_middle, lower=bb_lower),
            macd=MacdData(macd_line=macd_line, signal_line=signal_line, histogram=histogram),
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
        steps_detail=result["steps_detail"],
    )
