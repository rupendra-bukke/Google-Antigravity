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
from datetime import datetime, timezone, timedelta

import httpx
import pytz

logger = logging.getLogger(__name__)

IST = pytz.timezone("Asia/Kolkata")

GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent"

# ── Prompt template ──────────────────────────────────────────────────────────

PRICE_ACTION_PROMPT = """You are an expert intraday trader specializing in smart money concepts and price action analysis for Indian markets (NSE Nifty 50).

Analyze the following intraday data and answer the 7-point framework. Also include any relevant news or macro events that could impact Nifty 50 today.

--- MARKET DATA ---
{market_data_block}
-------------------

FRAMEWORK:

1. Key levels: Support/resistance, previous day high/low, intraday high/low, psychological levels (round numbers)
2. Market structure: Trending or ranging? Are highs/lows respected or broken?
3. Stop-loss hunting / liquidity grab: Has price broken a level and reversed? Where are retail traders trapped?
4. Fake or real breakout: Is the breakout sustained or rejected? Any strong reversal candles?
5. Trade bias: What is the HIGH PROBABILITY direction? Bullish / Bearish / Wait
6. Entry logic: Entry zone, stop loss level (structure-based, not arbitrary)
7. Risk clarity: High-quality setup or risky? What confirmation is missing?

RULES:
- Focus ONLY on price action (smart money, structure, liquidity)
- Prioritize stop-loss hunting and traps over indicator signals
- Also mention any known news events (RBI, FII/DII flows, global cues, budget, elections) that affect today's bias

Respond ONLY with a valid JSON object — no markdown, no explanation outside JSON:
{{
  "decision": "BULLISH or BEARISH or WAIT",
  "bias_strength": "HIGH or MEDIUM or LOW",
  "market_structure": "brief description",
  "sl_hunt_detected": true or false,
  "sl_hunt_detail": "description or null",
  "breakout_type": "REAL or FAKE or NONE",
  "breakout_detail": "description or null",
  "entry_zone": "e.g. 25150 - 25200 or null",
  "stop_loss": "e.g. 25325 or null",
  "target": "e.g. 24980 or null",
  "trade_quality": "HIGH or MEDIUM or RISKY",
  "missing_confirmation": "what to wait for before entry",
  "news_items": ["headline 1", "headline 2"],
  "news_impact": "how news affects today's bias, 1-2 sentences",
  "reasoning": "full price action reasoning, 3-5 sentences"
}}"""


def _build_market_data_block(frames: dict, symbol: str, now: datetime) -> str:
    """Format OHLC data into a concise text block for the prompt."""
    import pandas as pd

    ist_now = now.astimezone(IST)
    lines = [
        f"Symbol      : {symbol}",
        f"Timestamp   : {ist_now.strftime('%d-%b-%Y %I:%M %p IST')}",
    ]

    df3 = frames.get("3m")
    if df3 is not None and not df3.empty:
        last_price = float(df3["Close"].iloc[-1])
        lines.append(f"Current Price: Rs.{last_price:,.2f}")
        lines.append(f"Intraday High: Rs.{float(df3['High'].max()):,.2f}")
        lines.append(f"Intraday Low : Rs.{float(df3['Low'].min()):,.2f}")
        last5 = df3.tail(5)[["Open", "High", "Low", "Close"]]
        lines.append("\nRecent 5 candles (3m): Open | High | Low | Close")
        for idx, row in last5.iterrows():
            ts = idx.strftime("%H:%M") if hasattr(idx, "strftime") else str(idx)
            lines.append(f"  {ts} | {row['Open']:.0f} | {row['High']:.0f} | {row['Low']:.0f} | {row['Close']:.0f}")

    df15 = frames.get("15m")
    if df15 is not None and not df15.empty:
        today_ist = ist_now.date()
        df15 = df15.copy()
        df15.index = pd.to_datetime(df15.index)
        if df15.index.tz is None:
            df15.index = df15.index.tz_localize("UTC").tz_convert(IST)
        else:
            df15.index = df15.index.tz_convert(IST)
        prev_data = df15[df15.index.date < today_ist]
        today_data = df15[df15.index.date == today_ist]
        if not prev_data.empty:
            lines.append(f"Prev Day High: Rs.{float(prev_data['High'].max()):,.2f}")
            lines.append(f"Prev Day Low : Rs.{float(prev_data['Low'].min()):,.2f}")
        if not today_data.empty:
            lines.append(f"Today Open   : Rs.{float(today_data['Open'].iloc[0]):,.2f}")

    return "\n".join(lines)


async def _call_gemini(prompt: str, api_key: str) -> str:
    """Call Gemini 1.5 Flash via REST API using httpx."""
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.3,
            "maxOutputTokens": 1500,
        },
    }
    async with httpx.AsyncClient(timeout=45) as client:
        resp = await client.post(
            f"{GEMINI_URL}?key={api_key}",
            json=payload,
            headers={"Content-Type": "application/json"},
        )
        resp.raise_for_status()
        data = resp.json()
        return data["candidates"][0]["content"]["parts"][0]["text"]


async def get_ai_decision(frames: dict, symbol: str, now: datetime) -> dict:
    """
    Call Gemini with price action prompt and return structured decision dict.
    Falls back gracefully if API key is missing or call fails.
    """
    from config import settings

    if not settings.gemini_api_key:
        return _fallback("GEMINI_API_KEY not configured. Add it to Render environment variables.")

    try:
        market_block = _build_market_data_block(frames, symbol, now)
        prompt = PRICE_ACTION_PROMPT.format(market_data_block=market_block)

        raw_text = await _call_gemini(prompt, settings.gemini_api_key)

        # Strip markdown code fences if Gemini wraps JSON in them
        text = raw_text.strip()
        if text.startswith("```"):
            parts = text.split("```")
            text = parts[1] if len(parts) > 1 else text
            if text.startswith("json"):
                text = text[4:]
        text = text.strip()

        result = json.loads(text)
        result["captured_at"] = now.astimezone(IST).isoformat()
        result["symbol"] = symbol
        return result

    except json.JSONDecodeError as e:
        logger.error("Gemini returned non-JSON response: %s", e)
        return _fallback("Gemini returned an unexpected response format. Will retry on next refresh.")
    except httpx.HTTPStatusError as e:
        logger.error("Gemini HTTP error %s: %s", e.response.status_code, e.response.text)
        return _fallback(f"Gemini API error {e.response.status_code}. Check your API key on Render.")
    except Exception as e:
        logger.error("AI decision error: %s", e)
        return _fallback(str(e))


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
    try:
        base = _upstash_base()
        if not base:
            return
        httpx.get(
            f"{base}/set/{key}/{value}/ex/{ttl_seconds}",
            headers=_upstash_headers(),
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
