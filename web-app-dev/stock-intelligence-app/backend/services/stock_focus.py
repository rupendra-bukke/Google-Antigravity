"""Rule-based market focus service for watchlist trend cards."""

from __future__ import annotations

import hashlib
import json
from datetime import datetime

import pandas as pd
import yfinance as yf

from services.ai_decision import IST, _collect_live_market_news, cache_get, cache_set, logger
from services.market_data import fetch_multi_timeframe, is_indian_market_open

STOCK_LIVE_CACHE_KEY_PREFIX = "stock_focus_live:"
STOCK_EOD_CACHE_KEY_PREFIX = "stock_focus_eod:"
STOCK_LIVE_CACHE_TTL_SECONDS = 600
STOCK_EOD_CACHE_TTL_SECONDS = 21600


def _normalize_intraday_index(df: pd.DataFrame) -> pd.DataFrame:
    if df is None or df.empty:
        return pd.DataFrame()

    out = df.copy()
    if isinstance(out.columns, pd.MultiIndex):
        out.columns = out.columns.get_level_values(0)
    out.index = pd.to_datetime(out.index)
    if out.index.tz is None:
        out.index = out.index.tz_localize("UTC").tz_convert(IST)
    else:
        out.index = out.index.tz_convert(IST)
    return out


def _normalize_daily_frame(df: pd.DataFrame) -> pd.DataFrame:
    if df is None or df.empty:
        return pd.DataFrame()

    out = df.copy()
    if isinstance(out.columns, pd.MultiIndex):
        out.columns = out.columns.get_level_values(0)
    out.index = pd.to_datetime(out.index)
    return out


def _close_position_label(close_price: float, low_price: float, high_price: float) -> str:
    day_range = high_price - low_price
    if day_range <= 0:
        return "Middle of Range"

    pct_from_low = ((close_price - low_price) / day_range) * 100.0
    if pct_from_low >= 67:
        return "Top of Range"
    if pct_from_low <= 33:
        return "Bottom of Range"
    return "Middle of Range"


def _session_type_label(open_price: float, close_price: float, high_price: float, low_price: float) -> str:
    if open_price <= 0:
        return "Range Day"

    net_pct = ((close_price - open_price) / open_price) * 100.0
    close_position = _close_position_label(close_price, low_price, high_price)

    if net_pct >= 2.0:
        return "Bullish Trend Day"
    if net_pct <= -2.0:
        return "Bearish Trend Day"
    if net_pct >= 0.6 and close_position == "Top of Range":
        return "Bullish Closing Day"
    if net_pct <= -0.6 and close_position == "Bottom of Range":
        return "Bearish Closing Day"
    return "Range Day"


def _extract_previous_day_summary(df: pd.DataFrame, current_date) -> dict:
    if df is None or df.empty:
        return {
            "session_date": "",
            "session_type": "Unavailable",
            "close_position": "Unknown",
            "net_change_pct": None,
        }

    available_dates = sorted({d for d in df.index.date if d < current_date})
    if not available_dates:
        return {
            "session_date": "",
            "session_type": "Unavailable",
            "close_position": "Unknown",
            "net_change_pct": None,
        }

    prev_date = available_dates[-1]
    prev_df = df[df.index.date == prev_date]
    if prev_df.empty:
        return {
            "session_date": "",
            "session_type": "Unavailable",
            "close_position": "Unknown",
            "net_change_pct": None,
        }

    open_price = float(prev_df["Open"].iloc[0])
    close_price = float(prev_df["Close"].iloc[-1])
    high_price = float(prev_df["High"].max())
    low_price = float(prev_df["Low"].min())
    net_change_pct = ((close_price - open_price) / open_price * 100.0) if open_price else None

    return {
        "session_date": str(prev_date),
        "session_type": _session_type_label(open_price, close_price, high_price, low_price),
        "close_position": _close_position_label(close_price, low_price, high_price),
        "net_change_pct": round(float(net_change_pct), 2) if net_change_pct is not None else None,
    }


