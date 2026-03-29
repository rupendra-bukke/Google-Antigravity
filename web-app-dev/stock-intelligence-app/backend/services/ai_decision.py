"""
AI-powered intraday decision service using Google Gemini REST API.
- Uses httpx (already installed) to call Gemini directly â€” no SDK needed
- Builds a price-action + smart money prompt with real Nifty OHLC data
- Gemini's training includes recent market knowledge for news context
- Results cached via Upstash Redis REST API for 5 minutes
"""

from __future__ import annotations

import asyncio
import html
import json
import logging
import re
from datetime import datetime, timezone, timedelta
from email.utils import parsedate_to_datetime
from xml.etree import ElementTree as ET

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

NEWS_CACHE_KEY_PREFIX = "ai_news:"
NEWS_CACHE_TTL_SECONDS = 600  # 10 minutes

# No-key RSS sources. Mix of global macro + India market relevance.
NEWS_RSS_FEEDS: list[tuple[str, str]] = [
    (
        "Google-Geo",
        "https://news.google.com/rss/search?q=(usa+iran+war+OR+middle+east+conflict+OR+sanctions+OR+geopolitical)+when:1d&hl=en-IN&gl=IN&ceid=IN:en",
    ),
    (
        "Google-Global",
        "https://news.google.com/rss/search?q=(global+markets+OR+federal+reserve+OR+bond+yields+OR+crude+oil+price)+when:1d&hl=en-IN&gl=IN&ceid=IN:en",
    ),
    (
        "Google-IndiaMkt",
        "https://news.google.com/rss/search?q=(india+stock+market+OR+nifty+OR+sensex+OR+fii+dii+OR+rupee)+when:1d&hl=en-IN&gl=IN&ceid=IN:en",
    ),
    (
        "ET-Markets",
        "https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms",
    ),
]

NEWS_KEYWORD_WEIGHTS: dict[str, int] = {
    "war": 8,
    "attack": 8,
    "missile": 8,
    "sanction": 7,
    "military": 7,
    "iran": 8,
    "usa": 5,
    "us ": 5,
    "middle east": 8,
    "oil": 7,
    "crude": 9,
    "opec": 7,
    "federal reserve": 7,
    "fed": 6,
    "interest rate": 7,
    "inflation": 6,
    "recession": 6,
    "bond yield": 6,
    "dollar": 5,
    "rupee": 6,
    "fii": 7,
    "dii": 6,
    "nifty": 7,
    "sensex": 7,
    "bank nifty": 6,
    "rbi": 6,
    "tariff": 6,
    "china": 4,
    "israel": 6,
}


def _clean_news_text(v: str) -> str:
    text = html.unescape((v or "").strip())
    text = re.sub(r"\s+", " ", text)
    return text


def _normalize_headline(v: str) -> str:
    text = _clean_news_text(v).lower()
    text = re.sub(r"[^a-z0-9 ]+", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def _parse_news_dt(v: str | None) -> datetime | None:
    if not v:
        return None
    try:
        dt = parsedate_to_datetime(v)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)
    except Exception:
        return None


def _score_news_impact(title: str, summary: str) -> int:
    text = f"{title} {summary}".lower()
    score = 0
    for kw, weight in NEWS_KEYWORD_WEIGHTS.items():
        if kw in text:
            score += weight
    # Boost for direct India market relevance.
    if any(x in text for x in ("india", "indian", "nse", "bse", "nifty", "sensex", "bank nifty")):
        score += 5
    return score


def _recent_bonus(pub_dt: datetime | None, now_utc: datetime) -> int:
    if pub_dt is None:
        return 0
    try:
        age_hours = (now_utc - pub_dt).total_seconds() / 3600.0
    except Exception:
        return 0
    if age_hours <= 2:
        return 5
    if age_hours <= 6:
        return 3
    if age_hours <= 24:
        return 1
    return 0


def _find_child_text(node, tag_names: set[str]) -> str:
    for child in list(node):
        tag = child.tag.split("}")[-1].lower()
        if tag in tag_names:
            return _clean_news_text(child.text or "")
    return ""


def _parse_feed_entries(xml_text: str, source_name: str) -> list[dict]:
    items: list[dict] = []
    if not xml_text:
        return items
    try:
        root = ET.fromstring(xml_text)
    except Exception:
        return items

    for node in root.iter():
        tag = node.tag.split("}")[-1].lower()
        if tag not in ("item", "entry"):
            continue

        title = _find_child_text(node, {"title"})
        if not title:
            continue

        summary = _find_child_text(node, {"description", "summary"})
        pub_raw = _find_child_text(node, {"pubdate", "published", "updated"})
        pub_dt = _parse_news_dt(pub_raw)
        link = ""
        for child in list(node):
            ctag = child.tag.split("}")[-1].lower()
            if ctag != "link":
                continue
            href = (child.attrib or {}).get("href")
            link = _clean_news_text(href or child.text or "")
            if link:
                break

        items.append(
            {
                "title": title,
                "summary": summary,
                "source": source_name,
                "link": link,
                "published_at": pub_dt.isoformat() if pub_dt else "",
            }
        )
    return items


async def _fetch_single_news_feed(client: httpx.AsyncClient, source_name: str, url: str) -> list[dict]:
    try:
        resp = await client.get(url)
        if resp.status_code != 200:
            return []
        return _parse_feed_entries(resp.text, source_name)
    except Exception:
        return []


def _build_live_news_prompt_block(news_items: list[str]) -> str:
    if not news_items:
        return "- No reliable live headlines fetched."
    lines = [f"- {headline}" for headline in news_items]
    return "\n".join(lines)


def _merge_unique_news(primary: list[str], secondary: list[str], limit: int = 5) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for raw in (primary or []) + (secondary or []):
        if not isinstance(raw, str):
            continue
        item = _clean_news_text(raw)
        if not item:
            continue
        key = _normalize_headline(item)
        if not key or key in seen:
            continue
        seen.add(key)
        out.append(item)
        if len(out) >= limit:
            break
    return out


