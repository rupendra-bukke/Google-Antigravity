"""
Daily Data & AI Pulse for BI / analytics professionals.

Fetches public RSS headlines, synthesizes one Gemini digest per day,
and caches in Upstash Redis. Frontend reads snapshots only (no on-demand Gemini).
"""

from __future__ import annotations

import asyncio
import json
import logging
import re
from datetime import datetime, timedelta, timezone

import httpx
import pytz

from config import settings
from services.ai_decision import (
    _call_gemini,
    _clean_news_text,
    _extract_json,
    _fetch_single_news_feed,
    _normalize_headline,
    _parse_news_dt,
    _repair_json,
    cache_get,
    cache_set,
)

logger = logging.getLogger(__name__)

IST = pytz.timezone("Asia/Kolkata")

CAREER_PULSE_CACHE_PREFIX = "career_pulse:"
CAREER_PULSE_CACHE_TTL_SECONDS = 60 * 60 * 48  # 48 hours
CAREER_NEWS_CACHE_PREFIX = "career_news:"
CAREER_NEWS_CACHE_TTL_SECONDS = 1800  # 30 minutes

CAREER_RSS_FEEDS: list[tuple[str, str]] = [
    (
        "AI-General",
        "https://news.google.com/rss/search?q=(generative+AI+OR+large+language+model+OR+AI+copilot)+when:2d&hl=en-IN&gl=IN&ceid=IN:en",
    ),
    (
        "Microsoft-Data",
        "https://news.google.com/rss/search?q=(Microsoft+Fabric+OR+Power+BI+Copilot+OR+Azure+Synapse)+when:3d&hl=en-IN&gl=IN&ceid=IN:en",
    ),
    (
        "Databricks",
        "https://news.google.com/rss/search?q=(Databricks+AI+OR+lakehouse+OR+Unity+Catalog)+when:3d&hl=en-IN&gl=IN&ceid=IN:en",
    ),
    (
        "Analytics-KQL",
        "https://news.google.com/rss/search?q=(KQL+OR+Azure+Data+Explorer+OR+Grafana+observability)+when:3d&hl=en-IN&gl=IN&ceid=IN:en",
    ),
    (
        "Vehicle-IoT",
        "https://news.google.com/rss/search?q=(vehicle+telematics+OR+fleet+analytics+OR+automotive+data)+when:5d&hl=en-IN&gl=IN&ceid=IN:en",
    ),
]

CAREER_KEYWORD_WEIGHTS: dict[str, int] = {
    "copilot": 9,
    "fabric": 9,
    "power bi": 10,
    "databricks": 9,
    "gemini": 8,
    "openai": 8,
    "chatgpt": 7,
    "llm": 7,
    "generative ai": 9,
    "machine learning": 6,
    "kql": 8,
    "adx": 7,
    "synapse": 7,
    "azure": 5,
    "grafana": 7,
    "observability": 6,
    "semantic model": 8,
    "lakehouse": 7,
    "vehicle": 6,
    "telematics": 7,
    "fleet": 6,
    "iot": 5,
    "agent": 6,
    "automation": 5,
}

USER_PROFILE_BLOCK = """
You are briefing Rupendra, a BI developer and data analyst who:
- Builds Power BI and Grafana dashboards
- Writes SQL, KQL, and works with Azure Synapse, ADX, and Databricks
- Is currently focused on vehicle / mobility data analytics
- Needs to stay current on AI without noise — only major, actionable updates
""".strip()

CAREER_PULSE_PROMPT = """{profile_block}

LIVE HEADLINES (RSS, last few days):
{headlines_block}

TASK:
Summarize only MAJOR AI and data-platform developments relevant to this role.
Ignore minor tweets, rumour, and repetitive product fluff.

Reply ONLY with valid JSON (no markdown):
{{
  "headlines": ["bullet 1", "bullet 2", "bullet 3", "bullet 4", "bullet 5"],
  "role_impact": {{
    "power_bi": "one sentence for Power BI / Fabric impact",
    "databricks": "one sentence for Databricks / lakehouse impact",
    "kql_adx": "one sentence for KQL / Synapse / ADX impact",
    "grafana": "one sentence for Grafana / observability impact",
    "vehicle_analytics": "one sentence for vehicle / telematics / IoT analytics impact"
  }},
  "action_this_week": "one concrete learning or trial step (under 25 words)",
  "reasoning": "2 short sentences on why these matter now",
  "priority_level": "HIGH or MEDIUM or LOW"
}}

Rules:
- headlines: max 5 items, each under 18 words
- role_impact values: each under 20 words
- If no major news, say so honestly and suggest a stable focus area
"""


def _score_career_item(title: str, summary: str) -> int:
    text = f"{title} {summary}".lower()
    score = 0
    for kw, weight in CAREER_KEYWORD_WEIGHTS.items():
        if kw in text:
            score += weight
    return score