def _derive_live_trend(day_change_pct: float | None, range_position_pct: float | None, recent_delta: float) -> str:
    if day_change_pct is None:
        return "SIDEWAYS"

    if (
        day_change_pct >= 1.2
        or (
            day_change_pct >= 0.5
            and range_position_pct is not None
            and range_position_pct >= 65
            and recent_delta >= 0
        )
    ):
        return "BULLISH"
    if (
        day_change_pct <= -1.2
        or (
            day_change_pct <= -0.5
            and range_position_pct is not None
            and range_position_pct <= 35
            and recent_delta <= 0
        )
    ):
        return "BEARISH"
    return "SIDEWAYS"


def _trend_signal_label(trend: str) -> str:
    if trend == "BULLISH":
        return "BUY BIAS"
    if trend == "BEARISH":
        return "SELL BIAS"
    return "WAIT"


def _directional_score_from_session(session_type: str) -> float:
    session = (session_type or "").lower()
    if "bullish trend" in session:
        return 2.0
    if "bullish closing" in session:
        return 1.5
    if "bearish trend" in session:
        return -2.0
    if "bearish closing" in session:
        return -1.5
    return 0.0


def _range_position_pct(current_price: float, low_price: float, high_price: float) -> float | None:
    day_range = high_price - low_price
    if day_range <= 0:
        return None
    return ((current_price - low_price) / day_range) * 100.0


def _intraday_score(
    trend: str,
    day_change_pct: float | None,
    range_position_pct: float | None,
    recent_delta: float,
) -> float:
    score = 0.0

    if trend == "BULLISH":
        score += 2.0
    elif trend == "BEARISH":
        score -= 2.0

    if day_change_pct is not None:
        if day_change_pct >= 1.2:
            score += 1.0
        elif day_change_pct >= 0.5:
            score += 0.5
        elif day_change_pct <= -1.2:
            score -= 1.0
        elif day_change_pct <= -0.5:
            score -= 0.5

    if range_position_pct is not None:
        if trend == "BULLISH" and range_position_pct >= 70:
            score += 0.5
        elif trend == "BEARISH" and range_position_pct <= 30:
            score -= 0.5

    if recent_delta > 0:
        score += 0.3
    elif recent_delta < 0:
        score -= 0.3

    return score


def _daily_swing_score(daily_df: pd.DataFrame) -> float:
    if daily_df is None or daily_df.empty or "Close" not in daily_df.columns:
        return 0.0

    closes = daily_df["Close"].dropna().tail(5)
    if len(closes) < 2:
        return 0.0

    start = float(closes.iloc[0])
    end = float(closes.iloc[-1])
    if start == 0:
        return 0.0

    move_pct = ((end - start) / start) * 100.0
    if move_pct >= 3.0:
        return 2.5
    if move_pct >= 1.2:
        return 1.5
    if move_pct <= -3.0:
        return -2.5
    if move_pct <= -1.2:
        return -1.5
    return 0.0


def _risk_level(impact_summary: str) -> str:
    text = (impact_summary or "").lower()
    if "high-risk" in text:
        return "high"
    if "moderate" in text:
        return "moderate"
    return "normal"


def _downgrade_confidence(label: str) -> str:
    if label == "HIGH":
        return "MEDIUM"
    if label == "MEDIUM":
        return "LOW"
    return "LOW"


def _confidence_from_score(score: float, impact_summary: str) -> str:
    abs_score = abs(score)
    if abs_score >= 3.2:
        label = "HIGH"
    elif abs_score >= 1.7:
        label = "MEDIUM"
    else:
        label = "LOW"

    risk = _risk_level(impact_summary)
    if risk == "high":
        label = _downgrade_confidence(label)
    elif risk == "moderate" and label == "HIGH":
        label = "MEDIUM"
    return label


def _score_to_bias(score: float, neutral_label: str = "WAIT") -> str:
    if score >= 1.5:
        return "BULLISH"
    if score <= -1.5:
        return "BEARISH"
    return neutral_label