async def _collect_live_market_news(now: datetime, max_items: int = 5) -> dict:
    """
    Fetch latest global + India market relevant headlines from public RSS feeds,
    rank by likely market impact, and cache for a short interval.
    """
    now_utc = now.astimezone(timezone.utc)
    bucket = now.astimezone(IST).strftime("%Y%m%d%H") + f"{now.minute // 10}"
    cache_key = f"{NEWS_CACHE_KEY_PREFIX}{bucket}"

    cached = cache_get(cache_key)
    if cached:
        try:
            payload = json.loads(cached)
            if isinstance(payload, dict):
                return payload
        except Exception:
            pass

    headers = {
        "User-Agent": "TradeCraftNewsBot/1.0 (+market-impact)",
        "Accept": "application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
    }

    async with httpx.AsyncClient(timeout=10, follow_redirects=True, headers=headers) as client:
        tasks = [
            _fetch_single_news_feed(client, source_name=src, url=url)
            for src, url in NEWS_RSS_FEEDS
        ]
        feed_results = await asyncio.gather(*tasks, return_exceptions=True)

    raw_items: list[dict] = []
    for result in feed_results:
        if isinstance(result, Exception):
            continue
        raw_items.extend(result)

    dedup: dict[str, dict] = {}
    for item in raw_items:
        key = _normalize_headline(item.get("title", ""))
        if not key:
            continue
        if key in dedup:
            continue
        dedup[key] = item

    ranked: list[tuple[int, dict]] = []
    for item in dedup.values():
        title = item.get("title", "")
        summary = item.get("summary", "")
        impact_score = _score_news_impact(title, summary)
        pub_dt = _parse_news_dt(item.get("published_at") or "")
        rank_score = impact_score * 10 + _recent_bonus(pub_dt, now_utc)
        ranked.append((rank_score, item))

    ranked.sort(key=lambda x: x[0], reverse=True)
    selected = ranked[: max(12, max_items * 2)]

    headline_list: list[str] = []
    for _, item in selected:
        title = _clean_news_text(item.get("title", ""))
        if not title:
            continue
        source = _clean_news_text(item.get("source", "News"))
        title = title[:140]
        headline_list.append(f"[{source}] {title}")
        if len(headline_list) >= max_items:
            break

    if not headline_list:
        impact_summary = "No major live trigger"
    else:
        top_rank = selected[0][0] if selected else 0
        if top_rank >= 90:
            impact_summary = "High-risk global trigger active"
        elif top_rank >= 50:
            impact_summary = "Moderate global risk cues active"
        else:
            impact_summary = "Mixed cues, monitor market reaction"

    payload = {
        "items": headline_list,
        "impact_summary": impact_summary,
        "prompt_block": _build_live_news_prompt_block(headline_list),
        "fetched_at": now.astimezone(IST).isoformat(),
        "source_count": len(raw_items),
    }
    cache_set(cache_key, json.dumps(payload), NEWS_CACHE_TTL_SECONDS)
    return payload

# â”€â”€ Prompt template â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

PRICE_ACTION_PROMPT = """Expert NSE Nifty 50 intraday trader. Analyze using smart money concepts.

{market_data_block}

LIVE NEWS SNAPSHOT (externally fetched, last 24h):
{live_news_block}

CHECKPOINT HORIZON:
{checkpoint_horizon_block}

ANALYSIS CONTEXT:
- Use ONLY the LIVE NEWS SNAPSHOT above for world events.
- Examples: war escalation, sanctions, crude oil spike, US/Asia risk-off, central bank surprises.
- If no strong global trigger is available, keep "news_items" empty and set "news_impact" to "No major trigger".
- Forecast ONLY for next checkpoint window (short horizon), not full-day prediction.

CRITICAL RULES:
1. Reply ONLY with valid JSON object â€” NO markdown, NO ```json, NO text outside.
2. Every string field MUST be under 8 words. Truncation causes errors.
3. "reasoning" max 20 words total.

{{
  "decision": "BULLISH|BEARISH|WAIT",
  "bias_strength": "HIGH|MEDIUM|LOW",
  "market_structure": "max 8 words",
  "sl_hunt_detected": false,
  "sl_hunt_detail": null,
  "breakout_type": "REAL|FAKE|NONE",
  "breakout_detail": null,
  "entry_zone": "e.g. 25150-25200",
  "stop_loss": "e.g. 25325",
  "target": "e.g. 24980",
  "trade_quality": "HIGH|MEDIUM|RISKY",
  "missing_confirmation": "max 6 words",
  "news_items": [],
  "news_impact": "max 8 words",
  "reasoning": "max 20 words"
}}"""


def _build_market_data_block(frames: dict, symbol: str, now: datetime) -> tuple:
    """
    Format OHLC data into a text block for the Gemini prompt.
    Returns (market_block_text, has_live_price).
    Uses 5m as primary source â€” far more reliable for NSE via yfinance than 1m.
    Falls back to 3m (from 1m) if 5m is also unavailable.
    """
    import pandas as pd

    ist_now = now.astimezone(IST)
    lines = [
        f"Symbol      : {symbol}",
        f"Timestamp   : {ist_now.strftime('%d-%b-%Y %I:%M %p IST')}",
    ]
    has_live_price = False

    # â”€â”€ Current price + recent candles: prefer 5m then 3m â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

    # â”€â”€ Prev day levels + today open: 15m is reliable â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

    # â”€â”€ Hourly candles for HTF trend â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
    - 429: stop immediately (quota/rate-limit â€” retrying wastes quota)
    """
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.3,
            "maxOutputTokens": 2048,
            "response_mime_type": "application/json",  # Forces pure JSON output, no markdown fences
        },
    }
    last_error: Exception | None = None
    async with httpx.AsyncClient(timeout=45) as client:
        for model in GEMINI_MODELS:
            url = GEMINI_BASE.format(model=model) + f"?key={api_key}"
            try:
                resp = await client.post(url, json=payload, headers={"Content-Type": "application/json"})
                if resp.status_code == 429:
                    # Rate limit â€” don't retry other models, raise directly
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

    # Give up â€” return original so json.loads gives a clear error
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



async def get_ai_decision(
    frames: dict,
    symbol: str,
    now: datetime,
    checkpoint_horizon: str | None = None,
) -> dict:
    """
    Call Gemini with price action prompt and return structured decision dict.
    Falls back gracefully if API key is missing or call fails.
    """
    from config import settings

    if not settings.gemini_api_key:
        return _fallback("GEMINI_API_KEY not configured. Add it to Render environment variables.")

    news_ctx = {
        "items": [],
        "impact_summary": "No major trigger",
        "prompt_block": "- No reliable live headlines fetched.",
        "fetched_at": now.astimezone(IST).isoformat(),
    }

    try:
        market_block, has_live_price = _build_market_data_block(frames, symbol, now)

        # If yfinance returned no live price data, skip Gemini (saves quota) and
        # let the caller fall back to EOD. A WAIT/LOW result would also trigger that.
        if not has_live_price:
            logger.warning("No live price data available for %s - skipping Gemini call", symbol)
            return _fallback("No live market data (yfinance returned empty 5m/15m data for this symbol).")

        news_ctx = await _collect_live_market_news(now)
        horizon_block = checkpoint_horizon or "No checkpoint context provided."
        prompt = PRICE_ACTION_PROMPT.format(
            market_data_block=market_block,
            live_news_block=news_ctx.get("prompt_block", "- No reliable live headlines fetched."),
            checkpoint_horizon_block=horizon_block,
        )

        raw_text = await _call_gemini(prompt, settings.gemini_api_key)
        logger.debug("Gemini intraday raw (first 300): %s", raw_text[:300])
        text = _extract_json(raw_text)
        logger.debug("Gemini intraday extracted JSON (first 300): %s", text[:300])
        result = json.loads(text)
        result["captured_at"] = now.astimezone(IST).isoformat()
        result["symbol"] = symbol
        result["analysis_status"] = "full"
        result["news_items"] = _merge_unique_news(
            result.get("news_items") if isinstance(result.get("news_items"), list) else [],
            news_ctx.get("items", []),
            limit=5,
        )
        if not result.get("news_impact"):
            result["news_impact"] = news_ctx.get("impact_summary", "No major trigger")
        result["live_news_fetched_at"] = news_ctx.get("fetched_at")
        result["news_source_count"] = int(news_ctx.get("source_count", 0) or 0)
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
            repaired["analysis_status"] = "repaired"
            repaired.setdefault("decision", "WAIT")
            repaired.setdefault("bias_strength", "LOW")
            repaired["news_items"] = _merge_unique_news(
                repaired.get("news_items") if isinstance(repaired.get("news_items"), list) else [],
                news_ctx.get("items", []),
                limit=5,
            )
            repaired.setdefault("news_impact", news_ctx.get("impact_summary", "No major trigger"))
            repaired["live_news_fetched_at"] = news_ctx.get("fetched_at")
            repaired["news_source_count"] = int(news_ctx.get("source_count", 0) or 0)
            return repaired
        logger.error("Gemini intraday non-JSON | raw[:400]: %.400s | extracted[:300]: %.300s | error: %s",
                     raw_snippet, extracted, e)
        return _fallback(f"JSON parse failed. Extracted: {extracted[:200]}")
    except httpx.HTTPStatusError as e:
        body = e.response.text[:300]
        logger.error("Gemini HTTP error %s: %s", e.response.status_code, body)
        if e.response.status_code == 429:
            return _fallback(
                "Gemini rate limit reached (free tier: 15 req/min). "
                "Please wait 1-2 minutes and click Refresh."
            )
        return _fallback(f"Gemini API error {e.response.status_code}: {body}")
    except Exception as e:
        logger.error("AI decision error: %s", e)
        return _fallback(str(e))
# â”€â”€ EOD Next-Day Outlook â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

EOD_CACHE_KEY_PREFIX = "ai_eod:"
EOD_CACHE_TTL = 604800  # 7 days (survives weekends + holiday gaps)

EOD_NEXT_DAY_PROMPT = """You are an expert intraday trader specializing in smart money concepts for Indian markets (NSE Nifty 50).

