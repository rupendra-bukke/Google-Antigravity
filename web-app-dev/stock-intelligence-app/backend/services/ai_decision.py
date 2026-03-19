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
EOD_CACHE_TTL = 72000  # 20 hours

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

ZERO_HERO_PROMPT = """You are an Indian index options scalper focused on expiry-day zero-to-hero opportunities.
Your job is to give actionable CE and PE buy plans for 1PM, 2PM, and 3PM windows.

INDEX CONTEXT:
- Index: {index_abbr} ({index_name}) | Exchange: {exchange}
- Spot now: {spot_text}
- ATM strike step: {strike_step}
- Timestamp IST: {timestamp_ist}

MARKET DATA:
{market_data_block}

LIVE NEWS SNAPSHOT (last 24h):
{live_news_block}

RULES:
1) Reply ONLY valid JSON. No markdown and no extra text.
2) Contracts must include exact strike, example: "NIFTY 23650 CE".
3) Include both CE and PE plans in every window.
4) Use short, practical lines for entry, sl, target.
5) Keep risk-first behavior. If setup is weak, mark status as WAIT.

Output JSON exactly in this shape:
{{
  "headline": "max 14 words",
  "overall_risk": "HIGH|VERY_HIGH|EXTREME",
  "market_phase": "PRE_1PM|1PM_2PM|2PM_3PM|3PM_330|POST_330",
  "no_trade_filter": "max 20 words",
  "risk_note": "max 20 words",
  "windows": [
    {{
      "window": "1PM",
      "status": "WAIT|ACTIVE|CLOSED",
      "confidence": "LOW|MEDIUM|HIGH",
      "ce": {{
        "contract": "exact CE contract",
        "entry": "entry rule",
        "sl": "sl or invalidation",
        "target": "target or exit rule"
      }},
      "pe": {{
        "contract": "exact PE contract",
        "entry": "entry rule",
        "sl": "sl or invalidation",
        "target": "target or exit rule"
      }},
      "note": "max 18 words"
    }},
    {{
      "window": "2PM",
      "status": "WAIT|ACTIVE|CLOSED",
      "confidence": "LOW|MEDIUM|HIGH",
      "ce": {{"contract": "", "entry": "", "sl": "", "target": ""}},
      "pe": {{"contract": "", "entry": "", "sl": "", "target": ""}},
      "note": "max 18 words"
    }},
    {{
      "window": "3PM",
      "status": "WAIT|ACTIVE|CLOSED",
      "confidence": "LOW|MEDIUM|HIGH",
      "ce": {{"contract": "", "entry": "", "sl": "", "target": ""}},
      "pe": {{"contract": "", "entry": "", "sl": "", "target": ""}},
      "note": "max 18 words"
    }}
  ]
}"""


def _safe_text(v: object, default: str, max_len: int = 180) -> str:
    if isinstance(v, str):
        text = _clean_news_text(v)
        if text:
            return text[:max_len]
    return default


def _window_defaults(index_abbr: str, atm: int | None, strike_step: int) -> list[dict]:
    offsets = {"1PM": 0, "2PM": 1, "3PM": 0}

    def mk_contract(window: str, option_side: str) -> str:
        if atm is None:
            return f"{index_abbr} {option_side}"
        offset = offsets.get(window, 0)
        strike = atm + (offset if option_side == "CE" else -offset) * strike_step
        return f"{index_abbr} {strike} {option_side}"

    rows: list[dict] = []
    for w in ("1PM", "2PM", "3PM"):
        rows.append(
            {
                "window": w,
                "status": "WAIT",
                "confidence": "LOW",
                "ce": {
                    "contract": mk_contract(w, "CE"),
                    "entry": "Take CE only after upside breakout confirmation.",
                    "sl": "Exit if breakout fails and spot slips below trigger candle low.",
                    "target": "Book 40-80% burst or force-exit by 3:28 PM.",
                },
                "pe": {
                    "contract": mk_contract(w, "PE"),
                    "entry": "Take PE only after downside breakdown confirmation.",
                    "sl": "Exit if breakdown fails and spot reclaims trigger candle high.",
                    "target": "Book 40-80% burst or force-exit by 3:28 PM.",
                },
                "note": "Wait for clean momentum candle before entry.",
            }
        )
    return rows