def _next_day_note(bias: str, session_type: str, live_mode: bool) -> str:
    if bias == "BULLISH":
        prefix = "Momentum favors upside continuation."
    elif bias == "BEARISH":
        prefix = "Weak structure favors downside pressure."
    else:
        prefix = "Mixed structure needs stronger confirmation."

    suffix = f" Last clear session: {session_type.lower()}." if session_type and session_type != "Unavailable" else ""
    if live_mode:
        return f"{prefix}{suffix} This is a live-market preliminary view."
    return f"{prefix}{suffix} Built from latest closed-session structure."


def _next_week_outlook(bias: str, daily_score: float, impact_summary: str) -> str:
    risk = _risk_level(impact_summary)
    if bias == "BULLISH":
        outlook = "Weekly structure still leans upward if supports hold."
    elif bias == "BEARISH":
        outlook = "Weekly structure stays fragile unless buyers reclaim resistance."
    else:
        outlook = "Weekly structure is neutral until a directional breakout appears."

    if risk == "high":
        return f"{outlook} Global risk can override this view."
    if abs(daily_score) < 1.0:
        return f"{outlook} Trend conviction is still moderate."
    return outlook


def _estimate_daily_range_pct(daily_df: pd.DataFrame) -> float:
    if daily_df is None or daily_df.empty:
        return 0.012

    recent = daily_df.tail(10).copy()
    if recent.empty:
        return 0.012

    pct = ((recent["High"] - recent["Low"]) / recent["Close"].replace(0, pd.NA)).dropna()
    if pct.empty:
        return 0.012

    avg = float(pct.mean())
    return min(max(avg, 0.008), 0.04)


def _format_price(v: float | None) -> str | None:
    if v is None:
        return None
    return f"{v:.2f}"


def _estimate_target(price: float | None, bias: str, range_pct: float, scale: float) -> str | None:
    if price is None:
        return None
    move = price * range_pct * scale
    if bias == "BULLISH":
        return _format_price(price + move)
    if bias == "BEARISH":
        return _format_price(price - move)
    return None


def _estimate_zone(price: float | None, bias: str, range_pct: float, scale: float) -> str | None:
    if price is None:
        return None

    move = price * range_pct * scale
    half = max(move * 0.35, price * 0.0025)
    if bias == "BULLISH":
        low = price + move - half
        high = price + move + half
    elif bias == "BEARISH":
        low = price - move - half
        high = price - move + half
    else:
        low = price - half
        high = price + half
    return f"{low:.2f} - {high:.2f}"


def _unique_levels(values: list[float], reverse: bool = False) -> list[str]:
    seen: set[int] = set()
    out: list[str] = []
    for raw in sorted(values, reverse=reverse):
        rounded_key = int(round(raw))
        if rounded_key in seen:
            continue
        seen.add(rounded_key)
        out.append(f"{raw:.2f}")
        if len(out) >= 3:
            break
    return out


def _key_levels(day_df: pd.DataFrame, daily_df: pd.DataFrame) -> tuple[list[str], list[str]]:
    supports: list[float] = []
    resistances: list[float] = []

    if day_df is not None and not day_df.empty:
        supports.extend(
            [
                float(day_df["Low"].min()),
                float(day_df["Close"].iloc[-1]),
            ]
        )
        resistances.extend(
            [
                float(day_df["High"].max()),
                float(day_df["Close"].iloc[-1]),
            ]
        )

    if daily_df is not None and not daily_df.empty:
        recent = daily_df.tail(10)
        supports.extend([float(recent["Low"].tail(5).min()), float(recent["Low"].min())])
        resistances.extend([float(recent["High"].tail(5).max()), float(recent["High"].max())])

    return _unique_levels(supports), _unique_levels(resistances, reverse=True)


def _today_note(trend: str, previous_session: str, impact_summary: str) -> str:
    if trend == "BULLISH":
        lead = "Live structure is leaning bullish."
    elif trend == "BEARISH":
        lead = "Live structure is leaning bearish."
    else:
        lead = "Live structure is mixed."

    previous = previous_session.lower() if previous_session and previous_session != "Unavailable" else "an unclear prior session"
    return f"{lead} Previous session was {previous}. News backdrop: {impact_summary.lower()}."