Today's market session has ended. Analyze the following end-of-day data and provide a NEXT TRADING DAY outlook.

--- TODAY'S SESSION DATA ---
{market_data_block}
----------------------------

--- LIVE NEWS SNAPSHOT (last 24h) ---
{live_news_block}
-------------------------------------

ANALYSIS FRAMEWORK:

1. Session Summary: What type of day was today? (Trending up/down, inside bar, volatile range, breakout day?)
2. Close analysis: Where did price close relative to the day's range â€” top/middle/bottom?
3. Key levels to watch TOMORROW:
   - Major resistance zones above (where sellers may appear)
   - Major support zones below (where buyers may appear)
   - Psychological levels (round numbers like 25000, 25500)
4. Stop-loss hunting setups TOMORROW: Where are retail stop-losses clustered? Will smart money hunt them?
5. NEXT DAY BIAS: Based on today's close structure, what is the high-probability direction for TOMORROW?
   - Bullish (expect gap-up or upside continuation)
   - Bearish (expect gap-down or downside pressure)
   - Wait (market in balance â€” wait for the opening range)
6. Tomorrow's trade plan:
   - Best time window for entry
   - Ideal entry zone
   - Pre-market alert levels (levels to watch at the open)
7. What news or events tomorrow (RBI, FII/DII flows, US markets closing, global cues, F&O expiry) could change this bias?

RULES:
- Pure price action only (no indicator bias)
- Think like smart money â€” where will retail get trapped tomorrow?
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

ZERO_HERO_PROMPT = """Act as an intraday options trader specializing in expiry-day trading for NIFTY / BANK NIFTY / SENSEX using a VWAP breakout strategy.

Follow this exact structured approach:
1. Pre-trade setup:
- Focus only on expiry day
- Trading window: 3:00 PM to 3:10 PM IST (last 10 minutes only)
- Use 5-minute chart

2. Entry rules:
- Bullish (BUY CALL) only if price breaks day high OR crosses above VWAP with momentum.
- Bearish (BUY PUT) only if price breaks day low OR crosses below VWAP with momentum.
- If no clear breakout, return NO TRADE.

3. Trap avoidance:
- Flag fake breakout risk.
- Breakout candle must have a strong body, not wick-dominant.
- Avoid entries in choppy zone between VWAP and day range midpoint.

4. Trade execution:
- Strike must be ATM or 1-step ITM only.
- Stop loss must be 30-35 percent premium risk.
- Keep position sizing low risk.

5. Target management:
- Target 1: 60-70 percent premium gain; book 30-40 percent.
- After T1: move SL to cost.
- Target 2: open target (100-120 percent or more).

6. Market context filter:
- Mention if market is trending or sideways.
- Avoid trade if extremely sideways near closing.

INDEX CONTEXT:
- Index: {index_abbr} ({index_name}) | Exchange: {exchange}
- Spot now: {spot_text}
- ATM strike step: {strike_step}
- Timestamp IST: {timestamp_ist}

MARKET SETUP:
{market_data_block}

LIVE NEWS SNAPSHOT (last 24h):
{live_news_block}

Return ONLY valid JSON (no markdown) in this exact structure:
{{
  "trade_type": "CALL|PUT|NO TRADE",
  "reason": "string",
  "entry": "string",
  "stop_loss": "string",
  "target_1": "string",
  "target_2": "string",
  "risk_level": "LOW|MEDIUM|HIGH",
  "confidence_pct": 0,
  "strike": "ATM/ITM option contract string or NO TRADE",
  "market_context": "TRENDING|SIDEWAYS",
  "trap_check": "string",
  "position_sizing": "string"
}}"""


def _safe_text(v: object, default: str, max_len: int = 180) -> str:
    if isinstance(v, str):
        text = _clean_news_text(v)
        if text:
            return text[:max_len]
    return default


def _as_ist_intraday_frame(frame: object) -> object | None:
    if frame is None or getattr(frame, "empty", True):
        return None
    df = frame.copy()
    try:
        if getattr(df.index, "tz", None) is None:
            df.index = df.index.tz_localize("UTC").tz_convert(IST)
        else:
            df.index = df.index.tz_convert(IST)
    except Exception:
        return None
    try:
        return df.sort_index()
    except Exception:
        return df


def _compute_market_phase(now: datetime) -> str:
    hhmm = int(now.astimezone(IST).strftime("%H%M"))
    if hhmm < 1500:
        return "PRE_3PM"
    if hhmm <= 1510:
        return "LIVE_3PM_WINDOW"
    if hhmm < 1530:
        return "POST_310_PRE_CLOSE"
    return "POST_330"


def _legacy_risk_bucket(risk_level: str) -> str:
    risk = (risk_level or "").upper()
    if risk == "LOW":
        return "HIGH"
    if risk == "MEDIUM":
        return "VERY_HIGH"
    return "EXTREME"


