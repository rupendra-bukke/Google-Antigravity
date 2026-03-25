"""Router for the /api/v1/ endpoints."""

import asyncio
import json
from datetime import date, datetime, timedelta, timezone, time as dt_time

import httpx
from fastapi import APIRouter, HTTPException, Query

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
    is_nse_trading_day as market_is_nse_trading_day,
)
from services.decision import make_decision
from services.decision_v2 import run_advanced_analysis
from services.ai_decision import (
    EOD_CACHE_KEY_PREFIX,
    EOD_CACHE_TTL,
    _build_rule_based_eod_fallback,
    _fallback,
    cache_get,
    cache_set,
    get_ai_decision,
    get_eod_analysis,
)
from services.stock_focus import get_stock_focus_outlook
from config import settings

router = APIRouter(prefix="/api/v1", tags=["analyze"])

IST = timezone(timedelta(hours=5, minutes=30))
# Expiry dates do not change frequently intraday; long cache keeps free-tier API usage low.
EXPIRY_CACHE_TTL_SECONDS = 21600
_expiry_cache_payload: dict | None = None
_expiry_cache_ts: float = 0.0
_expiry_cache_lock = asyncio.Lock()

EXPIRY_INDEX_CONFIG = {
    "NIFTY": {
        "symbol": "^NSEI",
        "name": "Nifty 50",
        "exchange": "NSE",
        "expiry_weekday": 1,  # Tuesday (Mon=0)
        "fallback_mode": "weekly",
        "strike_step": 50,
    },
    "BANKNIFTY": {
        "symbol": "^NSEBANK",
        "name": "Bank Nifty",
        "exchange": "NSE",
        "expiry_weekday": 1,  # Tuesday
        "fallback_mode": "monthly_last",
        "strike_step": 100,
    },
    "FINNIFTY": {
        "symbol": "^CNXFINSERVICE",
        "name": "Fin Nifty",
        "exchange": "NSE",
        "expiry_weekday": 1,  # Tuesday
        "fallback_mode": "monthly_last",
        "strike_step": 50,
    },
    "SENSEX": {
        "symbol": "^BSESN",
        "name": "Sensex",
        "exchange": "BSE",
        "expiry_weekday": 3,  # Thursday
        "fallback_mode": "weekly",
        "strike_step": 100,
    },
}

NSE_EXPIRY_SYMBOLS = {
    "NIFTY": "NIFTY",
    "BANKNIFTY": "BANKNIFTY",
    "FINNIFTY": "FINNIFTY",
}

BSE_EXPIRY_SCRIP_CODES = {
    "SENSEX": 1,
}

WATCHLIST_DEFAULT_SYMBOLS = ["^NSEI", "^NSEBANK", "^CNXFINSERVICE", "^BSESN"]
WATCHLIST_LABELS = {
    "^NSEI": "NIFTY 50",
    "^NSEBANK": "BANK NIFTY",
    "^CNXFINSERVICE": "FINNIFTY",
    "^BSESN": "SENSEX",
}
MARKET_FOCUS_OPTIONS = [
    {"symbol": "^NSEI", "label": "NIFTY 50", "kind": "index"},
    {"symbol": "^NSEBANK", "label": "BANK NIFTY", "kind": "index"},
    {"symbol": "^BSESN", "label": "SENSEX", "kind": "index"},
    {"symbol": "JPPOWER.NS", "label": "JAIPRAKASH POWER", "kind": "stock"},
]
MARKET_FOCUS_BY_SYMBOL = {item["symbol"]: item for item in MARKET_FOCUS_OPTIONS}
ANALYZE_CACHE_KEY_PREFIX = "analyze_v2:"
ANALYZE_CACHE_TTL_SECONDS = 90


def _parse_nse_expiry(value: str) -> str | None:
    try:
        return datetime.strptime(value.strip(), "%d-%b-%Y").date().isoformat()
    except Exception:
        return None


def _parse_bse_expiry(value: str) -> str | None:
    try:
        return datetime.strptime(value.strip(), "%d %b %Y").date().isoformat()
    except Exception:
        return None


def _last_weekday_of_month(year: int, month: int, weekday: int) -> date:
    # month: 1..12
    if month == 12:
        d = date(year + 1, 1, 1) - timedelta(days=1)
    else:
        d = date(year, month + 1, 1) - timedelta(days=1)
    while d.weekday() != weekday:
        d -= timedelta(days=1)
    return d


def _fallback_next_expiry_date(now_ist: datetime, expiry_weekday: int, mode: str = "weekly") -> date:
    today = now_ist.date()
    if mode == "monthly_last":
        candidate = _last_weekday_of_month(today.year, today.month, expiry_weekday)
        if candidate >= today:
            return candidate
        next_month = 1 if today.month == 12 else today.month + 1
        next_year = today.year + 1 if today.month == 12 else today.year
        return _last_weekday_of_month(next_year, next_month, expiry_weekday)

    weekday = now_ist.weekday()
    diff_days = (expiry_weekday - weekday + 7) % 7
    return (now_ist + timedelta(days=diff_days)).date()


def _fallback_next_expiry_iso(now_ist: datetime, expiry_weekday: int, mode: str = "weekly") -> str:
    return _fallback_next_expiry_date(now_ist, expiry_weekday, mode).isoformat()


def _monthly_flag(next_expiry: date, all_expiries: list[date]) -> bool:
    month_dates = [d for d in all_expiries if d.year == next_expiry.year and d.month == next_expiry.month]
    if not month_dates:
        return False
    return next_expiry == max(month_dates)