def _normalize_leg(raw_leg: object, fallback_contract: str) -> dict:
    if not isinstance(raw_leg, dict):
        raw_leg = {}
    return {
        "contract": _safe_text(raw_leg.get("contract"), fallback_contract, 50),
        "entry": _safe_text(raw_leg.get("entry"), "Wait for confirmation before entry."),
        "sl": _safe_text(raw_leg.get("sl"), "Use strict invalidation and cut loss fast."),
        "target": _safe_text(raw_leg.get("target"), "Book partial on burst and hard-exit by 3:28 PM."),
    }


def _normalize_windows(raw_windows: object, index_abbr: str, atm: int | None, strike_step: int) -> list[dict]:
    fallback_rows = _window_defaults(index_abbr, atm, strike_step)
    if not isinstance(raw_windows, list):
        return fallback_rows

    raw_map: dict[str, dict] = {}
    for row in raw_windows:
        if not isinstance(row, dict):
            continue
        key = str(row.get("window", "")).upper().replace(" ", "")
        if key.startswith("1"):
            raw_map["1PM"] = row
        elif key.startswith("2"):
            raw_map["2PM"] = row
        elif key.startswith("3"):
            raw_map["3PM"] = row

    normalized: list[dict] = []
    for fallback in fallback_rows:
        w = fallback["window"]
        src = raw_map.get(w, {})
        offset = 1 if w == "2PM" else 0
        ce_fallback = fallback["ce"]["contract"]
        pe_fallback = fallback["pe"]["contract"]
        if atm is not None:
            ce_fallback = f"{index_abbr} {atm + offset * strike_step} CE"
            pe_fallback = f"{index_abbr} {atm - offset * strike_step} PE"

        normalized.append(
            {
                "window": w,
                "status": _safe_text(src.get("status"), fallback["status"], 8).upper(),
                "confidence": _safe_text(src.get("confidence"), fallback["confidence"], 12).upper(),
                "ce": _normalize_leg(src.get("ce"), ce_fallback),
                "pe": _normalize_leg(src.get("pe"), pe_fallback),
                "note": _safe_text(src.get("note"), fallback["note"], 180),
            }
        )
    return normalized


def _build_zero_hero_market_block(frames: dict, symbol: str, spot_price: float | None, now: datetime) -> str:
    lines = [
        f"Symbol: {symbol}",
        f"Timestamp IST: {now.astimezone(IST).strftime('%d-%b-%Y %H:%M')}",
        f"Spot: {spot_price:,.2f}" if isinstance(spot_price, (int, float)) else "Spot: NA",
    ]

    df = None
    for key in ("5m", "3m", "15m"):
        candidate = frames.get(key)
        if candidate is not None and not candidate.empty:
            df = candidate
            break
    if df is None:
        lines.append("No fresh candles available from feed.")
        return "\n".join(lines)

    try:
        day_high = float(df["High"].max())
        day_low = float(df["Low"].min())
        day_open = float(df["Open"].iloc[0])
        last_close = float(df["Close"].iloc[-1])
        lines.append(f"Day Open: {day_open:.2f}")
        lines.append(f"Day High: {day_high:.2f}")
        lines.append(f"Day Low: {day_low:.2f}")
        lines.append(f"Last Close: {last_close:.2f}")
        lines.append("Recent candles (O/H/L/C):")
        for idx, row in df.tail(6)[["Open", "High", "Low", "Close"]].iterrows():
            ts = idx.strftime("%H:%M") if hasattr(idx, "strftime") else str(idx)
            lines.append(f"  {ts} | {row['Open']:.0f} | {row['High']:.0f} | {row['Low']:.0f} | {row['Close']:.0f}")
    except Exception:
        lines.append("Could not parse recent candles.")

    return "\n".join(lines)


def _compute_market_phase(now: datetime) -> str:
    hhmm = int(now.astimezone(IST).strftime("%H%M"))
    if hhmm < 1300:
        return "PRE_1PM"
    if hhmm < 1400:
        return "1PM_2PM"
    if hhmm < 1500:
        return "2PM_3PM"
    if hhmm < 1530:
        return "3PM_330"
    return "POST_330"