def _build_zero_hero_rule_plan(
    frames: dict,
    index_abbr: str,
    strike_step: int,
    spot_price: float | None,
) -> dict:
    selected_df = None
    timeframe_used = "NA"
    for key in ("5m", "3m", "15m"):
        candidate = _as_ist_intraday_frame(frames.get(key))
        if candidate is not None and not candidate.empty:
            selected_df = candidate
            timeframe_used = key
            break

    if selected_df is None:
        base_price = float(spot_price) if isinstance(spot_price, (int, float)) else None
        return {
            "trade_type": "NO TRADE",
            "reason": "NO TRADE - No valid trigger (market candles unavailable).",
            "entry": "NO TRADE - Wait for confirmed 5-minute breakout in 3:00-3:10 PM window.",
            "stop_loss": "Not applicable",
            "target_1": "Not applicable",
            "target_2": "Not applicable",
            "risk_level": "LOW",
            "confidence_pct": 35,
            "strike": "NO TRADE",
            "market_context": "SIDEWAYS",
            "trap_check": "Data unavailable: avoid forced entry.",
            "position_sizing": "Low risk only: max 1 lot if setup confirms later.",
            "setup": {
                "day_high": None,
                "day_low": None,
                "vwap": None,
                "current_price": round(base_price, 2) if base_price is not None else None,
                "price_vs_vwap": "UNKNOWN",
                "breakout_trigger": "NONE",
                "breakout_candle": "UNKNOWN",
                "choppy_zone": "UNKNOWN",
                "timeframe_used": timeframe_used,
            },
        }

    day_df = selected_df[selected_df.index.date == selected_df.index.date[-1]].copy()
    if day_df.empty:
        return {
            "trade_type": "NO TRADE",
            "reason": "NO TRADE - No valid trigger (latest session missing).",
            "entry": "NO TRADE - Wait for 3:00-3:10 PM setup.",
            "stop_loss": "Not applicable",
            "target_1": "Not applicable",
            "target_2": "Not applicable",
            "risk_level": "LOW",
            "confidence_pct": 35,
            "strike": "NO TRADE",
            "market_context": "SIDEWAYS",
            "trap_check": "Session data incomplete: avoid entry.",
            "position_sizing": "Low risk only: max 1 lot if setup confirms later.",
            "setup": {
                "day_high": None,
                "day_low": None,
                "vwap": None,
                "current_price": None,
                "price_vs_vwap": "UNKNOWN",
                "breakout_trigger": "NONE",
                "breakout_candle": "UNKNOWN",
                "choppy_zone": "UNKNOWN",
                "timeframe_used": timeframe_used,
            },
        }

    for col in ("Open", "High", "Low", "Close", "Volume"):
        day_df[col] = day_df[col].astype(float)

    typical_price = (day_df["High"] + day_df["Low"] + day_df["Close"]) / 3.0
    cum_vol = day_df["Volume"].cumsum().replace(0, float("nan"))
    day_df["VWAP"] = ((typical_price * day_df["Volume"]).cumsum() / cum_vol).fillna(day_df["Close"])

    day_open = float(day_df["Open"].iloc[0])
    day_high = float(day_df["High"].max())
    day_low = float(day_df["Low"].min())
    current_price = float(day_df["Close"].iloc[-1])
    vwap = float(day_df["VWAP"].iloc[-1])
    price_vs_vwap = "ABOVE" if current_price > vwap * 1.0002 else ("BELOW" if current_price < vwap * 0.9998 else "AT_VWAP")

    if len(day_df) > 1:
        prev_rows = day_df.iloc[:-1]
        prior_high = float(prev_rows["High"].max())
        prior_low = float(prev_rows["Low"].min())
    else:
        prior_high = day_high
        prior_low = day_low

    last_row = day_df.iloc[-1]
    prev_row = day_df.iloc[-2] if len(day_df) > 1 else day_df.iloc[-1]
    prev_vwap = float(day_df["VWAP"].iloc[-2]) if len(day_df) > 1 else vwap

    last_open = float(last_row["Open"])
    last_close = float(last_row["Close"])
    last_high = float(last_row["High"])
    last_low = float(last_row["Low"])
    candle_range = max(last_high - last_low, max(abs(last_close) * 0.0004, 0.01))
    body = abs(last_close - last_open)
    body_ratio = body / candle_range
    strong_body = body_ratio >= 0.52
    upper_wick = max(0.0, last_high - max(last_open, last_close))
    lower_wick = max(0.0, min(last_open, last_close) - last_low)
    wick_ratio = max(upper_wick, lower_wick) / candle_range
    fake_breakout = wick_ratio > 0.45 or not strong_body

    last_move_pct = ((last_close - last_open) / last_open * 100.0) if last_open else 0.0
    momentum_up = strong_body and last_move_pct >= 0.08
    momentum_down = strong_body and last_move_pct <= -0.08

    cross_above_vwap = float(prev_row["Close"]) <= prev_vwap * 1.0001 and current_price > vwap * 1.0002
    cross_below_vwap = float(prev_row["Close"]) >= prev_vwap * 0.9999 and current_price < vwap * 0.9998
    break_above_high = current_price > prior_high * 1.00025
    break_below_low = current_price < prior_low * 0.99975

    mid_range = (day_high + day_low) / 2.0
    tight_range = ((day_high - day_low) / max(abs(day_open), 1.0) * 100.0) < 0.50
    near_vwap = abs(current_price - vwap) / max(abs(vwap), 1.0) <= 0.0008
    between_vwap_mid = min(vwap, mid_range) <= current_price <= max(vwap, mid_range)
    choppy_zone = bool(tight_range or (near_vwap and between_vwap_mid))

    day_move_pct = ((current_price - day_open) / day_open * 100.0) if day_open else 0.0
    day_range_pct = ((day_high - day_low) / max(day_open, 1.0) * 100.0) if day_open else 0.0
    market_context = "TRENDING" if abs(day_move_pct) >= 0.60 and day_range_pct >= 0.90 else "SIDEWAYS"
    extremely_sideways = market_context == "SIDEWAYS" and day_range_pct < 0.55

    atm = int(round(current_price / strike_step) * strike_step) if strike_step > 0 else int(round(current_price))

    trade_type = "NO TRADE"
    breakout_trigger = "NONE"
    trigger_level = None
    invalidation_level = None

    if not extremely_sideways and not choppy_zone and not fake_breakout:
        if (break_above_high and momentum_up) or (cross_above_vwap and momentum_up):
            trade_type = "CALL"
            breakout_trigger = "ABOVE_DAY_HIGH" if break_above_high else "ABOVE_VWAP_MOMENTUM"
            trigger_level = max(prior_high, vwap)
            invalidation_level = min(last_low, vwap)
        elif (break_below_low and momentum_down) or (cross_below_vwap and momentum_down):
            trade_type = "PUT"
            breakout_trigger = "BELOW_DAY_LOW" if break_below_low else "BELOW_VWAP_MOMENTUM"
            trigger_level = min(prior_low, vwap)
            invalidation_level = max(last_high, vwap)

    score = 38
    if trade_type != "NO TRADE":
        score += 20
    if strong_body:
        score += 10
    if not fake_breakout:
        score += 8
    if not choppy_zone:
        score += 7
    if market_context == "TRENDING":
        score += 7
    if breakout_trigger in {"ABOVE_DAY_HIGH", "BELOW_DAY_LOW"}:
        score += 6
    if timeframe_used != "5m":
        score -= 8
    confidence_pct = int(max(25, min(92, round(score if trade_type != "NO TRADE" else min(score, 52)))))

    if trade_type == "CALL":
        strike_value = atm if confidence_pct >= 72 else atm - strike_step
        strike = f"{index_abbr} {strike_value} CE"
        reason = (
            "Breakout confirmation is valid on 5-minute structure: price moved above trigger with momentum, "
            "and no strong fake-break pattern."
        )
        entry = f"Buy {strike} only after 5-minute close above {trigger_level:,.2f} with momentum continuation."
        stop_loss = (
            f"Hard SL: 30-35% premium risk. Spot invalidation below {invalidation_level:,.2f}. "
            "Exit immediately if trigger fails."
        )
        target_1 = "Book 30-40% quantity at 60-70% premium gain. Move SL to cost."
        target_2 = "Hold remaining for 100-120%+ burst while trailing SL candle-by-candle."
    elif trade_type == "PUT":
        strike_value = atm if confidence_pct >= 72 else atm + strike_step
        strike = f"{index_abbr} {strike_value} PE"
        reason = (
            "Breakdown confirmation is valid on 5-minute structure: price moved below trigger with momentum, "
            "and no strong fake-break pattern."
        )
        entry = f"Buy {strike} only after 5-minute close below {trigger_level:,.2f} with momentum continuation."
        stop_loss = (
            f"Hard SL: 30-35% premium risk. Spot invalidation above {invalidation_level:,.2f}. "
            "Exit immediately if trigger fails."
        )
        target_1 = "Book 30-40% quantity at 60-70% premium gain. Move SL to cost."
        target_2 = "Hold remaining for 100-120%+ burst while trailing SL candle-by-candle."
    else:
        strike = "NO TRADE"
        reason = "NO TRADE - No valid trigger."
        if extremely_sideways:
            reason = "NO TRADE - Market is extremely sideways near close."
        elif choppy_zone:
            reason = "NO TRADE - Price is in choppy zone between VWAP and range."
        elif fake_breakout:
            reason = "NO TRADE - Breakout candle is wick-dominant (possible trap)."
        entry = "NO TRADE - Wait for strict breakout confirmation only."
        stop_loss = "Not applicable"
        target_1 = "Not applicable"
        target_2 = "Not applicable"

    risk_level = "LOW" if trade_type == "NO TRADE" else ("MEDIUM" if confidence_pct >= 74 else "HIGH")
    trap_check = (
        "Breakout candle has acceptable body strength; trap risk controlled."
        if not fake_breakout
        else "Fake breakout risk detected: wick-dominant candle, avoid blind entry."
    )
    if choppy_zone:
        trap_check = "Choppy zone detected between VWAP and range midpoint; avoid entry."

    return {
        "trade_type": trade_type,
        "reason": reason,
        "entry": entry,
        "stop_loss": stop_loss,
        "target_1": target_1,
        "target_2": target_2,
        "risk_level": risk_level,
        "confidence_pct": confidence_pct,
        "strike": strike,
        "market_context": market_context,
        "trap_check": trap_check,
        "position_sizing": "Low risk sizing: risk <= 1% capital, start with one lot only.",
        "setup": {
            "day_high": round(day_high, 2),
            "day_low": round(day_low, 2),
            "vwap": round(vwap, 2),
            "current_price": round(current_price, 2),
            "price_vs_vwap": price_vs_vwap,
            "breakout_trigger": breakout_trigger,
            "breakout_candle": "STRONG_BODY" if strong_body else "WICKY",
            "choppy_zone": "YES" if choppy_zone else "NO",
            "timeframe_used": timeframe_used,
        },
        "analysis_status": "rule_based",
    }


