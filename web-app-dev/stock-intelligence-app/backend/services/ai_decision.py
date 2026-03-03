"""
AI-powered intraday decision service using Google Gemini REST API.
- Uses httpx (already installed) to call Gemini directly — no SDK needed
- Builds a price-action + smart money prompt with real Nifty OHLC data
- Gemini's training includes recent market knowledge for news context
- Results cached via Upstash Redis REST API for 5 minutes
"""

from __future__ import annotations

import json
import logging
import re
from datetime import datetime, timezone, timedelta

import httpx
import pytz

logger = logging.getLogger(__name__)

IST = pytz.timezone("Asia/Kolkata")

# gemini-2.5-flash is the only model with free-tier quota on this project (20 RPD, 5 RPM)
# gemini-2.0-flash shows 0/0 quota in AI Studio -> instant 429
# Try multiple name variants because the exact preview ID changes over time
GEMINI_MODELS = [
    "gemini-2.5-flash",                    # GA name (preferred)
    "gemini-2.5-flash-latest",             # latest alias
    "gemini-2.5-flash-preview-04-17",      # known preview name
    "gemini-2.5-flash-preview-05-20",      # newer preview
    "gemini-1.5-flash-latest",             # last resort older model
]
GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"

# ── Prompt template ──────────────────────────────────────────────────────────

PRICE_ACTION_PROMPT = """You are an expert intraday trader for NSE Nifty 50 (Indian market) using smart money & price action.

Market snapshot:
{market_data_block}

Analyze using smart money concepts: key levels, structure, SL-hunt, bias, entry.

IMPORTANT — Reply ONLY with valid JSON, no markdown fences, no text outside JSON.
Keep ALL string values SHORT (under 20 words each) to avoid truncation.

{{
  "decision": "BULLISH or BEARISH or WAIT",
  "bias_strength": "HIGH or MEDIUM or LOW",
  "market_structure": "one short sentence max 15 words",
  "sl_hunt_detected": true or false,
  "sl_hunt_detail": "one short sentence or null",
  "breakout_type": "REAL or FAKE or NONE",
  "breakout_detail": "one short sentence or null",
  "entry_zone": "price range e.g. 25150-25200 or null",
  "stop_loss": "price e.g. 25325 or null",
  "target": "price e.g. 24980 or null",
  "trade_quality": "HIGH or MEDIUM or RISKY",
  "missing_confirmation": "what to wait for, max 10 words",
  "news_items": ["headline max 8 words", "headline max 8 words"],
  "news_impact": "one sentence max 20 words",
  "reasoning": "two sentences max 40 words total"
}}"""


def _build_market_data_block(frames: dict, symbol: str, now: datetime) -> tuple:
    """
    Format OHLC data into a text block for the Gemini prompt.
    Returns (market_block_text, has_live_price).
    Uses 5m as primary source — far more reliable for NSE via yfinance than 1m.
    Falls back to 3m (from 1m) if 5m is also unavailable.
    """
    import pandas as pd

    ist_now = now.astimezone(IST)
    lines = [
        f"Symbol      : {symbol}",
        f"Timestamp   : {ist_now.strftime('%d-%b-%Y %I:%M %p IST')}",
    ]
    has_live_price = False

    # ── Current price + recent candles: prefer 5m then 3m ───────────
    for frame_key in ("5m", "3m"):
        df = frames.get(frame_key)
        if df is not None and not df.empty:
            current_price = float(df["Close"].iloc[-1])
            lines.append(f"Current Price: Rs.{current_price:,.2f}")
            lines.append(f"Intraday High: Rs.{float(df['High'].max()):,.2f}")
            lines.append(f"Intraday Low : Rs.{float(df['Low'].min()):,.2f}")
            recent = df.tail(5)[["Open", "High", "Low", "Close"]]
            lines.append(f"\nRecent 5 candles ({frame_key}): Open | High | Low | Close")
            for idx, row in recent.iterrows():
                ts = idx.strftime("%H:%M") if hasattr(idx, "strftime") else str(idx)
                lines.append(
                    f"  {ts} | {row['Open']:.0f} | {row['High']:.0f} | {row['Low']:.0f} | {row['Close']:.0f}"
                )
            has_live_price = True
            break

    # ── Prev day levels + today open: 15m is reliable ────────────────
    df15 = frames.get("15m")
    if df15 is not None and not df15.empty:
        today_ist = ist_now.date()
        df15 = df15.copy()
        df15.index = pd.to_datetime(df15.index)
        if df15.index.tz is None:
            df15.index = df15.index.tz_localize("UTC").tz_convert(IST)
        else:
            df15.index = df15.index.tz_convert(IST)
        prev_data  = df15[df15.index.date < today_ist]
        today_data = df15[df15.index.date == today_ist]
        if not prev_data.empty:
            lines.append(f"Prev Day High: Rs.{float(prev_data['High'].max()):,.2f}")
            lines.append(f"Prev Day Low : Rs.{float(prev_data['Low'].min()):,.2f}")
        if not today_data.empty:
            lines.append(f"Today Open   : Rs.{float(today_data['Open'].iloc[0]):,.2f}")
            if not has_live_price:
                # 5m and 3m both empty: use 15m as last resort
                lines.append(f"Today High (15m) : Rs.{float(today_data['High'].max()):,.2f}")
                lines.append(f"Today Low  (15m) : Rs.{float(today_data['Low'].min()):,.2f}")
                lines.append(f"Latest Close(15m): Rs.{float(today_data['Close'].iloc[-1]):,.2f}")
                has_live_price = True

    # ── Hourly candles for HTF trend ─────────────────────────
    df1h = frames.get("1h")
    if df1h is not None and not df1h.empty:
        last_3h = df1h.tail(3)[["Open", "High", "Low", "Close"]]
        lines.append("\nLast 3 hourly candles (HTF trend): Open | High | Low | Close")
        for idx, row in last_3h.iterrows():
            ts = idx.strftime("%H:%M") if hasattr(idx, "strftime") else str(idx)
            lines.append(
                f"  {ts} | {row['Open']:.0f} | {row['High']:.0f} | {row['Low']:.0f} | {row['Close']:.0f}"
            )

    return "\n".join(lines), has_live_price


