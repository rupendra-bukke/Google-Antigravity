"""Router for the /api/v1/ endpoints."""

from fastapi import APIRouter, HTTPException, Query
from datetime import datetime, timezone, timedelta
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

EXPIRY_INDEX_CONFIG = {
    "NIFTY": {
        "symbol": "^NSEI",
        "name": "Nifty 50",
        "exchange": "NSE",
        "expiry_weekday": 3,  # Thursday (Mon=0)
        "strike_step": 50,
    },
    "BANKNIFTY": {
        "symbol": "^NSEBANK",
        "name": "Bank Nifty",
        "exchange": "NSE",
        "expiry_weekday": 2,  # Wednesday
        "strike_step": 100,
    },
    "FINNIFTY": {
        "symbol": "^CNXFINSERVICE",
        "name": "Fin Nifty",
        "exchange": "NSE",
        "expiry_weekday": 1,  # Tuesday
        "strike_step": 50,
    },
    "SENSEX": {
        "symbol": "^BSESN",
        "name": "Sensex",
        "exchange": "BSE",
        "expiry_weekday": 4,  # Friday
        "strike_step": 100,
    },
}


@router.get("/gemini-models")
async def list_gemini_models():
    """
    Diagnostic: Lists all Gemini models available for the configured API key.
    Visit /api/v1/gemini-models to see exact model IDs to use.
    """
    import httpx
    from config import settings
    api_key = settings.gemini_api_key
    if not api_key:
        return {"error": "GEMINI_API_KEY not set on Render"}
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(
            f"https://generativelanguage.googleapis.com/v1beta/models?key={api_key}"
        )
        if resp.status_code != 200:
            return {"error": f"HTTP {resp.status_code}", "body": resp.text[:500]}
        data = resp.json()
        models = [
            {"name": m.get("name"), "displayName": m.get("displayName"),
             "supportedMethods": m.get("supportedGenerationMethods", [])}
            for m in data.get("models", [])
            if "generateContent" in m.get("supportedGenerationMethods", [])
        ]
        return {"available_for_generateContent": models}


@router.get("/gemini-test")
async def gemini_test():
    """
    Diagnostic: Calls Gemini with a simple test prompt and returns the RAW response text.
    Use this to see exactly what format Gemini returns (JSON, markdown-wrapped, plain text etc.)
    """
    import httpx
    from config import settings
    from services.ai_decision import GEMINI_MODELS, GEMINI_BASE
    api_key = settings.gemini_api_key
    if not api_key:
        return {"error": "GEMINI_API_KEY not set on Render"}
    payload = {
        "contents": [{"parts": [{"text": "Reply ONLY with valid JSON: {\"status\": \"ok\", \"model\": \"working\"}"}]}],
        "generationConfig": {"temperature": 0, "maxOutputTokens": 100},
    }
    results = {}
    async with httpx.AsyncClient(timeout=20) as client:
        for model in GEMINI_MODELS:
            url = GEMINI_BASE.format(model=model) + f"?key={api_key}"
            try:
                resp = await client.post(url, json=payload, headers={"Content-Type": "application/json"})
                raw = resp.json()
                text = raw.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "N/A")
                results[model] = {"status": resp.status_code, "raw_text": text}
                if resp.status_code == 200:
                    break  # Found working model — stop
            except Exception as e:
                results[model] = {"error": str(e)}
    return {"results": results, "models_tried": GEMINI_MODELS}


# â”€â”€ Basic Analyze Endpoint (preserved) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€


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


# â”€â”€ Advanced Analysis Endpoint (v2) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€