def _build_zero_hero_market_block(
    rule_plan: dict,
    symbol: str,
    index_abbr: str,
    index_name: str,
    exchange: str,
    strike_step: int,
    now: datetime,
) -> str:
    setup = rule_plan.get("setup", {}) if isinstance(rule_plan.get("setup"), dict) else {}
    return "\n".join(
        [
            f"Symbol: {symbol}",
            f"Index: {index_abbr} ({index_name}) | Exchange: {exchange}",
            f"Timestamp IST: {now.astimezone(IST).strftime('%d-%b-%Y %H:%M')}",
            f"Strike step: {strike_step}",
            f"Day High: {setup.get('day_high')}",
            f"Day Low: {setup.get('day_low')}",
            f"VWAP: {setup.get('vwap')}",
            f"Current Price: {setup.get('current_price')}",
            f"Price vs VWAP: {setup.get('price_vs_vwap')}",
            f"Rule Trigger Status: {setup.get('breakout_trigger')}",
            f"Candle Quality: {setup.get('breakout_candle')}",
            f"Choppy Zone: {setup.get('choppy_zone')}",
            f"Rule Baseline Trade Type: {rule_plan.get('trade_type', 'NO TRADE')}",
            f"Rule Baseline Reason: {rule_plan.get('reason', 'No trigger')}",
        ]
    )