async def _call_gemini(prompt: str, api_key: str) -> str:
    """Call Gemini via REST API, trying each model in GEMINI_MODELS until one succeeds.
    - 404: try next model (model not available)
    - 429: stop immediately (quota/rate-limit — retrying wastes quota)
    """
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.3,
            "maxOutputTokens": 8000,   # Raised from 3000 — intraday JSON was being truncated mid-field
        },
    }
    last_error: Exception | None = None
    async with httpx.AsyncClient(timeout=45) as client:
        for model in GEMINI_MODELS:
            url = GEMINI_BASE.format(model=model) + f"?key={api_key}"
            try:
                resp = await client.post(url, json=payload, headers={"Content-Type": "application/json"})
                if resp.status_code == 429:
                    # Rate limit — don't retry other models, raise directly
                    logger.warning("Gemini rate limit (429) hit on model %s", model)
                    resp.raise_for_status()
                if resp.status_code == 404:
                    logger.warning("Model %s returned 404, trying next...", model)
                    last_error = httpx.HTTPStatusError(f"{model} 404", request=resp.request, response=resp)
                    continue
                resp.raise_for_status()
                data = resp.json()
                logger.info("Gemini call succeeded with model: %s", model)
                return data["candidates"][0]["content"]["parts"][0]["text"]
            except httpx.HTTPStatusError as e:
                if e.response.status_code == 404:
                    last_error = e
                    continue
                raise  # 429 and other errors propagate immediately
    raise last_error or RuntimeError("All Gemini models returned 404")



def _extract_json(raw_text: str) -> str:
    """
    Robustly extract JSON from Gemini's response.
    Handles: plain JSON, ```json...```, ``` ...```, whitespace variants, uppercase JSON.
    Also handles TRUNCATED responses where Gemini started a code fence but got cut off.
    """
    text = raw_text.strip()

    # Strategy 1: Complete fenced JSON block (```json...```)
    fence_match = re.search(
        r'```(?:json|JSON)?\s*([\s\S]*?)```',
        text, re.IGNORECASE | re.DOTALL
    )
    if fence_match:
        candidate = fence_match.group(1).strip()
        if candidate.startswith("{"):
            return candidate

    # Strategy 1b: Opening fence but NO closing fence (truncated response)
    # Extract everything after the ```json marker to end of string
    partial_fence = re.search(r'```(?:json|JSON)?\s*(\{[\s\S]+)$', text, re.IGNORECASE | re.DOTALL)
    if partial_fence:
        return partial_fence.group(1).strip()

    # Strategy 2: If text already starts with { take it as-is
    if text.startswith("{"):
        return text

    # Strategy 3: Find the first JSON object block { ... } regardless of surrounding text
    obj_match = re.search(r'\{[\s\S]*\}', text)
    if obj_match:
        return obj_match.group(0)

    # Give up — return original so json.loads gives a clear error
    return text