async def _fetch_nse_expiry_dates(index_symbol: str) -> list[str]:
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) "
            "Gecko/20100101 Firefox/118.0"
        ),
        "Accept": "*/*",
        "Accept-Language": "en-US,en;q=0.5",
        "Accept-Encoding": "gzip, deflate",
        "Referer": "https://www.nseindia.com/option-chain",
    }
    async with httpx.AsyncClient(timeout=20, headers=headers, follow_redirects=True) as client:
        # Prime NSE cookies before API call.
        await client.get("https://www.nseindia.com/option-chain")
        resp = await client.get(
            "https://www.nseindia.com/api/option-chain-contract-info",
            params={"symbol": index_symbol},
        )
        resp.raise_for_status()
        data = resp.json()
    raw_dates = data.get("expiryDates", []) if isinstance(data, dict) else []
    return sorted({d for d in (_parse_nse_expiry(x) for x in raw_dates) if d})


async def _fetch_bse_expiry_dates(scrip_cd: int) -> list[str]:
    headers = {
        "User-Agent": "Mozilla/5.0",
        "Referer": "https://www.bseindia.com/markets/Derivatives/DeriReports/DeriOptionchain.html",
        "Origin": "https://www.bseindia.com",
        "Accept": "application/json, text/plain, */*",
    }
    async with httpx.AsyncClient(timeout=20, headers=headers, follow_redirects=True) as client:
        resp = await client.get(
            "https://api.bseindia.com/BseIndiaAPI/api/ddlExpiry_IV/w",
            params={"ProductType": "IO", "scrip_cd": str(scrip_cd)},
        )
        resp.raise_for_status()
        data = resp.json()

    table1 = data.get("Table1", []) if isinstance(data, dict) else []
    raw_dates = [row.get("ExpiryDate", "") for row in table1 if isinstance(row, dict)]
    return sorted({d for d in (_parse_bse_expiry(x) for x in raw_dates) if d})


async def _build_expiry_calendar_payload() -> dict:
    now_ist = datetime.now(timezone.utc).astimezone(IST)
    today = now_ist.date()
    source_by_index: dict[str, str] = {}
    dates_by_index: dict[str, list[str]] = {}
    errors: dict[str, str] = {}

    for idx, nse_symbol in NSE_EXPIRY_SYMBOLS.items():
        try:
            expiry_dates = await _fetch_nse_expiry_dates(nse_symbol)
            if not expiry_dates:
                raise ValueError("No expiry dates from NSE response")
            dates_by_index[idx] = expiry_dates
            source_by_index[idx] = "NSE option-chain-contract-info"
        except Exception as exc:
            errors[idx] = str(exc)

    for idx, scrip_cd in BSE_EXPIRY_SCRIP_CODES.items():
        try:
            expiry_dates = await _fetch_bse_expiry_dates(scrip_cd)
            if not expiry_dates:
                raise ValueError("No expiry dates from BSE response")
            dates_by_index[idx] = expiry_dates
            source_by_index[idx] = "BSE ddlExpiry_IV"
        except Exception as exc:
            errors[idx] = str(exc)

    cards: list[dict] = []
    for idx, cfg in EXPIRY_INDEX_CONFIG.items():
        parsed_dates = sorted(
            datetime.fromisoformat(d).date()
            for d in dates_by_index.get(idx, [])
            if isinstance(d, str)
        )
        future_dates = [d for d in parsed_dates if d >= today]

        if future_dates:
            next_expiry_date = future_dates[0]
            next_expiry_iso = next_expiry_date.isoformat()
            days_to_next = (next_expiry_date - today).days
            monthly = _monthly_flag(next_expiry_date, parsed_dates)
            source = source_by_index.get(idx, "exchange_api")
            expiry_type = "MONTHLY" if monthly else "WEEKLY"
            expiries = [d.isoformat() for d in parsed_dates[:24]]
        else:
            # Safety fallback if exchange API is unavailable.
            next_expiry_iso = _fallback_next_expiry_iso(
                now_ist,
                cfg["expiry_weekday"],
                cfg.get("fallback_mode", "weekly"),
            )
            next_expiry_date = datetime.fromisoformat(next_expiry_iso).date()
            days_to_next = (next_expiry_date - today).days
            source = "fallback_weekday_rule"
            expiry_type = "WEEKLY"
            expiries = [next_expiry_iso]

        cards.append(
            {
                "abbr": idx,
                "name": cfg["name"],
                "exchange": cfg["exchange"],
                "next_expiry": next_expiry_iso,
                "days_to_next": int(days_to_next),
                "expiry_today": days_to_next == 0,
                "expiry_type": expiry_type,
                "expiries": expiries,
                "source": source,
            }
        )

    cards.sort(key=lambda c: (c.get("days_to_next", 999), c.get("abbr", "")))
    return {
        "as_of_ist": now_ist.isoformat(),
        "source": "NSE/BSE exchange APIs",
        "today_expiries": [c["abbr"] for c in cards if c.get("expiry_today")],
        "cards": cards,
        "errors": errors,
    }