def _build_zero_hero_payload(
    index_abbr: str,
    index_name: str,
    exchange: str,
    symbol: str,
    spot_price: float | None,
    now: datetime,
    plan: dict,
    source: str,
    source_reason: str | None = None,
    news_ctx: dict | None = None,
) -> dict:
    safe_news = news_ctx if isinstance(news_ctx, dict) else {}
    news_items = _merge_unique_news([], safe_news.get("items", []), limit=4)
    risk_level = _safe_text(plan.get("risk_level"), "HIGH", 10).upper()
    trade_type = _safe_text(plan.get("trade_type"), "NO TRADE", 12).upper()
    confidence_pct = plan.get("confidence_pct", 40)
    if isinstance(confidence_pct, str):
        match = re.search(r"\d{1,3}", confidence_pct)
        confidence_pct = int(match.group()) if match else 40
    elif isinstance(confidence_pct, (int, float)):
        confidence_pct = int(round(confidence_pct))
    else:
        confidence_pct = 40
    confidence_pct = int(max(0, min(100, confidence_pct)))

    if trade_type == "NO TRADE":
        risk_level = "LOW"
        confidence_pct = min(confidence_pct, 55)
        headline = "NO TRADE - Strict 3PM breakout trigger not confirmed"
    else:
        headline = f"{trade_type} setup active in strict 3:00-3:10 PM window"

    return {
        "index": index_abbr,
        "index_name": index_name,
        "exchange": exchange,
        "symbol": symbol,
        "spot": round(float(spot_price), 2) if isinstance(spot_price, (int, float)) else None,
        "trade_type": trade_type,
        "reason": _safe_text(plan.get("reason"), "NO TRADE - No valid trigger.", 260),
        "entry": _safe_text(plan.get("entry"), "NO TRADE - Wait for valid trigger.", 260),
        "stop_loss": _safe_text(plan.get("stop_loss"), "Not applicable", 260),
        "target_1": _safe_text(plan.get("target_1"), "Not applicable", 180),
        "target_2": _safe_text(plan.get("target_2"), "Not applicable", 180),
        "risk_level": risk_level,
        "confidence_pct": confidence_pct,
        "strike": _safe_text(plan.get("strike"), "NO TRADE", 60),
        "market_context": _safe_text(plan.get("market_context"), "SIDEWAYS", 20).upper(),
        "trap_check": _safe_text(plan.get("trap_check"), "Avoid entries without clean breakout confirmation.", 220),
        "position_sizing": _safe_text(plan.get("position_sizing"), "Low risk sizing: risk <= 1% capital.", 180),
        "setup": plan.get("setup", {}),
        "headline": headline,
        "overall_risk": _legacy_risk_bucket(risk_level),
        "market_phase": _compute_market_phase(now),
        "no_trade_filter": _safe_text(plan.get("trap_check"), "Skip if setup trigger is not confirmed.", 180),
        "risk_note": _safe_text(plan.get("position_sizing"), "Use low risk position sizing and hard stop.", 180),
        "windows": [],
        "source": source,
        "source_reason": source_reason or "",
        "analysis_status": "ok" if source == "ai" else "fallback",
        "news_items": news_items,
        "captured_at": now.astimezone(IST).isoformat(),
        "live_news_fetched_at": safe_news.get("fetched_at"),
        "news_source_count": int(safe_news.get("source_count", 0) or 0),
    }


def _zero_hero_fallback(
    frames: dict,
    index_abbr: str,
    index_name: str,
    exchange: str,
    symbol: str,
    strike_step: int,
    spot_price: float | None,
    now: datetime,
    reason: str,
) -> dict:
    rule_plan = _build_zero_hero_rule_plan(
        frames=frames,
        index_abbr=index_abbr,
        strike_step=strike_step,
        spot_price=spot_price,
    )
    return _build_zero_hero_payload(
        index_abbr=index_abbr,
        index_name=index_name,
        exchange=exchange,
        symbol=symbol,
        spot_price=spot_price,
        now=now,
        plan=rule_plan,
        source="fallback",
        source_reason=reason,
        news_ctx=None,
    )


async def get_expiry_zero_hero_ai(
    frames: dict,
    symbol: str,
    index_abbr: str,
    index_name: str,
    exchange: str,
    strike_step: int,
    spot_price: float | None,
    now: datetime,
) -> dict:
    from config import settings

    rule_plan = _build_zero_hero_rule_plan(
        frames=frames,
        index_abbr=index_abbr,
        strike_step=strike_step,
        spot_price=spot_price,
    )

    market_block = _build_zero_hero_market_block(
        rule_plan=rule_plan,
        symbol=symbol,
        index_abbr=index_abbr,
        index_name=index_name,
        exchange=exchange,
        strike_step=strike_step,
        now=now,
    )
    spot_text = f"{spot_price:,.2f}" if isinstance(spot_price, (int, float)) else "NA"
    news_ctx = {
        "items": [],
        "prompt_block": "- No reliable live headlines fetched.",
        "fetched_at": now.astimezone(IST).isoformat(),
        "source_count": 0,
    }

    if not settings.gemini_api_key:
        return _build_zero_hero_payload(
            index_abbr=index_abbr,
            index_name=index_name,
            exchange=exchange,
            symbol=symbol,
            spot_price=spot_price,
            now=now,
            plan=rule_plan,
            source="fallback",
            source_reason="GEMINI_API_KEY not configured.",
            news_ctx=news_ctx,
        )

    try:
        news_ctx = await _collect_live_market_news(now, max_items=4)
        prompt = ZERO_HERO_PROMPT.format(
            index_abbr=index_abbr,
            index_name=index_name,
            exchange=exchange,
            spot_text=spot_text,
            strike_step=strike_step,
            timestamp_ist=now.astimezone(IST).strftime("%d-%b-%Y %H:%M"),
            market_data_block=market_block,
            live_news_block=news_ctx.get("prompt_block", "- No reliable live headlines fetched."),
        )
        raw_text = await _call_gemini(prompt, settings.gemini_api_key)
        parsed = json.loads(_extract_json(raw_text))

        ai_plan = dict(rule_plan)
        parsed_trade_type = _safe_text(parsed.get("trade_type"), ai_plan.get("trade_type", "NO TRADE"), 12).upper()
        if parsed_trade_type in {"CALL", "PUT", "NO TRADE"}:
            ai_plan["trade_type"] = parsed_trade_type

        parsed_risk = _safe_text(parsed.get("risk_level"), ai_plan.get("risk_level", "HIGH"), 12).upper()
        if parsed_risk in {"LOW", "MEDIUM", "HIGH"}:
            ai_plan["risk_level"] = parsed_risk

        raw_conf = parsed.get("confidence_pct")
        if isinstance(raw_conf, (int, float)):
            ai_plan["confidence_pct"] = int(round(raw_conf))
        elif isinstance(raw_conf, str):
            conf_match = re.search(r"\d{1,3}", raw_conf)
            if conf_match:
                ai_plan["confidence_pct"] = int(conf_match.group())

        ai_plan["reason"] = _safe_text(parsed.get("reason"), ai_plan.get("reason", "NO TRADE - No valid trigger."), 260)
        ai_plan["entry"] = _safe_text(parsed.get("entry"), ai_plan.get("entry", "NO TRADE - Wait for valid trigger."), 260)
        ai_plan["stop_loss"] = _safe_text(parsed.get("stop_loss"), ai_plan.get("stop_loss", "Not applicable"), 260)
        ai_plan["target_1"] = _safe_text(parsed.get("target_1"), ai_plan.get("target_1", "Not applicable"), 180)
        ai_plan["target_2"] = _safe_text(parsed.get("target_2"), ai_plan.get("target_2", "Not applicable"), 180)
        ai_plan["strike"] = _safe_text(parsed.get("strike"), ai_plan.get("strike", "NO TRADE"), 60)
        ai_plan["market_context"] = _safe_text(parsed.get("market_context"), ai_plan.get("market_context", "SIDEWAYS"), 20).upper()
        ai_plan["trap_check"] = _safe_text(parsed.get("trap_check"), ai_plan.get("trap_check", ""), 220)
        ai_plan["position_sizing"] = _safe_text(parsed.get("position_sizing"), ai_plan.get("position_sizing", ""), 180)

        if ai_plan.get("trade_type") == "NO TRADE":
            ai_plan["risk_level"] = "LOW"
            ai_plan["strike"] = "NO TRADE"

        return _build_zero_hero_payload(
            index_abbr=index_abbr,
            index_name=index_name,
            exchange=exchange,
            symbol=symbol,
            spot_price=spot_price,
            now=now,
            plan=ai_plan,
            source="ai",
            source_reason="",
            news_ctx=news_ctx,
        )
    except Exception as e:
        logger.error("Expiry zero-to-hero AI error: %s", e)
        return _zero_hero_fallback(
            frames=frames,
            index_abbr=index_abbr,
            index_name=index_name,
            exchange=exchange,
            symbol=symbol,
            strike_step=strike_step,
            spot_price=spot_price,
            now=now,
            reason=str(e),
        )