def _repair_json(text: str) -> dict | None:
    """
    Try to repair truncated JSON by adding missing closing characters.
    Returns parsed dict if successful, None otherwise.
    """
    text = text.strip()
    if not text.startswith('{'):
        return None
    # Try closing with 0, 1, or 2 braces; also handle unclosed string + brace
    for suffix in ['', '}', '}}', '"}}', '"}']: 
        try:
            return json.loads(text + suffix)
        except (json.JSONDecodeError, ValueError):
            continue
    # Last resort: trim to last complete field (before last comma) and close
    last_comma = text.rfind(',"')
    if last_comma > 10:
        try:
            return json.loads(text[:last_comma] + '}')
        except (json.JSONDecodeError, ValueError):
            pass
    return None



async def get_ai_decision(frames: dict, symbol: str, now: datetime) -> dict:
    """
    Call Gemini with price action prompt and return structured decision dict.
    Falls back gracefully if API key is missing or call fails.
    """
    from config import settings

    if not settings.gemini_api_key:
        return _fallback("GEMINI_API_KEY not configured. Add it to Render environment variables.")

    try:
        market_block, has_live_price = _build_market_data_block(frames, symbol, now)

        # If yfinance returned no live price data, skip Gemini (saves quota) and
        # let the caller fall back to EOD. A WAIT/LOW result would also trigger that.
        if not has_live_price:
            logger.warning("No live price data available for %s — skipping Gemini call", symbol)
            return _fallback("No live market data (yfinance returned empty 5m/15m data for this symbol).")

        prompt = PRICE_ACTION_PROMPT.format(market_data_block=market_block)

        raw_text = await _call_gemini(prompt, settings.gemini_api_key)
        logger.debug("Gemini intraday raw (first 300): %s", raw_text[:300])
        text = _extract_json(raw_text)
        logger.debug("Gemini intraday extracted JSON (first 300): %s", text[:300])
        result = json.loads(text)
        result["captured_at"] = now.astimezone(IST).isoformat()
        result["symbol"] = symbol
        return result

    except json.JSONDecodeError as e:
        raw_snippet = raw_text[:600] if 'raw_text' in dir() else '?'
        extracted = _extract_json(raw_snippet) if raw_snippet != '?' else '?'
        # Try to repair truncated JSON before giving up
        repaired = _repair_json(extracted)
        if repaired:
            logger.warning("Gemini intraday JSON repaired (was truncated). Using partial result.")
            repaired.setdefault("captured_at", now.astimezone(IST).isoformat())
            repaired.setdefault("symbol", symbol)
            repaired.setdefault("decision", "WAIT")
            repaired.setdefault("bias_strength", "LOW")
            return repaired
        logger.error("Gemini intraday non-JSON | raw[:400]: %.400s | extracted[:300]: %.300s | error: %s",
                     raw_snippet, extracted, e)
        return _fallback(f"JSON parse failed. Extracted: {extracted[:200]}")
    except httpx.HTTPStatusError as e:
        body = e.response.text[:300]
        logger.error("Gemini HTTP error %s: %s", e.response.status_code, body)
        if e.response.status_code == 429:
            return _fallback(
                "⏳ Gemini rate limit reached (free tier: 15 req/min). "
                "Please wait 1-2 minutes and click Refresh."
            )
        return _fallback(f"Gemini API error {e.response.status_code}: {body}")
    except Exception as e:
        logger.error("AI decision error: %s", e)
        return _fallback(str(e))


# ── EOD Next-Day Outlook ─────────────────────────────────────────────────────

EOD_CACHE_KEY_PREFIX = "ai_eod:"
EOD_CACHE_TTL = 72000  # 20 hours