async def get_expiry_calendar(force_refresh: bool = False) -> dict:
    global _expiry_cache_payload, _expiry_cache_ts

    now_ts = datetime.now(timezone.utc).timestamp()
    if (
        not force_refresh
        and _expiry_cache_payload is not None
        and (now_ts - _expiry_cache_ts) < EXPIRY_CACHE_TTL_SECONDS
    ):
        return _expiry_cache_payload

    async with _expiry_cache_lock:
        now_ts = datetime.now(timezone.utc).timestamp()
        if (
            not force_refresh
            and _expiry_cache_payload is not None
            and (now_ts - _expiry_cache_ts) < EXPIRY_CACHE_TTL_SECONDS
        ):
            return _expiry_cache_payload

        try:
            payload = await _build_expiry_calendar_payload()
            _expiry_cache_payload = payload
            _expiry_cache_ts = now_ts
            return payload
        except Exception:
            if _expiry_cache_payload is not None:
                return _expiry_cache_payload
            raise


def _analyze_cache_key(symbol: str, include_candles: bool) -> str:
    import hashlib

    mode = "full" if include_candles else "lite"
    cache_input = f"{symbol}:{mode}"
    return f"{ANALYZE_CACHE_KEY_PREFIX}{hashlib.md5(cache_input.encode()).hexdigest()}"


async def _build_analyze_payload(sym: str, include_candles: bool = True, max_candles: int = 180) -> dict:
    cache_key = _analyze_cache_key(sym, include_candles=include_candles)
    cached = cache_get(cache_key)
    if cached:
        try:
            return json.loads(cached)
        except Exception:
            pass

    # For lightweight endpoints, avoid 1m fetch/resample.
    frames = await fetch_multi_timeframe(sym, include_1m=False)
    df = frames.get("5m")
    if df is None or df.empty:
        df = frames.get("15m")
    if df is None or df.empty:
        df = await fetch_intraday(sym, interval="5m", period="5d")

    price = get_latest_price(df)
    day_open = round(float(df["Open"].iloc[0]), 2)
    ema20 = calc_ema20(df)
    rsi = calc_rsi(df)
    vwap = calc_vwap(df)
    bb_upper, bb_middle, bb_lower = calc_bollinger(df)
    macd_line, signal_line, histogram = calc_macd(df)
    candles = get_ohlc_series(df, max_points=max_candles) if include_candles else []

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

    payload = {
        "symbol": sym,
        "price": price,
        "day_open": day_open,
        "indicators": {
            "ema20": ema20,
            "rsi14": rsi,
            "vwap": vwap,
            "bollinger": {"upper": bb_upper, "middle": bb_middle, "lower": bb_lower},
            "macd": {"macd_line": macd_line, "signal_line": signal_line, "histogram": histogram},
            "signals": signals,
        },
        "decision": decision,
        "reasoning": reasoning,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "candles": candles,
    }
    cache_set(cache_key, json.dumps(payload), ANALYZE_CACHE_TTL_SECONDS)
    return payload


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
        payload = await _build_analyze_payload(sym)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to fetch data: {exc}")

    return AnalyzeResponse(
        symbol=payload["symbol"],
        price=payload["price"],
        indicators=IndicatorData(
            ema20=payload["indicators"]["ema20"],
            rsi14=payload["indicators"]["rsi14"],
            vwap=payload["indicators"]["vwap"],
            bollinger=BollingerData(
                upper=payload["indicators"]["bollinger"]["upper"],
                middle=payload["indicators"]["bollinger"]["middle"],
                lower=payload["indicators"]["bollinger"]["lower"],
            ),
            macd=MacdData(
                macd_line=payload["indicators"]["macd"]["macd_line"],
                signal_line=payload["indicators"]["macd"]["signal_line"],
                histogram=payload["indicators"]["macd"]["histogram"],
            ),
            signals=payload["indicators"]["signals"],
        ),
        decision=payload["decision"],
        reasoning=payload["reasoning"],
        timestamp=payload["timestamp"],
        candles=[OhlcBar(**c) for c in payload["candles"]],
    )


@router.get("/watchlist-snapshot")
async def watchlist_snapshot(symbols: str = Query(default=",".join(WATCHLIST_DEFAULT_SYMBOLS))):
    """
    Batched watchlist endpoint to reduce frontend request count.
    Returns compact per-symbol rows for UI cards.
    """
    now = datetime.now(timezone.utc).isoformat()
    requested = [s.strip() for s in (symbols or "").split(",") if s.strip()]
    if not requested:
        requested = WATCHLIST_DEFAULT_SYMBOLS.copy()
    requested = requested[:8]

    rows: list[dict] = []
    for sym in requested:
        try:
            payload = await _build_analyze_payload(sym, include_candles=False)
            open_price = payload.get("day_open")
            if not isinstance(open_price, (int, float)):
                open_price = None
            price = float(payload.get("price"))
            move_pct = ((price - open_price) / open_price * 100.0) if open_price else None

            rows.append(
                {
                    "symbol": sym,
                    "label": WATCHLIST_LABELS.get(sym, sym),
                    "price": price,
                    "move_pct": move_pct,
                    "decision": payload.get("decision", "HOLD"),
                    "timestamp": payload.get("timestamp"),
                    "status": "ok",
                }
            )
        except Exception as exc:
            rows.append(
                {
                    "symbol": sym,
                    "label": WATCHLIST_LABELS.get(sym, sym),
                    "price": None,
                    "move_pct": None,
                    "decision": "UNKNOWN",
                    "timestamp": None,
                    "status": "error",
                    "error": str(exc)[:200],
                }
            )

    return {
        "captured_at": now,
        "items": rows,
    }


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