@router.get("/advanced-analyze", response_model=AdvancedAnalysis)
async def advanced_analyze(symbol: str = Query(default=None)):
    """
    Multi-timeframe advanced analysis with 6-step pipeline:
    HTF Filter â†’ Reversal Check â†’ Market Structure â†’ Scalp â†’ 3-min Confirm â†’ Strike Selection â†’ Risk.
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


# -- AI Price Action Decision Endpoint --

CACHE_KEY_PREFIX = "ai_decision:"
CACHE_TTL_SECONDS = 2700  # 45 minutes (–8 calls/day per symbol, well within 20 RPD budget)

# IST_TZ kept for date-string construction below

@router.get("/ai-decision")
async def ai_decision_endpoint(symbol: str = Query(default=None)):
    """
    Gemini-powered price action analysis.
    - Market OPEN  → Intraday price action analysis (45-min cache, only caches real signals)
    - Market CLOSED → EOD next-day outlook (20-hour cache)
    - Intraday failure → falls back to last EOD analysis (never shows blank WAIT error)
    """
    import hashlib
    from services.ai_decision import (
        cache_get, cache_set, _fallback,
        get_eod_analysis, EOD_CACHE_KEY_PREFIX, EOD_CACHE_TTL,
    )

    sym = symbol or settings.default_symbol
    now = datetime.now(timezone.utc)
    ist_now = datetime.now(timezone(timedelta(hours=5, minutes=30)))

    # Use exchange_calendars to check holiday-aware NSE market status (Mon-Fri + all public holidays)
    is_open, _ = is_indian_market_open(now)
    if is_open:
        # ── Intraday mode ──────────────────────────────────────────────────
        cache_key = f"{CACHE_KEY_PREFIX}{hashlib.md5(sym.encode()).hexdigest()}"
        cached = cache_get(cache_key)
        if cached:
            try:
                return json.loads(cached)
            except Exception:
                pass

        eod_fallback_key = f"{EOD_CACHE_KEY_PREFIX}{ist_now.strftime('%Y-%m-%d')}:{hashlib.md5(sym.encode()).hexdigest()}"

        try:
            frames = await fetch_multi_timeframe(sym)
        except Exception as exc:
            # yfinance failed — serve today's EOD as fallback
            eod_cached = cache_get(eod_fallback_key)
            if eod_cached:
                try:
                    return json.loads(eod_cached)
                except Exception:
                    pass
            return _fallback(f"Market data unavailable: {exc}")

        result = await get_ai_decision(frames, sym, now)

        # ONLY cache real BULLISH/BEARISH results \u2014 NOT WAIT/error fallbacks.
        # If we cached an error, the next 45 minutes would show the same error.
        decision = result.get("decision", "WAIT")
        bias = result.get("bias_strength", "LOW")
        is_real_analysis = decision in ("BULLISH", "BEARISH") or (decision == "WAIT" and bias != "LOW")
        if is_real_analysis:
            cache_set(cache_key, json.dumps(result), CACHE_TTL_SECONDS)
        else:
            # Gemini returned error/low-confidence WAIT \u2014 show EOD instead
            eod_cached = cache_get(eod_fallback_key)
            if eod_cached:
                try:
                    return json.loads(eod_cached)
                except Exception:
                    pass

        return result

    else:
        # ── EOD / Market-closed mode ───────────────────────────────────────
        ist_now = datetime.now(timezone(timedelta(hours=5, minutes=30)))  # IST
        date_str = ist_now.strftime("%Y-%m-%d")
        eod_key = f"{EOD_CACHE_KEY_PREFIX}{date_str}:{hashlib.md5(sym.encode()).hexdigest()}"

        cached = cache_get(eod_key)
        if cached:
            try:
                data = json.loads(cached)
                # Ensure analysis_type tag is present
                data.setdefault("analysis_type", "EOD")
                return data
            except Exception:
                pass

        # No cached EOD — run it now using last trading day data
        result = await get_eod_analysis(sym, now)
        return result


@router.get("/expiry-zero-hero")
async def expiry_zero_hero_endpoint(index: str = Query(..., description="NIFTY|BANKNIFTY|FINNIFTY|SENSEX")):
    """
    Dedicated AI endpoint for expiry-day zero-to-hero option plans.
    Independent from the main AI decision panel.
    """
    import hashlib
    from services.ai_decision import (
        cache_get,
        cache_set,
        get_expiry_zero_hero_ai,
    )

    idx = (index or "").upper().strip()
    cfg = EXPIRY_INDEX_CONFIG.get(idx)
    if not cfg:
        raise HTTPException(status_code=400, detail="Invalid index. Use NIFTY, BANKNIFTY, FINNIFTY, or SENSEX.")

    now = datetime.now(timezone.utc)
    ist_now = now.astimezone(timezone(timedelta(hours=5, minutes=30)))
    weekday = ist_now.weekday()
    expiry_today = weekday == cfg["expiry_weekday"]
    diff_days = (cfg["expiry_weekday"] - weekday + 7) % 7
    next_expiry = (ist_now + timedelta(days=diff_days)).date().isoformat()

    if not expiry_today:
        return {
            "index": idx,
            "index_name": cfg["name"],
            "exchange": cfg["exchange"],
            "symbol": cfg["symbol"],
            "expiry_today": False,
            "next_expiry": next_expiry,
            "message": f"Today is not {idx} expiry.",
            "captured_at": ist_now.isoformat(),
            "source": "info",
        }

    cache_key = f"ai_zero_hero:{ist_now.strftime('%Y-%m-%d')}:{hashlib.md5(idx.encode()).hexdigest()}"
    cached = cache_get(cache_key)
    if cached:
        try:
            payload = json.loads(cached)
            payload.setdefault("expiry_today", True)
            payload.setdefault("next_expiry", next_expiry)
            return payload
        except Exception:
            pass

    spot_price = None
    frames = {}
    try:
        frames = await fetch_multi_timeframe(cfg["symbol"])
        for key in ("5m", "3m", "15m"):
            df = frames.get(key)
            if df is not None and not df.empty:
                spot_price = float(df["Close"].iloc[-1])
                break
    except Exception:
        frames = {}

    result = await get_expiry_zero_hero_ai(
        frames=frames,
        symbol=cfg["symbol"],
        index_abbr=idx,
        index_name=cfg["name"],
        exchange=cfg["exchange"],
        strike_step=cfg["strike_step"],
        spot_price=spot_price,
        now=now,
    )
    result["expiry_today"] = True
    result["next_expiry"] = next_expiry

    # Keep one plan per expiry day; manual refresh can still regenerate after cache TTL.
    cache_set(cache_key, json.dumps(result), 1800)
    return result