EOD_NEXT_DAY_PROMPT = """You are an expert intraday trader specializing in smart money concepts for Indian markets (NSE Nifty 50).

Today's market session has ended. Analyze the following end-of-day data and provide a NEXT TRADING DAY outlook.

--- TODAY'S SESSION DATA ---
{market_data_block}
----------------------------

ANALYSIS FRAMEWORK:

1. Session Summary: What type of day was today? (Trending up/down, inside bar, volatile range, breakout day?)
2. Close analysis: Where did price close relative to the day's range — top/middle/bottom?
3. Key levels to watch TOMORROW:
   - Major resistance zones above (where sellers may appear)
   - Major support zones below (where buyers may appear)
   - Psychological levels (round numbers like 25000, 25500)
4. Stop-loss hunting setups TOMORROW: Where are retail stop-losses clustered? Will smart money hunt them?
5. NEXT DAY BIAS: Based on today's close structure, what is the high-probability direction for TOMORROW?
   - Bullish (expect gap-up or upside continuation)
   - Bearish (expect gap-down or downside pressure)
   - Wait (market in balance — wait for the opening range)
6. Tomorrow's trade plan:
   - Best time window for entry
   - Ideal entry zone
   - Pre-market alert levels (levels to watch at the open)
7. What news or events tomorrow (RBI, FII/DII flows, US markets closing, global cues, F&O expiry) could change this bias?

RULES:
- Pure price action only (no indicator bias)
- Think like smart money — where will retail get trapped tomorrow?
- Consider today's close as the most important data point

Respond ONLY with a valid JSON object (no markdown, no explanation outside JSON):
{{
  "analysis_type": "EOD",
  "session_type": "e.g. Bullish Trending Day / Bearish Day / Inside Day / Range Day",
  "close_position": "Top of Range / Middle of Range / Bottom of Range",
  "next_day_bias": "BULLISH or BEARISH or WAIT",
  "bias_strength": "HIGH or MEDIUM or LOW",
  "key_resistance": ["level1", "level2"],
  "key_support": ["level1", "level2"],
  "sl_hunt_risk": "Where retail SL clusters are and how smart money may target them tomorrow",
  "next_day_entry_zone": "e.g. 25150 - 25200 (wait for pull-back after open) or null",
  "next_day_stop_loss": "e.g. 25325 (above today's high) or null",
  "next_day_target": "e.g. 24980 or null",
  "alert_levels": ["Watch above 25xxx for breakout entry", "Watch below 24xxx for breakdown"],
  "news_tomorrow": ["any known events tomorrow that may impact market"],
  "reasoning": "Full explanation of why this bias for tomorrow, 3-5 sentences"
}}"""


async def get_eod_analysis(symbol: str, now: datetime) -> dict:
    """
    Run end-of-day / next-trading-day outlook analysis.
    Fetches today's full session data (or last trading day if weekend).
    Caches result for 20 hours.
    """
    from config import settings
    import hashlib

    if not settings.gemini_api_key:
        return _fallback("GEMINI_API_KEY not configured on Render.")

    # Build cache key for today's EOD
    ist_now = now.astimezone(IST)
    date_str = ist_now.strftime("%Y-%m-%d")
    cache_key = f"{EOD_CACHE_KEY_PREFIX}{date_str}:{hashlib.md5(symbol.encode()).hexdigest()}"

    # Check cache first
    cached = cache_get(cache_key)
    if cached:
        try:
            return json.loads(cached)
        except Exception:
            pass

    # Fetch recent market data — get 5 days of 5m data for full day view
    try:
        import yfinance as yf
        ticker = yf.Ticker(symbol)
        df = ticker.history(period="5d", interval="5m")
        if df.empty:
            return _eod_fallback(symbol, "No market data available for EOD analysis.")

        # Convert to IST
        df.index = df.index.tz_convert(IST)

        # Get the most recent trading day's data (last day with data)
        latest_date = df.index.date[-1]
        day_df = df[df.index.date == latest_date]

        if day_df.empty:
            return _eod_fallback(symbol, "Could not isolate last trading day data.")

        # Build market data block
        open_p  = float(day_df["Open"].iloc[0])
        close_p = float(day_df["Close"].iloc[-1])
        high_p  = float(day_df["High"].max())
        low_p   = float(day_df["Low"].min())
        day_range = high_p - low_p
        close_pct = ((close_p - low_p) / day_range * 100) if day_range > 0 else 50

        market_block = (
            f"Symbol       : {symbol}\n"
            f"Session Date : {latest_date.strftime('%d-%b-%Y')}\n"
            f"Open         : Rs.{open_p:,.2f}\n"
            f"High         : Rs.{high_p:,.2f}\n"
            f"Low          : Rs.{low_p:,.2f}\n"
            f"Close        : Rs.{close_p:,.2f}\n"
            f"Day Range    : {day_range:.2f} points\n"
            f"Close in Range: {close_pct:.0f}% from Low (0%=bottom, 100%=top)\n"
            f"Net Change   : {close_p - open_p:+.2f} pts ({(close_p - open_p)/open_p*100:+.2f}%)\n"
        )

        # Last 5 candles of the day (3:00-3:30 PM)
        last5 = day_df.tail(5)[["Open", "High", "Low", "Close"]]
        market_block += "\nLast 5 candles (5m, end of session):\n"
        for idx, row in last5.iterrows():
            market_block += f"  {idx.strftime('%H:%M')} | {row['Open']:.0f} | {row['High']:.0f} | {row['Low']:.0f} | {row['Close']:.0f}\n"

        prompt = EOD_NEXT_DAY_PROMPT.format(market_data_block=market_block)
        raw_text = await _call_gemini(prompt, settings.gemini_api_key)
        logger.debug("Gemini EOD raw (first 300): %s", raw_text[:300])
        text = _extract_json(raw_text)
        logger.debug("Gemini EOD extracted JSON (first 300): %s", text[:300])
        result = json.loads(text)
        result["captured_at"] = ist_now.isoformat()
        result["session_date"] = str(latest_date)
        result["symbol"] = symbol

        # Cache for 20 hours
        cache_set(cache_key, json.dumps(result), EOD_CACHE_TTL)
        return result

    except json.JSONDecodeError as e:
        raw_snippet = raw_text[:400] if 'raw_text' in dir() else '?'
        extracted = _extract_json(raw_snippet) if raw_snippet != '?' else '?'
        logger.error("EOD non-JSON | raw[:400]: %.400s | extracted[:300]: %.300s | error: %s",
                     raw_snippet, extracted, e)
        return _eod_fallback(symbol, f"JSON parse failed. Extracted starts with: {extracted[:150]}")
    except httpx.HTTPStatusError as e:
        body = e.response.text[:300]
        logger.error("EOD Gemini HTTP error %s: %s", e.response.status_code, body)
        return _eod_fallback(symbol, f"Gemini API error {e.response.status_code}: {body}")
    except Exception as e:
        logger.error("EOD analysis error: %s", e)
        return _eod_fallback(symbol, str(e))