AI_DECISION_SYMBOLS = ["^NSEI", "^NSEBANK", "^BSESN"]
AI_SNAPSHOT_WINDOWS = [
    {"id": "1000", "time": "10:00", "hhmm": 1000, "label": "Morning"},
    {"id": "1430", "time": "14:30", "hhmm": 1430, "label": "Afternoon"},
]
AI_SNAPSHOT_CACHE_PREFIX = "ai_decision_snapshot:"
AI_SNAPSHOT_CACHE_TTL_SECONDS = 172800
AI_PENDING_RETRY_SECONDS = 120
EOD_PENDING_RETRY_SECONDS = 300


def _ai_snapshot_cache_key(symbol: str, date_str: str, snapshot_id: str) -> str:
    import hashlib

    return (
        f"{AI_SNAPSHOT_CACHE_PREFIX}{date_str}:{snapshot_id}:"
        f"{hashlib.md5(symbol.encode()).hexdigest()}"
    )


def _ai_snapshot_slot(snapshot_id: str) -> dict | None:
    return next((slot for slot in AI_SNAPSHOT_WINDOWS if slot["id"] == snapshot_id), None)


def _resolve_ai_snapshot_window(ist_now: datetime) -> tuple[dict | None, dict | None]:
    hhmm = ist_now.hour * 100 + ist_now.minute

    active = None
    for slot in reversed(AI_SNAPSHOT_WINDOWS):
        if hhmm >= slot["hhmm"]:
            active = slot
            break

    if active is None:
        return None, AI_SNAPSHOT_WINDOWS[0]

    idx = next((i for i, slot in enumerate(AI_SNAPSHOT_WINDOWS) if slot["id"] == active["id"]), -1)
    if idx == -1 or idx + 1 >= len(AI_SNAPSHOT_WINDOWS):
        return active, None
    return active, AI_SNAPSHOT_WINDOWS[idx + 1]


