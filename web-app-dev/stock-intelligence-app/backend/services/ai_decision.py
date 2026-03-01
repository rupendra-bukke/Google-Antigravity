"""
AI-powered intraday decision service using Google Gemini.
- Builds a price-action prompt with real Nifty OHLC market data
- Calls Gemini 1.5 Flash with Google Search grounding for live news
- Caches result in Redis for 5 minutes to avoid duplicate API calls
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone

import pytz

logger = logging.getLogger(__name__)

IST = pytz.timezone("Asia/Kolkata")

# ── Prompt template ─────────────────────────────────────────────────────────

PRICE_ACTION_PROMPT = """
You are an expert intraday trader specializing in smart money concepts and price action analysis.

Analyze the following Nifty 50 intraday data and answer the 7-point framework below.
ALSO search and include the latest news (today's date) that could impact the Indian stock market (Nifty 50).

--- MARKET DATA ---
{market_data_block}
-------------------

FRAMEWORK:

1. Identify key levels:
   - Support and resistance
   - Previous day high/low
   - Intraday high/low
   - Psychological levels (round numbers)

2. Determine market structure:
   - Is the market trending or ranging?
   - Are highs/lows being respected or broken?

3. Check for stop-loss hunting / liquidity grab:
   - Has price recently broken a level and reversed?
   - Where are retail traders likely trapped (buyers or sellers)?

4. Identify fake breakout or real breakout:
   - Is the breakout sustained or rejected?
   - Any strong reversal candles after breakout?

5. Trade bias (IMPORTANT):
   - Based on above, what is the HIGH PROBABILITY direction now?
   - Bullish / Bearish / Wait (no trade)

6. Entry logic:
   - Should I enter now or wait?
   - Ideal entry zone
   - Stop loss level (based on structure, not random points)

7. Risk clarity:
   - Is this a high-quality setup or risky trade?
   - What confirmation is still missing?

RULES:
- Focus only on price action (no indicator-based reasoning)
- Prioritize stop-loss hunting and traps
- Avoid prediction; respond based on current structure only

IMPORTANT: Also check and include today's relevant market news (RBI, FII/DII data, global cues, major corporate events) and explain how it impacts the bias.

Respond ONLY with a valid JSON object in this exact format (no markdown, no explanation outside JSON):
{{
  "decision": "BULLISH" | "BEARISH" | "WAIT",
  "bias_strength": "HIGH" | "MEDIUM" | "LOW",
  "market_structure": "<brief description>",
  "sl_hunt_detected": true | false,
  "sl_hunt_detail": "<description or null>",
  "breakout_type": "REAL" | "FAKE" | "NONE",
  "breakout_detail": "<description or null>",
  "entry_zone": "<e.g. 25150 - 25200 or null>",
  "stop_loss": "<e.g. 25325 (above liquidity wick) or null>",
  "target": "<e.g. 24980 (PDL retest) or null>",
  "trade_quality": "HIGH" | "MEDIUM" | "RISKY",
  "missing_confirmation": "<what to wait for before entry>",
  "news_items": ["<headline 1>", "<headline 2>"],
  "news_impact": "<how news affects today's bias, 1-2 sentences>",
  "reasoning": "<full price action reasoning, 3-5 sentences>"
}}
"""


def _build_market_data_block(frames: dict, symbol: str, now: datetime) -> str:
    """Format OHLC data from multi-timeframe frames into a text block for the prompt."""
    import pandas as pd

    ist_now = now.astimezone(IST)
    lines = [
        f"Symbol      : {symbol}",
        f"Timestamp   : {ist_now.strftime('%d-%b-%Y %I:%M %p IST')}",
    ]

    # Use 3m frame for recent candles
    df3 = frames.get("3m")
    if df3 is not None and not df3.empty:
        last_price = float(df3["Close"].iloc[-1])
        lines.append(f"Current Price: ₹{last_price:,.2f}")

        # Intraday high/low
        lines.append(f"Intraday High: ₹{float(df3['High'].max()):,.2f}")
        lines.append(f"Intraday Low : ₹{float(df3['Low'].min()):,.2f}")

        # Last 5 candles table
        last5 = df3.tail(5)[["Open", "High", "Low", "Close"]].copy()
        lines.append("\nRecent 5 candles (3m):")
        lines.append("Time       |  Open  |  High  |  Low   |  Close")
        lines.append("-" * 52)
        for idx, row in last5.iterrows():
            ts = idx.strftime("%H:%M") if hasattr(idx, "strftime") else str(idx)
            lines.append(
                f"{ts}     | {row['Open']:6.0f} | {row['High']:6.0f} | {row['Low']:6.0f} | {row['Close']:6.0f}"
            )

    # Use 15m for prev day levels
    df15 = frames.get("15m")
    if df15 is not None and not df15.empty:
        today_ist = ist_now.date()
        df15.index = pd.to_datetime(df15.index)
        if df15.index.tz is None:
            df15.index = df15.index.tz_localize("UTC").tz_convert(IST)
        else:
            df15.index = df15.index.tz_convert(IST)

        today_data = df15[df15.index.date == today_ist]
        prev_data  = df15[df15.index.date < today_ist]

        if not prev_data.empty:
            lines.append(f"\nPrev Day High: ₹{float(prev_data['High'].max()):,.2f}")
            lines.append(f"Prev Day Low : ₹{float(prev_data['Low'].min()):,.2f}")
        if not today_data.empty:
            lines.append(f"Today Open   : ₹{float(today_data['Open'].iloc[0]):,.2f}")

    return "\n".join(lines)


async def get_ai_decision(frames: dict, symbol: str, now: datetime) -> dict:
    """
    Call Gemini with Google Search grounding and return structured price action decision.
    Falls back gracefully if API key is missing or call fails.
    """
    from config import settings

    if not settings.gemini_api_key:
        return _fallback("GEMINI_API_KEY not configured on Render.")

    try:
        import google.generativeai as genai

        genai.configure(api_key=settings.gemini_api_key)

        market_block = _build_market_data_block(frames, symbol, now)
        prompt = PRICE_ACTION_PROMPT.format(market_data_block=market_block)

        # Use Gemini 1.5 Flash with Google Search grounding
        model = genai.GenerativeModel(
            model_name="gemini-1.5-flash",
            tools="google_search_retrieval",  # enables live web search for news
        )

        response = model.generate_content(prompt)
        raw_text = response.text.strip()

        # Strip markdown code fences if Gemini wraps JSON in them
        if raw_text.startswith("```"):
            raw_text = raw_text.split("```")[1]
            if raw_text.startswith("json"):
                raw_text = raw_text[4:]
        raw_text = raw_text.strip()

        result = json.loads(raw_text)
        result["captured_at"] = now.astimezone(IST).isoformat()
        result["symbol"] = symbol
        return result

    except json.JSONDecodeError as e:
        logger.error("Gemini response was not valid JSON: %s", e)
        return _fallback("Gemini returned unexpected response format.")
    except Exception as e:
        logger.error("Gemini API error: %s", e)
        return _fallback(str(e))


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