def _classify_eod_session(net_pct: float, close_pct: float) -> tuple[str, str, str, str]:
    if close_pct >= 67:
        close_position = "Top of Range"
    elif close_pct <= 33:
        close_position = "Bottom of Range"
    else:
        close_position = "Middle of Range"

    if net_pct >= 1.2:
        session_type = "Bullish Trend Day"
    elif net_pct <= -1.2:
        session_type = "Bearish Trend Day"
    elif net_pct >= 0.4 and close_pct >= 67:
        session_type = "Bullish Closing Day"
    elif net_pct <= -0.4 and close_pct <= 33:
        session_type = "Bearish Closing Day"
    else:
        session_type = "Range Day"

    if net_pct >= 0.7 and close_pct >= 58:
        next_day_bias = "BULLISH"
    elif net_pct <= -0.7 and close_pct <= 42:
        next_day_bias = "BEARISH"
    else:
        next_day_bias = "WAIT"

    abs_move = abs(net_pct)
    if abs_move >= 1.5:
        bias_strength = "HIGH"
    elif abs_move >= 0.7:
        bias_strength = "MEDIUM"
    else:
        bias_strength = "LOW"

    return session_type, close_position, next_day_bias, bias_strength


def _format_level_list(values: list[float], reverse: bool = False, limit: int = 3) -> list[str]:
    seen: set[int] = set()
    out: list[str] = []
    for v in sorted(values, reverse=reverse):
        key = int(round(v))
        if key in seen:
            continue
        seen.add(key)
        out.append(f"{v:,.2f}")
        if len(out) >= limit:
            break
    return out


async def _build_rule_based_eod_fallback(
    symbol: str,
    now: datetime,
    reason: str,
    news_ctx: dict | None = None,
) -> dict:
    """
    Build a deterministic EOD payload from market data when Gemini output
    is unavailable. This keeps UI values useful instead of Unknown/Unavailable.
    """
    ist_now = now.astimezone(IST)
    safe_news = news_ctx if isinstance(news_ctx, dict) else {}
    news_items = safe_news.get("items") if isinstance(safe_news.get("items"), list) else []

    try:
        import yfinance as yf

        ticker = yf.Ticker(symbol)
        intraday = ticker.history(period="7d", interval="5m", auto_adjust=False, actions=False, prepost=False)
        if intraday is None or intraday.empty:
            raise ValueError("No intraday market data available for rule fallback.")

        if intraday.index.tz is None:
            intraday.index = intraday.index.tz_localize("UTC").tz_convert(IST)
        else:
            intraday.index = intraday.index.tz_convert(IST)

        latest_date = intraday.index.date[-1]
        day_df = intraday[intraday.index.date == latest_date]
        if day_df.empty:
            raise ValueError("Could not isolate the latest session for rule fallback.")

        open_p = float(day_df["Open"].iloc[0])
        close_p = float(day_df["Close"].iloc[-1])
        high_p = float(day_df["High"].max())
        low_p = float(day_df["Low"].min())
        day_range = max(high_p - low_p, max(close_p * 0.002, 1.0))
        net_pct = ((close_p - open_p) / open_p * 100.0) if open_p else 0.0
        close_pct = ((close_p - low_p) / day_range * 100.0) if day_range > 0 else 50.0

        session_type, close_position, next_day_bias, bias_strength = _classify_eod_session(net_pct, close_pct)

        daily_df = ticker.history(period="2mo", interval="1d", auto_adjust=False, actions=False)
        highs = [high_p]
        lows = [low_p]
        if daily_df is not None and not daily_df.empty:
            recent = daily_df.tail(15)
            highs.extend([float(recent["High"].max()), float(recent["High"].tail(5).max())])
            lows.extend([float(recent["Low"].min()), float(recent["Low"].tail(5).min())])

        key_resistance = _format_level_list(highs, reverse=True)
        key_support = _format_level_list(lows, reverse=False)

        if next_day_bias == "BULLISH":
            next_day_entry_zone = f"{(close_p - day_range * 0.20):,.2f} - {(close_p - day_range * 0.05):,.2f}"
            next_day_stop_loss = f"{(low_p - day_range * 0.08):,.2f}"
            next_day_target = f"{(close_p + day_range * 0.80):,.2f}"
            sl_hunt_risk = "Watch for early sweep below support before upside continuation."
        elif next_day_bias == "BEARISH":
            next_day_entry_zone = f"{(close_p + day_range * 0.05):,.2f} - {(close_p + day_range * 0.20):,.2f}"
            next_day_stop_loss = f"{(high_p + day_range * 0.08):,.2f}"
            next_day_target = f"{(close_p - day_range * 0.80):,.2f}"
            sl_hunt_risk = "Watch for early sweep above resistance before downside continuation."
        else:
            next_day_entry_zone = None
            next_day_stop_loss = None
            next_day_target = None
            sl_hunt_risk = "Range structure; wait for opening breakout confirmation."

        return {
            "analysis_type": "EOD",
            "session_type": session_type,
            "close_position": close_position,
            "next_day_bias": next_day_bias,
            "bias_strength": bias_strength,
            "key_resistance": key_resistance,
            "key_support": key_support,
            "sl_hunt_risk": sl_hunt_risk,
            "next_day_entry_zone": next_day_entry_zone,
            "next_day_stop_loss": next_day_stop_loss,
            "next_day_target": next_day_target,
            "alert_levels": [
                f"Above {high_p:,.2f} confirms upside breakout",
                f"Below {low_p:,.2f} confirms downside breakdown",
            ],
            "news_tomorrow": _merge_unique_news([], news_items, limit=6),
            "reasoning": (
                "Rule-based EOD fallback used because AI output was unavailable. "
                f"Reason: {reason[:90]}"
            ),
            "captured_at": ist_now.isoformat(),
            "session_date": str(latest_date),
            "symbol": symbol,
            "analysis_status": "fallback",
            "fallback_source": "rule_based",
            "live_news_fetched_at": safe_news.get("fetched_at"),
            "news_source_count": int(safe_news.get("source_count", 0) or 0),
        }
    except Exception as exc:
        logger.warning("Rule-based EOD fallback failed for %s: %s", symbol, exc)
        return _eod_fallback(symbol, reason)