def _snapshot_valid_until_ist(ist_now: datetime, next_slot: dict | None) -> datetime:
    if next_slot is not None:
        return ist_now.replace(
            hour=int(next_slot["hhmm"] // 100),
            minute=int(next_slot["hhmm"] % 100),
            second=0,
            microsecond=0,
        )
    return ist_now.replace(hour=15, minute=30, second=0, microsecond=0)


def _scheduled_retry_ist(ist_now: datetime, seconds: int, clamp_to: datetime | None = None) -> datetime:
    retry_at = ist_now + timedelta(seconds=seconds)
    if clamp_to is not None and retry_at > clamp_to:
        return clamp_to
    return retry_at


def _load_json_cache(key: str) -> dict | None:
    cached = cache_get(key)
    if not cached:
        return None
    try:
        data = json.loads(cached)
        return data if isinstance(data, dict) else None
    except Exception:
        return None


def _load_scheduled_ai_snapshot(date_str: str, symbol: str, snapshot_id: str) -> dict | None:
    return _load_json_cache(_ai_snapshot_cache_key(symbol, date_str, snapshot_id))


def _load_latest_scheduled_ai_snapshot(date_str: str, symbol: str, upto_hhmm: int) -> tuple[dict | None, dict | None]:
    for slot in reversed(AI_SNAPSHOT_WINDOWS):
        if slot["hhmm"] > upto_hhmm:
            continue
        payload = _load_scheduled_ai_snapshot(date_str, symbol, slot["id"])
        if payload is not None:
            return slot, payload
    return None, None



def _zero_hero_snapshot_cache_key(index_abbr: str, date_str: str, snapshot_id: str) -> str:
    import hashlib

    return (
        f"ai_zero_hero_snapshot:{date_str}:{snapshot_id}:"
        f"{hashlib.md5(index_abbr.encode()).hexdigest()}"
    )


ZERO_HERO_SNAPSHOT_WINDOWS = [
    {"id": "1500", "time": "15:00", "hhmm": 1500, "label": "3PM Open"},
    {"id": "1507", "time": "15:07", "hhmm": 1507, "label": "3PM Confirm"},
]
ZERO_HERO_PENDING_RETRY_SECONDS = 60


def _resolve_zero_hero_snapshot_window(ist_now: datetime) -> tuple[dict | None, dict | None]:
    hhmm = ist_now.hour * 100 + ist_now.minute
    active = None
    for slot in reversed(ZERO_HERO_SNAPSHOT_WINDOWS):
        if hhmm >= slot["hhmm"]:
            active = slot
            break

    if active is None:
        return None, ZERO_HERO_SNAPSHOT_WINDOWS[0]

    idx = next((i for i, slot in enumerate(ZERO_HERO_SNAPSHOT_WINDOWS) if slot["id"] == active["id"]), -1)
    if idx == -1 or idx + 1 >= len(ZERO_HERO_SNAPSHOT_WINDOWS):
        return active, None
    return active, ZERO_HERO_SNAPSHOT_WINDOWS[idx + 1]


def _load_zero_hero_snapshot(date_str: str, index_abbr: str, snapshot_id: str) -> dict | None:
    return _load_json_cache(_zero_hero_snapshot_cache_key(index_abbr, date_str, snapshot_id))


def _load_latest_zero_hero_snapshot(date_str: str, index_abbr: str, upto_hhmm: int) -> tuple[dict | None, dict | None]:
    for slot in reversed(ZERO_HERO_SNAPSHOT_WINDOWS):
        if slot["hhmm"] > upto_hhmm:
            continue
        payload = _load_zero_hero_snapshot(date_str, index_abbr, slot["id"])
        if payload is not None:
            return slot, payload
    return None, None


def _decorate_zero_hero_snapshot(
    payload: dict,
    snapshot_slot: dict,
    next_slot: dict | None,
    valid_until: datetime,
    next_refresh_at: datetime,
    snapshot_stale: bool = False,
) -> dict:
    data = dict(payload)
    data["checkpoint_mode"] = True
    data["active_checkpoint"] = snapshot_slot["id"]
    data["active_checkpoint_time_ist"] = snapshot_slot["time"]
    data["next_checkpoint"] = next_slot["id"] if next_slot else None
    data["next_checkpoint_time_ist"] = next_slot["time"] if next_slot else None
    data["valid_until_ist"] = valid_until.isoformat()
    data["next_refresh_at_ist"] = next_refresh_at.isoformat()
    data["checkpoint_generated_at_ist"] = data.get("captured_at") or next_refresh_at.isoformat()
    data["snapshot_mode"] = True
    data["snapshot_label"] = f"{snapshot_slot['label']} snapshot"
    data["snapshot_stale"] = snapshot_stale
    data["checkpoint_plan"] = "STRICT_3PM_BREAKOUT"
    return data


def _build_zero_hero_pending_payload(idx: str, cfg: dict, now_ist: datetime, next_slot: dict | None, next_expiry: str) -> dict:
    next_refresh_at = _snapshot_valid_until_ist(now_ist, next_slot)
    return {
        "index": idx,
        "index_name": cfg["name"],
        "exchange": cfg["exchange"],
        "symbol": cfg["symbol"],
        "expiry_today": True,
        "next_expiry": next_expiry,
        "trade_type": "NO TRADE",
        "reason": "NO TRADE - 3:00 PM snapshot is not generated yet.",
        "entry": "Wait for 3:00 PM checkpoint output.",
        "stop_loss": "Not applicable",
        "target_1": "Not applicable",
        "target_2": "Not applicable",
        "risk_level": "LOW",
        "confidence_pct": 35,
        "strike": "NO TRADE",
        "market_context": "SIDEWAYS",
        "trap_check": "Window not active yet. Avoid pre-trigger entries.",
        "position_sizing": "Low risk only.",
        "setup": {
            "day_high": None,
            "day_low": None,
            "vwap": None,
            "current_price": None,
            "price_vs_vwap": "UNKNOWN",
            "breakout_trigger": "NONE",
            "breakout_candle": "UNKNOWN",
            "choppy_zone": "UNKNOWN",
            "timeframe_used": "5m",
        },
        "headline": "Awaiting strict 3PM expiry snapshot",
        "overall_risk": "HIGH",
        "market_phase": "PRE_3PM",
        "no_trade_filter": "No valid checkpoint snapshot yet.",
        "risk_note": "Wait for strict breakout confirmation.",
        "windows": [],
        "source": "info",
        "captured_at": now_ist.isoformat(),
        "checkpoint_mode": True,
        "active_checkpoint": None,
        "active_checkpoint_time_ist": None,
        "next_checkpoint": next_slot["id"] if next_slot else None,
        "next_checkpoint_time_ist": next_slot["time"] if next_slot else None,
        "valid_until_ist": next_refresh_at.isoformat(),
        "next_refresh_at_ist": next_refresh_at.isoformat(),
        "checkpoint_generated_at_ist": now_ist.isoformat(),
        "snapshot_mode": True,
        "snapshot_label": "Waiting for 3PM snapshot",
        "snapshot_stale": True,
        "checkpoint_plan": "STRICT_3PM_BREAKOUT",
    }
def _load_cached_eod_payload(target_day: date, symbol: str) -> dict | None:
    import hashlib

    cache_key = f"{EOD_CACHE_KEY_PREFIX}{target_day.strftime('%Y-%m-%d')}:{hashlib.md5(symbol.encode()).hexdigest()}"
    return _load_json_cache(cache_key)


def _decorate_intraday_snapshot(
    payload: dict,
    symbol: str,
    snapshot_slot: dict,
    next_slot: dict | None,
    valid_until: datetime,
    next_refresh_at: datetime,
    snapshot_stale: bool = False,
) -> dict:
    data = dict(payload)
    data.setdefault("analysis_type", "INTRADAY")
    data.setdefault("symbol", symbol)
    data["checkpoint_mode"] = True
    data["active_checkpoint"] = snapshot_slot["id"]
    data["active_checkpoint_time_ist"] = snapshot_slot["time"]
    data["next_checkpoint"] = next_slot["id"] if next_slot else None
    data["next_checkpoint_time_ist"] = next_slot["time"] if next_slot else "15:30"
    data["valid_until_ist"] = valid_until.isoformat()
    data["next_refresh_at_ist"] = next_refresh_at.isoformat()
    data["checkpoint_generated_at_ist"] = data.get("captured_at") or next_refresh_at.isoformat()
    data["snapshot_mode"] = True
    data["snapshot_label"] = f"{snapshot_slot['label']} snapshot"
    data["snapshot_stale"] = snapshot_stale
    return data


def _build_intraday_snapshot_fallback(
    symbol: str,
    now_ist: datetime,
    active_slot: dict | None,
    next_slot: dict | None,
    next_refresh_at: datetime,
    reason: str,
) -> dict:
    payload = _fallback(reason)
    payload.update(
        {
            "analysis_type": "INTRADAY",
            "symbol": symbol,
            "checkpoint_mode": True,
            "active_checkpoint": active_slot["id"] if active_slot else None,
            "active_checkpoint_time_ist": active_slot["time"] if active_slot else None,
            "next_checkpoint": next_slot["id"] if next_slot else None,
            "next_checkpoint_time_ist": next_slot["time"] if next_slot else ("15:30" if active_slot else None),
            "valid_until_ist": next_refresh_at.isoformat(),
            "next_refresh_at_ist": next_refresh_at.isoformat(),
            "checkpoint_generated_at_ist": now_ist.isoformat(),
            "snapshot_mode": True,
            "snapshot_label": f"{active_slot['label']} snapshot pending" if active_slot else "Waiting for morning snapshot",
            "snapshot_stale": True,
        }
    )
    return payload


async def run_ai_snapshot_for_all_symbols(snapshot_id: str, now: datetime | None = None) -> dict:
    snapshot_slot = _ai_snapshot_slot(snapshot_id)
    if snapshot_slot is None:
        raise ValueError(f"Invalid AI snapshot_id: {snapshot_id}")

    current_now = now or datetime.now(timezone.utc)
    date_str = current_now.astimezone(IST).strftime("%Y-%m-%d")
    idx = next((i for i, slot in enumerate(AI_SNAPSHOT_WINDOWS) if slot["id"] == snapshot_id), -1)
    next_slot = AI_SNAPSHOT_WINDOWS[idx + 1] if idx != -1 and idx + 1 < len(AI_SNAPSHOT_WINDOWS) else None

    summary = {
        "snapshot_id": snapshot_id,
        "snapshot_time": snapshot_slot["time"],
        "date": date_str,
        "saved_symbols": [],
        "fallback_symbols": [],
    }

    for sym in AI_DECISION_SYMBOLS:
        try:
            frames = await fetch_multi_timeframe(sym, include_1m=False)
            horizon_target = next_slot["time"] if next_slot else "15:30"
            horizon_text = (
                f"Scheduled live snapshot captured at {snapshot_slot['time']} IST. "
                f"Predict the most probable next move ONLY until {horizon_target} IST. "
                "Do not provide full-day forecast."
            )
            payload = await get_ai_decision(
                frames,
                sym,
                current_now,
                checkpoint_horizon=horizon_text,
            )
        except Exception as exc:
            payload = _fallback(f"Scheduled AI snapshot failed: {exc}")
            payload["symbol"] = sym

        payload.setdefault("symbol", sym)
        payload.setdefault("captured_at", current_now.astimezone(IST).isoformat())
        payload["scheduled_snapshot_id"] = snapshot_slot["id"]
        payload["scheduled_snapshot_time_ist"] = snapshot_slot["time"]

        cache_set(
            _ai_snapshot_cache_key(sym, date_str, snapshot_id),
            json.dumps(payload),
            AI_SNAPSHOT_CACHE_TTL_SECONDS,
        )

        if payload.get("analysis_status") == "fallback":
            summary["fallback_symbols"].append(sym)
        else:
            summary["saved_symbols"].append(sym)

    return summary


async def run_eod_ai_for_all_symbols(now: datetime | None = None) -> dict:
    import hashlib

    current_now = now or datetime.now(timezone.utc)
    ist_now = current_now.astimezone(IST)
    date_str = ist_now.strftime("%Y-%m-%d")
    next_open = _next_nse_market_open_ist(ist_now).isoformat()
    summary = {
        "date": date_str,
        "saved_symbols": [],
        "fallback_symbols": [],
    }

    for sym in AI_DECISION_SYMBOLS:
        payload = await get_eod_analysis(sym, current_now)
        payload.setdefault("analysis_type", "EOD")
        payload.setdefault("session_date", date_str)
        payload["symbol"] = sym
        payload["next_refresh_at_ist"] = next_open

        cache_key = f"{EOD_CACHE_KEY_PREFIX}{date_str}:{hashlib.md5(sym.encode()).hexdigest()}"
        cache_set(cache_key, json.dumps(payload), EOD_CACHE_TTL)

        if payload.get("analysis_status") == "fallback":
            summary["fallback_symbols"].append(sym)
        else:
            summary["saved_symbols"].append(sym)

    return summary


def _is_nse_trading_day(day: date) -> bool:
    """Shared helper so EOD and scheduled AI timing stay holiday-aware."""
    return market_is_nse_trading_day(day)


def _previous_nse_trading_day(day: date) -> date:
    probe = day - timedelta(days=1)
    for _ in range(14):
        if _is_nse_trading_day(probe):
            return probe
        probe -= timedelta(days=1)
    return day


def _next_nse_market_open_ist(now_ist: datetime) -> datetime:
    today = now_ist.date()
    open_time = dt_time(9, 15)

    if _is_nse_trading_day(today) and now_ist.time() < open_time:
        return datetime.combine(today, open_time, tzinfo=IST)

    probe = today + timedelta(days=1)
    for _ in range(14):
        if _is_nse_trading_day(probe):
            return datetime.combine(probe, open_time, tzinfo=IST)
        probe += timedelta(days=1)

    return datetime.combine(today + timedelta(days=1), open_time, tzinfo=IST)


def _latest_eod_date_for_display(now_ist: datetime) -> date:
    """
    Which session's EOD should be shown while market is closed:
    - After 15:30 on a trading day -> today
    - Otherwise -> most recent previous trading day
    """
    today = now_ist.date()
    if _is_nse_trading_day(today) and now_ist.time() >= dt_time(15, 30):
        return today
    return _previous_nse_trading_day(today)


def _build_eod_cache_fallback(
    symbol: str,
    now_ist: datetime,
    session_date: str,
    next_refresh_at_ist: str,
) -> dict:
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
        "reasoning": "Saved EOD plan is not ready yet. Wait for the scheduled close update.",
        "captured_at": now_ist.isoformat(),
        "session_date": session_date,
        "symbol": symbol,
        "analysis_status": "fallback",
        "next_refresh_at_ist": next_refresh_at_ist,
        "eod_cache_only": True,
    }