def _eod_fallback(symbol: str, reason: str) -> dict:
    return {
        "analysis_type": "EOD",
        "session_type": "Unavailable",
        "close_position": "Unknown",
        "next_day_bias": "WAIT",
        "bias_strength": "LOW",
        "key_resistance": [],
        "key_support": [],
        "sl_hunt_risk": "Analysis unavailable",
        "next_day_entry_zone": None,
        "next_day_stop_loss": None,
        "next_day_target": None,
        "alert_levels": [],
        "news_tomorrow": [],
        "reasoning": f"EOD analysis unavailable: {reason}",
        "captured_at": datetime.now(IST).isoformat(),
        "session_date": "",
        "symbol": symbol,
    }


# ── Upstash Redis cache helpers ──────────────────────────────────────────────

UPSTASH_URL  = ""  # loaded lazily from env
UPSTASH_TOKEN = ""

def _upstash_headers() -> dict:
    import os
    return {"Authorization": f"Bearer {os.getenv('UPSTASH_REDIS_REST_TOKEN', '')}"}

def _upstash_base() -> str:
    import os
    return os.getenv("UPSTASH_REDIS_REST_URL", "")


def cache_get(key: str) -> str | None:
    try:
        base = _upstash_base()
        if not base:
            return None
        resp = httpx.get(f"{base}/get/{key}", headers=_upstash_headers(), timeout=5)
        data = resp.json()
        return data.get("result")
    except Exception:
        return None


def cache_set(key: str, value: str, ttl_seconds: int = 300) -> None:
    """Store value in Upstash using pipeline POST — avoids URL encoding issues with JSON payloads."""
    try:
        base = _upstash_base()
        if not base:
            return
        # Use Upstash pipeline endpoint so JSON doesn't need to be URL-encoded
        payload = [["SET", key, value, "EX", ttl_seconds]]
        httpx.post(
            f"{base}/pipeline",
            headers={**_upstash_headers(), "Content-Type": "application/json"},
            content=json.dumps(payload),
            timeout=5,
        )
    except Exception:
        pass


def _fallback(reason: str) -> dict:
    """Return a safe default when Gemini is unavailable."""
    return {
        "decision": "WAIT",
        "bias_strength": "LOW",
        "market_structure": "Analysis unavailable",
        "sl_hunt_detected": False,
        "sl_hunt_detail": None,
        "breakout_type": "NONE",
        "breakout_detail": None,
        "entry_zone": None,
        "stop_loss": None,
        "target": None,
        "trade_quality": "RISKY",
        "missing_confirmation": "AI service unavailable — check manually",
        "news_items": [],
        "news_impact": reason,
        "reasoning": f"AI analysis is temporarily unavailable: {reason}",
        "captured_at": datetime.now(IST).isoformat(),
        "symbol": "—",
    }