async def get_eod_analysis(symbol: str, now: datetime) -> dict:
    """
    Run end-of-day / next-trading-day outlook analysis.
    Fetches today's full session data (or last trading day if weekend).
    Caches result for 20 hours.
    """
    from config import settings
    import hashlib

    news_ctx = {
        "items": [],
        "impact_summary": "No major trigger",
        "prompt_block": "- No reliable live headlines fetched.",
        "fetched_at": now.astimezone(IST).isoformat(),
    }

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

    if not settings.gemini_api_key:
        fallback_payload = await _build_rule_based_eod_fallback(
            symbol=symbol,
            now=now,
            reason="GEMINI_API_KEY not configured on Render.",
            news_ctx=news_ctx,
        )
        cache_set(cache_key, json.dumps(fallback_payload), EOD_CACHE_TTL)
        return fallback_payload

    # Fetch recent market data - get 5 days of 5m data for full day view
    try:
        import yfinance as yf
        ticker = yf.Ticker(symbol)
        df = ticker.history(period="5d", interval="5m")
        if df.empty:
            fallback_payload = await _build_rule_based_eod_fallback(
                symbol=symbol,
                now=now,
                reason="No market data available for EOD analysis.",
                news_ctx=news_ctx,
            )
            cache_set(cache_key, json.dumps(fallback_payload), EOD_CACHE_TTL)
            return fallback_payload

        # Convert to IST
        df.index = df.index.tz_convert(IST)

        # Get the most recent trading day's data (last day with data)
        latest_date = df.index.date[-1]
        day_df = df[df.index.date == latest_date]

        if day_df.empty:
            fallback_payload = await _build_rule_based_eod_fallback(
                symbol=symbol,
                now=now,
                reason="Could not isolate last trading day data.",
                news_ctx=news_ctx,
            )
            cache_set(cache_key, json.dumps(fallback_payload), EOD_CACHE_TTL)
            return fallback_payload

        # Build market data block
        open_p = float(day_df["Open"].iloc[0])
        close_p = float(day_df["Close"].iloc[-1])
        high_p = float(day_df["High"].max())
        low_p = float(day_df["Low"].min())
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
            market_block += (
                f"  {idx.strftime('%H:%M')} | {row['Open']:.0f} | {row['High']:.0f} | "
                f"{row['Low']:.0f} | {row['Close']:.0f}\n"
            )

        news_ctx = await _collect_live_market_news(now)
        prompt = EOD_NEXT_DAY_PROMPT.format(
            market_data_block=market_block,
            live_news_block=news_ctx.get("prompt_block", "- No reliable live headlines fetched."),
        )
        raw_text = await _call_gemini(prompt, settings.gemini_api_key)
        logger.debug("Gemini EOD raw (first 300): %s", raw_text[:300])
        text = _extract_json(raw_text)
        logger.debug("Gemini EOD extracted JSON (first 300): %s", text[:300])
        result = json.loads(text)
        result["captured_at"] = ist_now.isoformat()
        result["session_date"] = str(latest_date)
        result["symbol"] = symbol
        result["analysis_status"] = "full"
        result["news_tomorrow"] = _merge_unique_news(
            result.get("news_tomorrow") if isinstance(result.get("news_tomorrow"), list) else [],
            news_ctx.get("items", []),
            limit=6,
        )
        result["live_news_fetched_at"] = news_ctx.get("fetched_at")
        result["news_source_count"] = int(news_ctx.get("source_count", 0) or 0)

        # Cache for 20 hours
        cache_set(cache_key, json.dumps(result), EOD_CACHE_TTL)
        return result

    except json.JSONDecodeError as e:
        raw_snippet = raw_text[:400] if "raw_text" in dir() else "?"
        extracted = _extract_json(raw_snippet) if raw_snippet != "?" else "?"
        repaired = _repair_json(extracted)
        if repaired:
            logger.warning("Gemini EOD JSON repaired (was truncated). Using partial result.")
            repaired.setdefault("analysis_type", "EOD")
            repaired.setdefault("session_type", "Range Day")
            repaired.setdefault("close_position", "Middle of Range")
            repaired.setdefault("next_day_bias", "WAIT")
            repaired.setdefault("bias_strength", "LOW")
            repaired.setdefault("key_resistance", [])
            repaired.setdefault("key_support", [])
            repaired.setdefault("sl_hunt_risk", "Watch opening range for liquidity sweep.")
            repaired.setdefault("next_day_entry_zone", None)
            repaired.setdefault("next_day_stop_loss", None)
            repaired.setdefault("next_day_target", None)
            repaired.setdefault("alert_levels", [])
            repaired.setdefault("reasoning", "Using repaired EOD output due temporary AI format issue.")
            repaired["captured_at"] = ist_now.isoformat()
            if "latest_date" in locals():
                repaired["session_date"] = str(latest_date)
            repaired["symbol"] = symbol
            repaired["analysis_status"] = "repaired"
            repaired["news_tomorrow"] = _merge_unique_news(
                repaired.get("news_tomorrow") if isinstance(repaired.get("news_tomorrow"), list) else [],
                news_ctx.get("items", []),
                limit=6,
            )
            repaired["live_news_fetched_at"] = news_ctx.get("fetched_at")
            repaired["news_source_count"] = int(news_ctx.get("source_count", 0) or 0)
            cache_set(cache_key, json.dumps(repaired), EOD_CACHE_TTL)
            return repaired

        logger.error(
            "EOD non-JSON | raw[:400]: %.400s | extracted[:300]: %.300s | error: %s",
            raw_snippet,
            extracted,
            e,
        )
        fallback_payload = await _build_rule_based_eod_fallback(
            symbol=symbol,
            now=now,
            reason="Temporary AI formatting issue. Using rule-based fallback.",
            news_ctx=news_ctx,
        )
        cache_set(cache_key, json.dumps(fallback_payload), EOD_CACHE_TTL)
        return fallback_payload
    except httpx.HTTPStatusError as e:
        body = e.response.text[:300]
        logger.error("EOD Gemini HTTP error %s: %s", e.response.status_code, body)
        fallback_payload = await _build_rule_based_eod_fallback(
            symbol=symbol,
            now=now,
            reason=f"Gemini API error {e.response.status_code}",
            news_ctx=news_ctx,
        )
        cache_set(cache_key, json.dumps(fallback_payload), EOD_CACHE_TTL)
        return fallback_payload
    except Exception as e:
        logger.error("EOD analysis error: %s", e)
        fallback_payload = await _build_rule_based_eod_fallback(
            symbol=symbol,
            now=now,
            reason=str(e),
            news_ctx=news_ctx,
        )
        cache_set(cache_key, json.dumps(fallback_payload), EOD_CACHE_TTL)
        return fallback_payload



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
        "analysis_status": "fallback",
    }

# â”€â”€ Upstash Redis cache helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
    """Store value in Upstash using pipeline POST â€” avoids URL encoding issues with JSON payloads."""
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
        "missing_confirmation": "AI service unavailable - check manually",
        "news_items": [],
        "news_impact": reason,
        "reasoning": f"AI analysis is temporarily unavailable: {reason}",
        "captured_at": datetime.now(IST).isoformat(),
        "symbol": "-",
        "analysis_status": "fallback",
    }