@router.get("/ai-decision")
async def ai_decision_endpoint(symbol: str = Query(default=None)):
    """
    Saved AI decision flow. Gemini runs only on scheduled backend jobs:
    - Market OPEN  -> Saved intraday AI snapshots at 10:00 and 14:30 IST
    - Market CLOSED -> Saved EOD next-day outlook from 15:30 IST
    Refresh only reloads the latest saved snapshot.
    """
    try:
        sym = symbol or settings.default_symbol
        now = datetime.now(timezone.utc)
        ist_now = datetime.now(timezone(timedelta(hours=5, minutes=30)))

        is_open, _ = is_indian_market_open(now)
        if is_open:
            date_str = ist_now.strftime("%Y-%m-%d")
            active_slot, next_slot = _resolve_ai_snapshot_window(ist_now)

            if active_slot is None:
                next_refresh_at = _snapshot_valid_until_ist(ist_now, next_slot)
                return _build_intraday_snapshot_fallback(
                    symbol=sym,
                    now_ist=ist_now,
                    active_slot=None,
                    next_slot=next_slot,
                    next_refresh_at=next_refresh_at,
                    reason="First saved AI snapshot will be available at 10:00 IST.",
                )

            valid_until = _snapshot_valid_until_ist(ist_now, next_slot)
            current_payload = _load_scheduled_ai_snapshot(date_str, sym, active_slot["id"])
            if current_payload is not None:
                return _decorate_intraday_snapshot(
                    payload=current_payload,
                    symbol=sym,
                    snapshot_slot=active_slot,
                    next_slot=next_slot,
                    valid_until=valid_until,
                    next_refresh_at=valid_until,
                    snapshot_stale=False,
                )

            latest_slot, latest_payload = _load_latest_scheduled_ai_snapshot(date_str, sym, active_slot["hhmm"])
            retry_at = _scheduled_retry_ist(ist_now, AI_PENDING_RETRY_SECONDS, clamp_to=valid_until)
            if latest_slot is not None and latest_payload is not None:
                pending_next_slot = active_slot if latest_slot["id"] != active_slot["id"] else next_slot
                return _decorate_intraday_snapshot(
                    payload=latest_payload,
                    symbol=sym,
                    snapshot_slot=latest_slot,
                    next_slot=pending_next_slot,
                    valid_until=retry_at,
                    next_refresh_at=retry_at,
                    snapshot_stale=latest_slot["id"] != active_slot["id"],
                )

            return _build_intraday_snapshot_fallback(
                symbol=sym,
                now_ist=ist_now,
                active_slot=active_slot,
                next_slot=next_slot,
                next_refresh_at=retry_at,
                reason="Scheduled AI snapshot is not ready yet. Retry shortly.",
            )

        next_open = _next_nse_market_open_ist(ist_now)
        session_date = _latest_eod_date_for_display(ist_now)
        session_dates = [session_date]
        prev_session = _previous_nse_trading_day(session_date)
        if prev_session != session_date:
            session_dates.append(prev_session)

        fallback_eod: dict | None = None
        for d in session_dates:
            data = _load_cached_eod_payload(d, sym)
            if data is None:
                continue
            data.setdefault("analysis_type", "EOD")
            data.setdefault("session_date", d.strftime("%Y-%m-%d"))
            data.setdefault("symbol", sym)
            data["next_refresh_at_ist"] = next_open.isoformat()
            data["eod_cache_only"] = True

            if str(data.get("analysis_status", "")).lower() != "fallback":
                return data
            if fallback_eod is None:
                fallback_eod = data

        if fallback_eod is not None:
            # Self-heal legacy cached fallback payloads that still show Unavailable/Unknown.
            if (
                str(fallback_eod.get("session_type", "")).lower() == "unavailable"
                or str(fallback_eod.get("close_position", "")).lower() == "unknown"
            ):
                repaired = await _build_rule_based_eod_fallback(
                    symbol=sym,
                    now=now,
                    reason="Upgrading legacy fallback EOD snapshot for display stability.",
                )
                repaired.setdefault("analysis_type", "EOD")
                repaired.setdefault("session_date", fallback_eod.get("session_date") or session_date.strftime("%Y-%m-%d"))
                repaired["symbol"] = sym
                repaired["next_refresh_at_ist"] = next_open.isoformat()
                repaired["eod_cache_only"] = True

                try:
                    import hashlib

                    target_date = str(repaired.get("session_date") or session_date.strftime("%Y-%m-%d"))
                    cache_key = f"{EOD_CACHE_KEY_PREFIX}{target_date}:{hashlib.md5(sym.encode()).hexdigest()}"
                    cache_set(cache_key, json.dumps(repaired), EOD_CACHE_TTL)
                except Exception:
                    pass

                return repaired
            return fallback_eod

        retry_at = next_open
        if _is_nse_trading_day(ist_now.date()) and ist_now.time() >= dt_time(15, 30):
            retry_at = _scheduled_retry_ist(ist_now, EOD_PENDING_RETRY_SECONDS, clamp_to=next_open)

        return _build_eod_cache_fallback(
            symbol=sym,
            now_ist=ist_now,
            session_date=session_date.strftime("%Y-%m-%d"),
            next_refresh_at_ist=retry_at.isoformat(),
        )
    except Exception as exc:
        return _fallback(f"AI decision endpoint failed: {exc}")