def _fallback_payload(symbol: str, label: str, reason: str, captured_at: datetime, market_open: bool) -> dict:
    stamp = captured_at.astimezone(IST).isoformat()
    return {
        "analysis_type": "MARKET_FOCUS",
        "mode": "LIVE" if market_open else "EOD",
        "market_open": market_open,
        "label": label,
        "symbol": symbol,
        "price": None,
        "session_date": captured_at.astimezone(IST).strftime("%Y-%m-%d"),
        "today_trend": "SIDEWAYS",
        "today_confidence": "LOW",
        "today_signal": "WAIT",
        "today_note": f"Market focus view unavailable: {reason}",
        "session_type": "Unavailable",
        "close_position": "Unknown",
        "yesterday_session": "Unavailable",
        "yesterday_close_position": "Unknown",
        "yesterday_move_pct": None,
        "next_day_bias": "WAIT",
        "next_day_confidence": "LOW",
        "next_day_target": None,
        "next_day_risk": "Wait for stable structure.",
        "next_day_note": "Next-day view is not available right now.",
        "next_week_bias": "NEUTRAL",
        "next_week_confidence": "LOW",
        "next_week_target_zone": None,
        "next_week_outlook": "Weekly outlook unavailable right now.",
        "key_support": [],
        "key_resistance": [],
        "global_news_impact": "No major trigger",
        "global_news_items": [],
        "news_tomorrow": [],
        "captured_at": stamp,
        "analysis_status": "fallback",
        "free_tier_mode": True,
        "source": "TradingView/yfinance + public RSS",
    }


async def _fetch_focus_frames(symbol: str) -> tuple[pd.DataFrame, pd.DataFrame]:
    intraday_df = pd.DataFrame()
    try:
        frames = await fetch_multi_timeframe(symbol, include_1m=False)
        intraday_df = _normalize_intraday_index(frames.get("5m", pd.DataFrame()))
        if intraday_df.empty:
            intraday_df = _normalize_intraday_index(frames.get("15m", pd.DataFrame()))
    except Exception:
        intraday_df = pd.DataFrame()

    ticker = yf.Ticker(symbol)
    if intraday_df.empty:
        intraday_df = _normalize_intraday_index(
            ticker.history(period="5d", interval="5m", auto_adjust=False, actions=False, prepost=False)
        )
    daily_df = _normalize_daily_frame(
        ticker.history(period="3mo", interval="1d", auto_adjust=False, actions=False, prepost=False)
    )
    return intraday_df, daily_df