def _zero_hero_fallback(
    index_abbr: str,
    index_name: str,
    exchange: str,
    symbol: str,
    strike_step: int,
    spot_price: float | None,
    now: datetime,
    reason: str,
) -> dict:
    atm = None
    if isinstance(spot_price, (int, float)) and spot_price > 0:
        atm = int(round(float(spot_price) / strike_step) * strike_step)
    return {
        "index": index_abbr,
        "index_name": index_name,
        "exchange": exchange,
        "symbol": symbol,
        "spot": round(float(spot_price), 2) if isinstance(spot_price, (int, float)) else None,
        "headline": "AI setup unavailable, use strict confirmation only",
        "overall_risk": "EXTREME",
        "market_phase": _compute_market_phase(now),
        "no_trade_filter": "Skip if candles are choppy and range-bound.",
        "risk_note": "High risk setup. Use strict size and hard stop.",
        "windows": _window_defaults(index_abbr, atm, strike_step),
        "news_items": [],
        "source": "fallback",
        "reason": reason,
        "captured_at": now.astimezone(IST).isoformat(),
    }


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

    if not settings.gemini_api_key:
        return _zero_hero_fallback(
            index_abbr=index_abbr,
            index_name=index_name,
            exchange=exchange,
            symbol=symbol,
            strike_step=strike_step,
            spot_price=spot_price,
            now=now,
            reason="GEMINI_API_KEY not configured.",
        )

    market_block = _build_zero_hero_market_block(frames, symbol, spot_price, now)
    spot_text = f"{spot_price:,.2f}" if isinstance(spot_price, (int, float)) else "NA"
    news_ctx = {
        "items": [],
        "prompt_block": "- No reliable live headlines fetched.",
        "fetched_at": now.astimezone(IST).isoformat(),
        "source_count": 0,
    }

    atm = None
    if isinstance(spot_price, (int, float)) and spot_price > 0:
        atm = int(round(float(spot_price) / strike_step) * strike_step)

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

        windows = _normalize_windows(parsed.get("windows"), index_abbr, atm, strike_step)
        return {
            "index": index_abbr,
            "index_name": index_name,
            "exchange": exchange,
            "symbol": symbol,
            "spot": round(float(spot_price), 2) if isinstance(spot_price, (int, float)) else None,
            "headline": _safe_text(parsed.get("headline"), "Expiry momentum opportunities with strict discipline", 120),
            "overall_risk": _safe_text(parsed.get("overall_risk"), "HIGH", 16).upper(),
            "market_phase": _safe_text(parsed.get("market_phase"), _compute_market_phase(now), 16).upper(),
            "no_trade_filter": _safe_text(parsed.get("no_trade_filter"), "Skip if setup trigger is not confirmed."),
            "risk_note": _safe_text(parsed.get("risk_note"), "High risk. Position sizing and strict stop mandatory."),
            "windows": windows,
            "news_items": _merge_unique_news([], news_ctx.get("items", []), limit=4),
            "source": "ai",
            "captured_at": now.astimezone(IST).isoformat(),
            "live_news_fetched_at": news_ctx.get("fetched_at"),
            "news_source_count": int(news_ctx.get("source_count", 0) or 0),
        }
    except Exception as e:
        logger.error("Expiry zero-to-hero AI error: %s", e)
        return _zero_hero_fallback(
            index_abbr=index_abbr,
            index_name=index_name,
            exchange=exchange,
            symbol=symbol,
            strike_step=strike_step,
            spot_price=spot_price,
            now=now,
            reason=str(e),
        )


async def get_eod_analysis(symbol: str, now: datetime) -> dict:
    """
    Run end-of-day / next-trading-day outlook analysis.
    Fetches today's full session data (or last trading day if weekend).
    Caches result for 20 hours.
    """
    from config import settings
    import hashlib

    if not settings.gemini_api_key:
        return _eod_fallback(symbol, "GEMINI_API_KEY not configured on Render.")

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

    # Fetch recent market data â€” get 5 days of 5m data for full day view
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
        raw_snippet = raw_text[:400] if 'raw_text' in dir() else '?'
        extracted = _extract_json(raw_snippet) if raw_snippet != '?' else '?'
        repaired = _repair_json(extracted)
        if repaired:
            logger.warning("Gemini EOD JSON repaired (was truncated). Using partial result.")
            repaired.setdefault("analysis_type", "EOD")
            repaired.setdefault("session_type", "Unavailable")
            repaired.setdefault("close_position", "Unknown")
            repaired.setdefault("next_day_bias", "WAIT")
            repaired.setdefault("bias_strength", "LOW")
            repaired.setdefault("key_resistance", [])
            repaired.setdefault("key_support", [])
            repaired.setdefault("sl_hunt_risk", "Analysis unavailable")
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
        logger.error("EOD non-JSON | raw[:400]: %.400s | extracted[:300]: %.300s | error: %s",
                     raw_snippet, extracted, e)
        return _eod_fallback(symbol, "Temporary AI formatting issue. Auto-retry on next refresh.")
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