@router.get("/market-focus-options")
async def market_focus_options():
    return {
        "items": MARKET_FOCUS_OPTIONS,
        "default_symbol": MARKET_FOCUS_OPTIONS[0]["symbol"],
        "note": "Free-tier-safe focus view using TradingView/yfinance + public RSS. Auto-refresh stays cached; Refresh forces a fresh check.",
    }


@router.get("/market-focus")
async def market_focus(
    symbol: str = Query(default="^NSEI"),
    refresh: bool = Query(default=False, description="Force a fresh market-focus fetch"),
):
    asset = MARKET_FOCUS_BY_SYMBOL.get(symbol)
    if not asset:
        allowed = ", ".join(item["symbol"] for item in MARKET_FOCUS_OPTIONS)
        raise HTTPException(status_code=400, detail=f"Invalid symbol. Allowed: {allowed}")

    now = datetime.now(timezone.utc)
    payload = await get_stock_focus_outlook(
        symbol=asset["symbol"],
        label=asset["label"],
        now=now,
        force_refresh=refresh,
    )
    payload["asset_kind"] = asset["kind"]
    payload["options_count"] = len(MARKET_FOCUS_OPTIONS)
    payload["served_at"] = now.astimezone(IST).isoformat()
    return payload

@router.get("/expiry-calendar")
async def expiry_calendar(refresh: bool = Query(False, description="Force refresh from exchange APIs")):
    try:
        return await get_expiry_calendar(force_refresh=refresh)
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Failed to fetch expiry calendar: {exc}")