def _build_live_payload(
    symbol: str,
    label: str,
    now: datetime,
    intraday_df: pd.DataFrame,
    daily_df: pd.DataFrame,
    news_ctx: dict,
) -> dict:
    latest_date = intraday_df.index.date[-1]
    today_df = intraday_df[intraday_df.index.date == latest_date]

    open_price = float(today_df["Open"].iloc[0])
    current_price = float(today_df["Close"].iloc[-1])
    high_price = float(today_df["High"].max())
    low_price = float(today_df["Low"].min())
    day_change_pct = ((current_price - open_price) / open_price * 100.0) if open_price else None
    range_position = _range_position_pct(current_price, low_price, high_price)
    recent_closes = today_df["Close"].tail(3)
    recent_delta = float(recent_closes.iloc[-1] - recent_closes.iloc[0]) if len(recent_closes) >= 2 else 0.0

    previous_day = _extract_previous_day_summary(intraday_df, latest_date)
    trend = _derive_live_trend(day_change_pct, range_position, recent_delta)
    intraday_score = _intraday_score(trend, day_change_pct, range_position, recent_delta)
    previous_score = _directional_score_from_session(previous_day.get("session_type", ""))
    daily_score = _daily_swing_score(daily_df)
    impact_summary = news_ctx.get("impact_summary", "No major trigger")
    avg_range_pct = _estimate_daily_range_pct(daily_df)
    current_session_type = _session_type_label(open_price, current_price, high_price, low_price)
    current_close_position = _close_position_label(current_price, low_price, high_price)
    supports, resistances = _key_levels(today_df, daily_df)

    next_day_score = intraday_score + (previous_score * 0.7) + (daily_score * 0.6)
    next_week_score = (daily_score * 1.5) + (previous_score * 0.5) + (intraday_score * 0.35)

    next_day_bias = _score_to_bias(next_day_score, neutral_label="WAIT")
    next_week_bias = _score_to_bias(next_week_score, neutral_label="NEUTRAL")

    return {
        "analysis_type": "MARKET_FOCUS",
        "mode": "LIVE",
        "market_open": True,
        "label": label,
        "symbol": symbol,
        "price": round(current_price, 2),
        "session_date": str(latest_date),
        "today_trend": trend,
        "today_confidence": _confidence_from_score(intraday_score, impact_summary),
        "today_signal": _trend_signal_label(trend),
        "today_note": _today_note(trend, previous_day.get("session_type", "Unavailable"), impact_summary),
        "session_type": current_session_type,
        "close_position": current_close_position,
        "yesterday_session": previous_day.get("session_type", "Unavailable"),
        "yesterday_close_position": previous_day.get("close_position", "Unknown"),
        "yesterday_move_pct": previous_day.get("net_change_pct"),
        "next_day_bias": next_day_bias,
        "next_day_confidence": _confidence_from_score(next_day_score, impact_summary),
        "next_day_target": _estimate_target(current_price, next_day_bias, avg_range_pct, 0.75),
        "next_day_risk": "Live-market view only. Confirm again after market close.",
        "next_day_note": _next_day_note(next_day_bias, current_session_type, live_mode=True),
        "next_week_bias": next_week_bias,
        "next_week_confidence": _confidence_from_score(next_week_score, impact_summary),
        "next_week_target_zone": _estimate_zone(current_price, next_week_bias, avg_range_pct, 2.0),
        "next_week_outlook": _next_week_outlook(next_week_bias, daily_score, impact_summary),
        "key_support": supports,
        "key_resistance": resistances,
        "global_news_impact": impact_summary,
        "global_news_items": news_ctx.get("items", [])[:4],
        "news_tomorrow": news_ctx.get("items", [])[:3],
        "captured_at": now.astimezone(IST).isoformat(),
        "analysis_status": "full",
        "free_tier_mode": True,
        "source": "TradingView/yfinance + public RSS",
    }