def _recent_bonus(pub_dt: datetime | None, now_utc: datetime) -> int:
    if pub_dt is None:
        return 0
    try:
        age_hours = (now_utc - pub_dt).total_seconds() / 3600.0
    except Exception:
        return 0
    if age_hours <= 6:
        return 4
    if age_hours <= 24:
        return 2
    if age_hours <= 72:
        return 1
    return 0


def _pulse_cache_key(date_str: str) -> str:
    return f"{CAREER_PULSE_CACHE_PREFIX}{date_str}"


async def collect_career_news(now: datetime | None = None, max_items: int = 12) -> dict:
    now = now or datetime.now(timezone.utc)
    now_utc = now.astimezone(timezone.utc)
    bucket = now.astimezone(IST).strftime("%Y%m%d%H") + f"{now.minute // 30}"
    cache_key = f"{CAREER_NEWS_CACHE_PREFIX}{bucket}"

    cached = cache_get(cache_key)
    if cached:
        try:
            payload = json.loads(cached)
            if isinstance(payload, dict):
                return payload
        except Exception:
            pass

    headers = {
        "User-Agent": "TradeCraftCareerPulse/1.0",
        "Accept": "application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
    }

    async with httpx.AsyncClient(timeout=12, follow_redirects=True, headers=headers) as client:
        tasks = [
            _fetch_single_news_feed(client, source_name=src, url=url)
            for src, url in CAREER_RSS_FEEDS
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
        if key and key not in dedup:
            dedup[key] = item

    ranked: list[tuple[int, dict]] = []
    for item in dedup.values():
        title = item.get("title", "")
        summary = item.get("summary", "")
        pub_dt = _parse_news_dt(item.get("published_at") or "")
        rank_score = _score_career_item(title, summary) * 10 + _recent_bonus(pub_dt, now_utc)
        ranked.append((rank_score, item))

    ranked.sort(key=lambda x: x[0], reverse=True)

    headline_list: list[str] = []
    source_links: list[dict] = []
    for _, item in ranked[: max_items * 2]:
        title = _clean_news_text(item.get("title", ""))
        if not title:
            continue
        source = _clean_news_text(item.get("source", "News"))
        headline_list.append(f"[{source}] {title[:160]}")
        link = _clean_news_text(item.get("link", ""))
        if link:
            source_links.append({"title": title[:160], "source": source, "link": link})
        if len(headline_list) >= max_items:
            break

    payload = {
        "items": headline_list,
        "source_links": source_links[:8],
        "fetched_at": now.astimezone(IST).isoformat(),
        "source_count": len(raw_items),
    }
    cache_set(cache_key, json.dumps(payload), CAREER_NEWS_CACHE_TTL_SECONDS)
    return payload


def _build_headlines_block(items: list[str]) -> str:
    if not items:
        return "- No reliable headlines fetched."
    return "\n".join(f"- {item}" for item in items)


def _normalize_priority(value: str) -> str:
    v = (value or "").strip().upper()
    if v in {"HIGH", "MEDIUM", "LOW"}:
        return v
    return "MEDIUM"


def _sanitize_role_impact(raw: object) -> dict[str, str]:
    defaults = {
        "power_bi": "Monitor Fabric and Power BI Copilot updates for dashboard workflows.",
        "databricks": "Track Databricks AI and lakehouse features for pipeline modernization.",
        "kql_adx": "Review KQL and ADX patterns for real-time analytics workloads.",
        "grafana": "Watch Grafana AI and observability tooling for operational dashboards.",
        "vehicle_analytics": "Apply telematics and IoT analytics patterns to fleet KPI models.",
    }
    if not isinstance(raw, dict):
        return defaults

    out: dict[str, str] = {}
    for key, fallback in defaults.items():
        val = raw.get(key, fallback)
        text = _clean_news_text(str(val)) if val is not None else fallback
        out[key] = text[:220] if text else fallback
    return out


def _build_fallback_payload(date_str: str, news_ctx: dict, reason: str) -> dict:
    items = news_ctx.get("items") or []
    ist_now = datetime.now(IST)
    next_refresh = (ist_now + timedelta(hours=24)).replace(hour=8, minute=0, second=0, microsecond=0)
    if next_refresh <= ist_now:
        next_refresh += timedelta(days=1)

    return {
        "analysis_type": "CAREER_PULSE",
        "analysis_status": "fallback",
        "date": date_str,
        "headlines": items[:5] if items else ["No headlines fetched yet — check back after 08:00 IST."],
        "role_impact": _sanitize_role_impact({}),
        "action_this_week": "Review one Fabric or Power BI Copilot feature doc and note one dashboard use case.",
        "reasoning": reason,
        "priority_level": "LOW",
        "source_links": news_ctx.get("source_links") or [],
        "captured_at": ist_now.isoformat(),
        "next_refresh_at_ist": next_refresh.isoformat(),
    }


def _parse_gemini_payload(raw_text: str) -> dict | None:
    try:
        cleaned = _extract_json(raw_text)
        return json.loads(cleaned)
    except json.JSONDecodeError:
        return _repair_json(_extract_json(raw_text))


def load_cached_career_pulse(date_str: str) -> dict | None:
    cached = cache_get(_pulse_cache_key(date_str))
    if not cached:
        return None
    try:
        payload = json.loads(cached)
        return payload if isinstance(payload, dict) else None
    except Exception:
        return None


async def generate_career_pulse(
    now: datetime | None = None,
    force: bool = False,
) -> dict:
    now = now or datetime.now(timezone.utc)
    ist_now = now.astimezone(IST)
    date_str = ist_now.strftime("%Y-%m-%d")

    if not force:
        existing = load_cached_career_pulse(date_str)
        if existing and str(existing.get("analysis_status", "")).lower() != "fallback":
            return {"status": "skipped", "date": date_str, "reason": "already_cached"}

    news_ctx = await collect_career_news(now)
    headlines = news_ctx.get("items") or []

    if not settings.gemini_api_key:
        payload = _build_fallback_payload(date_str, news_ctx, "GEMINI_API_KEY not configured.")
        cache_set(_pulse_cache_key(date_str), json.dumps(payload), CAREER_PULSE_CACHE_TTL_SECONDS)
        return {"status": "fallback", "date": date_str, "analysis_status": "fallback"}

    prompt = CAREER_PULSE_PROMPT.format(
        profile_block=USER_PROFILE_BLOCK,
        headlines_block=_build_headlines_block(headlines),
    )

    try:
        raw_text = await _call_gemini(prompt, settings.gemini_api_key)
        parsed = _parse_gemini_payload(raw_text)
        if not parsed:
            raise ValueError("Gemini returned unparseable JSON")

        next_refresh = (ist_now + timedelta(days=1)).replace(hour=8, minute=0, second=0, microsecond=0)

        payload = {
            "analysis_type": "CAREER_PULSE",
            "analysis_status": "full",
            "date": date_str,
            "headlines": [
                _clean_news_text(str(h))[:180]
                for h in (parsed.get("headlines") or [])[:5]
                if _clean_news_text(str(h))
            ],
            "role_impact": _sanitize_role_impact(parsed.get("role_impact")),
            "action_this_week": _clean_news_text(str(parsed.get("action_this_week", "")))[:220]
            or "Pick one AI feature in your stack and prototype it on a sample dataset.",
            "reasoning": _clean_news_text(str(parsed.get("reasoning", "")))[:400]
            or "Stay focused on platform AI features that change analyst workflows.",
            "priority_level": _normalize_priority(str(parsed.get("priority_level", "MEDIUM"))),
            "source_links": news_ctx.get("source_links") or [],
            "captured_at": ist_now.isoformat(),
            "next_refresh_at_ist": next_refresh.isoformat(),
        }

        if not payload["headlines"]:
            payload["headlines"] = headlines[:5] or ["No major headlines today — focus on deepening current stack skills."]

        cache_set(_pulse_cache_key(date_str), json.dumps(payload), CAREER_PULSE_CACHE_TTL_SECONDS)
        logger.info("Career pulse saved for %s", date_str)
        return {"status": "saved", "date": date_str, "analysis_status": payload["analysis_status"]}

    except Exception as exc:
        logger.warning("Career pulse Gemini failed: %s", exc)
        payload = _build_fallback_payload(
            date_str,
            news_ctx,
            f"AI digest unavailable ({exc}). Showing RSS headlines only.",
        )
        cache_set(_pulse_cache_key(date_str), json.dumps(payload), CAREER_PULSE_CACHE_TTL_SECONDS)
        return {"status": "fallback", "date": date_str, "analysis_status": "fallback", "error": str(exc)}


async def get_career_pulse_snapshot(now: datetime | None = None) -> dict:
    now = now or datetime.now(timezone.utc)
    ist_now = now.astimezone(IST)
    date_str = ist_now.strftime("%Y-%m-%d")

    cached = load_cached_career_pulse(date_str)
    if cached:
        cached.setdefault("analysis_type", "CAREER_PULSE")
        cached.setdefault("date", date_str)
        return cached

    # Try yesterday's pulse early morning before today's cron runs
    yesterday = (ist_now - timedelta(days=1)).strftime("%Y-%m-%d")
    prev = load_cached_career_pulse(yesterday)
    if prev:
        prev = dict(prev)
        prev["snapshot_stale"] = True
        prev.setdefault("analysis_type", "CAREER_PULSE")
        return prev

    news_ctx = await collect_career_news(now)
    return _build_fallback_payload(
        date_str,
        news_ctx,
        "Today's AI brief will be ready after the 08:00 IST scheduled update.",
    )


async def ensure_today_career_pulse_on_startup() -> dict:
    """Generate today's pulse on boot if missing and local time is after 08:00 IST."""
    ist_now = datetime.now(IST)
    if ist_now.hour < 8:
        return {"status": "skipped", "reason": "before_0800_ist"}

    date_str = ist_now.strftime("%Y-%m-%d")
    existing = load_cached_career_pulse(date_str)
    if existing and str(existing.get("analysis_status", "")).lower() != "fallback":
        return {"status": "skipped", "reason": "already_cached", "date": date_str}

    return await generate_career_pulse(now=datetime.now(timezone.utc), force=False)