@router.get("/expiry-zero-hero")
async def expiry_zero_hero_endpoint(index: str = Query(..., description="NIFTY|BANKNIFTY|FINNIFTY|SENSEX")):
    """
    Strict expiry-day VWAP breakout plan.
    AI is generated only at saved 3PM checkpoints and served from cache otherwise.
    """
    from services.ai_decision import (
        cache_set,
        get_expiry_zero_hero_ai,
    )

    idx = (index or "").upper().strip()
    cfg = EXPIRY_INDEX_CONFIG.get(idx)
    if not cfg:
        raise HTTPException(status_code=400, detail="Invalid index. Use NIFTY, BANKNIFTY, FINNIFTY, or SENSEX.")

    now = datetime.now(timezone.utc)
    ist_now = now.astimezone(IST)
    fallback_next = _fallback_next_expiry_date(
        ist_now,
        cfg["expiry_weekday"],
        cfg.get("fallback_mode", "weekly"),
    )
    next_expiry = fallback_next.isoformat()
    expiry_today = fallback_next == ist_now.date()

    try:
        calendar = await get_expiry_calendar(force_refresh=False)
        cards = calendar.get("cards", []) if isinstance(calendar, dict) else []
        match = next((c for c in cards if c.get("abbr") == idx), None)
        if isinstance(match, dict):
            expiry_today = bool(match.get("expiry_today"))
            if isinstance(match.get("next_expiry"), str) and match.get("next_expiry"):
                next_expiry = match["next_expiry"]
    except Exception:
        expiry_today = fallback_next == ist_now.date()

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

    date_str = ist_now.strftime("%Y-%m-%d")
    active_slot, next_slot = _resolve_zero_hero_snapshot_window(ist_now)

    if active_slot is None:
        return _build_zero_hero_pending_payload(
            idx=idx,
            cfg=cfg,
            now_ist=ist_now,
            next_slot=next_slot,
            next_expiry=next_expiry,
        )

    valid_until = _snapshot_valid_until_ist(ist_now, next_slot)
    current_payload = _load_zero_hero_snapshot(date_str, idx, active_slot["id"])
    if current_payload is not None:
        current_payload.setdefault("expiry_today", True)
        current_payload.setdefault("next_expiry", next_expiry)
        return _decorate_zero_hero_snapshot(
            payload=current_payload,
            snapshot_slot=active_slot,
            next_slot=next_slot,
            valid_until=valid_until,
            next_refresh_at=valid_until,
            snapshot_stale=False,
        )

    latest_slot, latest_payload = _load_latest_zero_hero_snapshot(date_str, idx, active_slot["hhmm"])
    retry_at = _scheduled_retry_ist(ist_now, ZERO_HERO_PENDING_RETRY_SECONDS, clamp_to=valid_until)
    if latest_slot is not None and latest_payload is not None:
        latest_payload.setdefault("expiry_today", True)
        latest_payload.setdefault("next_expiry", next_expiry)
        pending_next_slot = active_slot if latest_slot["id"] != active_slot["id"] else next_slot
        return _decorate_zero_hero_snapshot(
            payload=latest_payload,
            snapshot_slot=latest_slot,
            next_slot=pending_next_slot,
            valid_until=retry_at,
            next_refresh_at=retry_at,
            snapshot_stale=latest_slot["id"] != active_slot["id"],
        )

    spot_price = None
    frames = {}
    try:
        frames = await fetch_multi_timeframe(cfg["symbol"], include_1m=False)
        for key in ("5m", "15m", "1h", "3m"):
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
    result["scheduled_snapshot_id"] = active_slot["id"]
    result["scheduled_snapshot_time_ist"] = active_slot["time"]

    cache_set(
        _zero_hero_snapshot_cache_key(idx, date_str, active_slot["id"]),
        json.dumps(result),
        AI_SNAPSHOT_CACHE_TTL_SECONDS,
    )

    return _decorate_zero_hero_snapshot(
        payload=result,
        snapshot_slot=active_slot,
        next_slot=next_slot,
        valid_until=valid_until,
        next_refresh_at=valid_until,
        snapshot_stale=False,
    )