def _build_eod_payload(
    symbol: str,
    label: str,
    now: datetime,
    intraday_df: pd.DataFrame,
    daily_df: pd.DataFrame,
    news_ctx: dict,
) -> dict:
    latest_date = intraday_df.index.date[-1]
    day_df = intraday_df[intraday_df.index.date == latest_date]

    open_price = float(day_df["Open"].iloc[0])
    close_price = float(day_df["Close"].iloc[-1])
    high_price = float(day_df["High"].max())
    low_price = float(day_df["Low"].min())
    session_type = _session_type_label(open_price, close_price, high_price, low_price)
    close_position = _close_position_label(close_price, low_price, high_price)
    previous_day = _extract_previous_day_summary(intraday_df, latest_date)
    impact_summary = news_ctx.get("impact_summary", "No major trigger")
    supports, resistances = _key_levels(day_df, daily_df)
    avg_range_pct = _estimate_daily_range_pct(daily_df)

    session_score = _directional_score_from_session(session_type)
    previous_score = _directional_score_from_session(previous_day.get("session_type", ""))
    daily_score = _daily_swing_score(daily_df)
    net_change_pct = ((close_price - open_price) / open_price * 100.0) if open_price else None

    today_trend = _score_to_bias(session_score, neutral_label="SIDEWAYS")
    next_day_score = (session_score * 1.3) + (daily_score * 0.8) + (previous_score * 0.4)
    next_week_score = (daily_score * 1.6) + (session_score * 0.6)

    next_day_bias = _score_to_bias(next_day_score, neutral_label="WAIT")
    next_week_bias = _score_to_bias(next_week_score, neutral_label="NEUTRAL")

    if _risk_level(impact_summary) == "high":
        next_day_risk = "High global-risk cues can override the base setup."
    elif _risk_level(impact_summary) == "moderate":
        next_day_risk = "Moderate macro/news risk can stretch volatility."
    else:
        next_day_risk = "Risk looks normal unless overnight news changes sharply."

    return {
        "analysis_type": "MARKET_FOCUS",
        "mode": "EOD",
        "market_open": False,
        "label": label,
        "symbol": symbol,
        "price": round(close_price, 2),
        "session_date": str(latest_date),
        "today_trend": today_trend,
        "today_confidence": _confidence_from_score(session_score, impact_summary),
        "today_signal": _trend_signal_label(today_trend),
        "today_note": (
            f"Closed session finished as {session_type.lower()} with the close near the "
            f"{close_position.lower()}."
        ),
        "session_type": session_type,
        "close_position": close_position,
        "yesterday_session": previous_day.get("session_type", "Unavailable"),
        "yesterday_close_position": previous_day.get("close_position", "Unknown"),
        "yesterday_move_pct": previous_day.get("net_change_pct"),
        "next_day_bias": next_day_bias,
        "next_day_confidence": _confidence_from_score(next_day_score, impact_summary),
        "next_day_target": _estimate_target(close_price, next_day_bias, avg_range_pct, 0.9),
        "next_day_risk": next_day_risk,
        "next_day_note": _next_day_note(next_day_bias, session_type, live_mode=False),
        "next_week_bias": next_week_bias,
        "next_week_confidence": _confidence_from_score(next_week_score, impact_summary),
        "next_week_target_zone": _estimate_zone(close_price, next_week_bias, avg_range_pct, 2.4),
        "next_week_outlook": _next_week_outlook(next_week_bias, daily_score, impact_summary),
        "key_support": supports,
        "key_resistance": resistances,
        "global_news_impact": impact_summary,
        "global_news_items": news_ctx.get("items", [])[:5],
        "news_tomorrow": news_ctx.get("items", [])[:4],
        "captured_at": now.astimezone(IST).isoformat(),
        "analysis_status": "full",
        "free_tier_mode": True,
        "source": "TradingView/yfinance + public RSS",
        "net_change_pct": round(float(net_change_pct), 2) if net_change_pct is not None else None,
    }


async def get_stock_focus_outlook(
    symbol: str,
    label: str,
    now: datetime,
    force_refresh: bool = False,
) -> dict:
    market_open, _ = is_indian_market_open(now)
    bucket = now.astimezone(IST).strftime("%Y%m%d%H") + f"{now.minute // 10}"
    prefix = STOCK_LIVE_CACHE_KEY_PREFIX if market_open else STOCK_EOD_CACHE_KEY_PREFIX
    ttl_seconds = STOCK_LIVE_CACHE_TTL_SECONDS if market_open else STOCK_EOD_CACHE_TTL_SECONDS
    cache_key = f"{prefix}{bucket}:{hashlib.md5(symbol.encode()).hexdigest()}"

    cached = cache_get(cache_key)
    if cached and not force_refresh:
        try:
            payload = json.loads(cached)
            if isinstance(payload, dict):
                return payload
        except Exception:
            pass

    try:
        intraday_df, daily_df = await _fetch_focus_frames(symbol)
        if intraday_df.empty:
            return _fallback_payload(symbol, label, "No intraday data available.", now, market_open)

        news_ctx = await _collect_live_market_news(now, max_items=5)
        if market_open:
            payload = _build_live_payload(symbol, label, now, intraday_df, daily_df, news_ctx)
        else:
            payload = _build_eod_payload(symbol, label, now, intraday_df, daily_df, news_ctx)

        cache_set(cache_key, json.dumps(payload), ttl_seconds)
        return payload
    except Exception as exc:
        logger.error("Market focus outlook error for %s: %s", symbol, exc)
        return _fallback_payload(symbol, label, str(exc)[:120], now, market_open)
