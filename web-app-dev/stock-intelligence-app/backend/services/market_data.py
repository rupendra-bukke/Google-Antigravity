"""Market data service for multi-timeframe fetching and indicator calculations.

Source strategy:
  1. Attempt TradingView via tvDatafeed when it is installed locally
  2. Fall back to yfinance per interval if TradingView is unavailable

Render free-tier deploys do not install tvDatafeed, so yfinance is the active
production market-data source.
"""

import asyncio
import logging

import numpy as np
import pandas as pd
import pytz
import yfinance as yf
from datetime import date as date_cls, datetime, time, timezone

logger = logging.getLogger(__name__)

NSE_HOLIDAYS_2026 = {
    "2026-01-26",  # Republic Day
    "2026-03-03",  # Holi (Dhuleti)
    "2026-04-02",  # Good Friday / Ram Navami
    "2026-04-14",  # Dr Ambedkar Jayanti
    "2026-05-01",  # Maharashtra Day
    "2026-08-15",  # Independence Day
    "2026-10-02",  # Gandhi Jayanti
    "2026-10-20",  # Diwali Laxmi Pujan (approx)
    "2026-10-21",  # Diwali Balipratipada (approx)
    "2026-11-18",  # Guru Nanak Jayanti (approx)
}

# ── TradingView configuration ─────────────────────────────────────────────────

# yfinance ticker → (tvDatafeed symbol, exchange)
TV_SYMBOL_MAP: dict[str, tuple[str, str]] = {
    "^NSEI":     ("NIFTY",     "NSE"),
    "^NSEBANK":  ("BANKNIFTY", "NSE"),
    "^CNXFINSERVICE": ("FINNIFTY", "NSE"),
    "^BSESN":    ("SENSEX",    "BSE"),
    "NIFTY":     ("NIFTY",     "NSE"),
    "BANKNIFTY": ("BANKNIFTY", "NSE"),
    "FINNIFTY":  ("FINNIFTY",  "NSE"),
    "SENSEX":    ("SENSEX",    "BSE"),
}

# interval string → tvDatafeed Interval attribute name (lazy import)
TV_INTERVAL_ATTR: dict[str, str] = {
    "1m":  "in_1_minute",
    "5m":  "in_5_minute",
    "15m": "in_15_minute",
    "1h":  "in_1_hour",
}

# how many bars to fetch per interval (covers ~2-3 trading days)
TV_N_BARS: dict[str, int] = {
    "1m": 500, "5m": 200, "15m": 100, "1h": 50,
}

FRAME_MAX_BARS: dict[str, int] = {
    "1m": 320,
    "3m": 240,
    "5m": 220,
    "15m": 220,
    "1h": 160,
}

_tv_client = None


def _get_tv() -> object:
    """Lazy-init TvDatafeed singleton (no login required for NSE/BSE free data)."""
    global _tv_client
    if _tv_client is None:
        try:
            from tvDatafeed import TvDatafeed
            _tv_client = TvDatafeed()
            logger.info("TvDatafeed client initialised successfully")
        except Exception as exc:
            logger.warning("TvDatafeed init failed (%s) — will use yfinance only", exc)
    return _tv_client


def _optimize_ohlcv_frame(df: pd.DataFrame) -> pd.DataFrame:
    if df is None or df.empty:
        return pd.DataFrame()

    out = df.copy()
    for col in ("Open", "High", "Low", "Close", "Volume"):
        if col in out.columns:
            out[col] = pd.to_numeric(out[col], errors="coerce")
            if out[col].dtype != np.float32:
                out[col] = out[col].astype("float32")
    return out.dropna()


def _tv_fetch_sync(symbol: str, exchange: str, interval: str, n_bars: int) -> pd.DataFrame:
    """
    Blocking TradingView fetch — always run via asyncio.run_in_executor.
    Returns DataFrame with columns: Open, High, Low, Close, Volume.
    """
    tv = _get_tv()
    if tv is None:
        return pd.DataFrame()
    try:
        from tvDatafeed import Interval as TvInterval
        tv_interval = getattr(TvInterval, TV_INTERVAL_ATTR.get(interval, "in_5_minute"))
        df = tv.get_hist(symbol=symbol, exchange=exchange, interval=tv_interval, n_bars=n_bars)
        if df is None or df.empty:
            return pd.DataFrame()
        df = df.rename(columns={"open": "Open", "high": "High",
                                 "low": "Low",  "close": "Close", "volume": "Volume"})
        available = [c for c in ["Open", "High", "Low", "Close", "Volume"] if c in df.columns]
        return _optimize_ohlcv_frame(df[available])
    except Exception as exc:
        logger.warning("_tv_fetch_sync (%s %s %s): %s", symbol, exchange, interval, exc)
        return pd.DataFrame()


# ── Data Fetching ──────────────────────────────────────────


async def fetch_intraday(
    symbol: str = "^NSEI", interval: str = "15m", period: str = "5d"
) -> pd.DataFrame:
    """
    Download intraday data. Tries TradingView first (more reliable for NSE/BSE),
    falls back to yfinance if tvDatafeed is unavailable or returns no data.
    """
    # ── 1. Try TradingView ────────────────────────────────────────
    if (tv_info := TV_SYMBOL_MAP.get(symbol)) and interval in TV_INTERVAL_ATTR:
        tv_symbol, tv_exchange = tv_info
        n_bars = TV_N_BARS.get(interval, 100)
        loop = asyncio.get_event_loop()
        df_tv = await loop.run_in_executor(
            None, _tv_fetch_sync, tv_symbol, tv_exchange, interval, n_bars
        )
        if not df_tv.empty:
            logger.info("TradingView data OK: %s %s (%d bars)", symbol, interval, len(df_tv))
            return df_tv
        logger.warning("TradingView empty for %s %s, trying yfinance fallback", symbol, interval)

    # ── 2. Fallback: yfinance ───────────────────────────────────
    ticker = yf.Ticker(symbol)
    df = ticker.history(
        period=period,
        interval=interval,
        auto_adjust=False,
        actions=False,
        prepost=False,
    )
    if df.empty:
        raise ValueError(f"No data for '{symbol}' at {interval} from TV or yfinance.")
    if isinstance(df.columns, pd.MultiIndex):
        df.columns = df.columns.get_level_values(0)
    required = ["Open", "High", "Low", "Close", "Volume"]
    for col in required:
        if col not in df.columns:
            raise ValueError(f"Missing column '{col}' in yfinance data.")
    return _optimize_ohlcv_frame(df[required])


async def fetch_multi_timeframe(symbol: str = "^NSEI", include_1m: bool = True) -> dict[str, pd.DataFrame]:
    """
    Fetch 5m, 15m, 1h data for price action analysis.
    Also attempts 1m and derives 3m from it (used for very short-term candles).
    TradingView is primary; yfinance is fallback per interval.
    """
    frames: dict[str, pd.DataFrame] = {}

    # Intervals to fetch: (interval_str, yfinance_period)
    configs = [
        ("5m",  "5d"),
        ("15m", "5d"),
        ("1h",  "5d"),
        ("1m",  "7d"),  # 1m last — least reliable, used only for 3m resample
    ]
    if not include_1m:
        configs = [cfg for cfg in configs if cfg[0] != "1m"]

    for interval, period in configs:
        try:
            df = await fetch_intraday(symbol, interval=interval, period=period)
            max_bars = FRAME_MAX_BARS.get(interval)
            if max_bars and len(df) > max_bars:
                df = df.tail(max_bars).copy()
            frames[interval] = df
            logger.debug("Frame %s: %d bars", interval, len(df))
        except Exception as exc:
            logger.warning("Frame %s failed: %s", interval, exc)
            frames[interval] = pd.DataFrame()

    # Derive 3m from 1m if available (optional — _build_market_data_block prefers 5m)
    if include_1m and not frames.get("1m", pd.DataFrame()).empty:
        df1 = frames["1m"].copy()
        frames["3m"] = df1.resample("3min").agg({
            "Open": "first", "High": "max", "Low": "min",
            "Close": "last", "Volume": "sum",
        }).dropna()
        max_bars_3m = FRAME_MAX_BARS.get("3m")
        if max_bars_3m and len(frames["3m"]) > max_bars_3m:
            frames["3m"] = frames["3m"].tail(max_bars_3m).copy()
    else:
        frames["3m"] = pd.DataFrame()

    return frames


async def fetch_multi_timeframe_at_time(
    symbol: str,
    checkpoint_id: str,  # e.g. "0915", "1130"
    date_str: str,       # e.g. "2026-02-27"
) -> dict[str, pd.DataFrame]:
    """
    Fetch intraday data for a specific date and slice it up to the checkpoint time.
    This ensures the V2 engine sees the market exactly as it was at 9:15, 9:30 etc.
    Returns the same frame dict as fetch_multi_timeframe.
    """
    from datetime import timedelta
    import pytz

    IST = pytz.timezone("Asia/Kolkata")

    # Parse checkpoint time (e.g. "0915" -> hour=9, min=15)
    cp_hour = int(checkpoint_id[:2])
    cp_min = int(checkpoint_id[2:])

    # Build the cutoff datetime in IST
    date = datetime.strptime(date_str, "%Y-%m-%d")
    cutoff_ist = IST.localize(date.replace(hour=cp_hour, minute=cp_min, second=59))

    frames: dict[str, pd.DataFrame] = {}
    configs = [
        ("1m", "7d"),
        ("5m", "5d"),
        ("15m", "5d"),
        ("1h", "5d"),
    ]

    for interval, period in configs:
        try:
            df = await fetch_intraday(symbol, interval=interval, period=period)
            if df.empty:
                frames[interval] = pd.DataFrame()
                continue

            # Ensure index is timezone-aware
            if df.index.tzinfo is None:
                df.index = df.index.tz_localize("UTC").tz_convert(IST)
            else:
                df.index = df.index.tz_convert(IST)

            # Slice: only keep rows UP TO the checkpoint time
            sliced = df[df.index <= cutoff_ist]
            max_bars = FRAME_MAX_BARS.get(interval)
            if max_bars and len(sliced) > max_bars:
                sliced = sliced.tail(max_bars).copy()
            frames[interval] = sliced if not sliced.empty else pd.DataFrame()
        except Exception:
            frames[interval] = pd.DataFrame()

    # Resample 1m → 3m from the sliced data
    if not frames.get("1m", pd.DataFrame()).empty:
        df1 = frames["1m"].copy()
        df3 = df1.resample("3min").agg({
            "Open": "first", "High": "max",
            "Low": "min", "Close": "last", "Volume": "sum",
        }).dropna()
        max_bars_3m = FRAME_MAX_BARS.get("3m")
        if max_bars_3m and len(df3) > max_bars_3m:
            df3 = df3.tail(max_bars_3m).copy()
        frames["3m"] = df3
    else:
        frames["3m"] = pd.DataFrame()

    return frames


# ── Indicator Calculations ─────────────────────────────────


def calc_ema(df: pd.DataFrame, span: int) -> pd.Series:
    """Generic EMA calculation on Close prices."""
    return df["Close"].ewm(span=span, adjust=False).mean()


def calc_ema9(df: pd.DataFrame) -> float:
    return round(float(calc_ema(df, 9).iloc[-1]), 2)


def calc_ema20(df: pd.DataFrame) -> float:
    return round(float(calc_ema(df, 20).iloc[-1]), 2)


def calc_rsi(df: pd.DataFrame, period: int = 14) -> float:
    delta = df["Close"].diff()
    gain = delta.where(delta > 0, 0.0)
    loss = -delta.where(delta < 0, 0.0)
    avg_gain = gain.ewm(alpha=1 / period, min_periods=period, adjust=False).mean()
    avg_loss = loss.ewm(alpha=1 / period, min_periods=period, adjust=False).mean()
    rs = avg_gain / avg_loss
    rsi = 100 - (100 / (1 + rs))
    val = float(rsi.iloc[-1])
    return round(val, 2) if not np.isnan(val) else 50.0


def calc_rsi_series(df: pd.DataFrame, period: int = 14) -> pd.Series:
    """Return full RSI series (not just latest value)."""
    delta = df["Close"].diff()
    gain = delta.where(delta > 0, 0.0)
    loss = -delta.where(delta < 0, 0.0)
    avg_gain = gain.ewm(alpha=1 / period, min_periods=period, adjust=False).mean()
    avg_loss = loss.ewm(alpha=1 / period, min_periods=period, adjust=False).mean()
    rs = avg_gain / avg_loss
    return 100 - (100 / (1 + rs))


def calc_vwap(df: pd.DataFrame) -> float:
    total_volume = df["Volume"].sum()
    if total_volume == 0 or np.isnan(total_volume):
        return round(float(df["Close"].iloc[-1]), 2)
    typical_price = (df["High"] + df["Low"] + df["Close"]) / 3
    cum_tp_vol = (typical_price * df["Volume"]).cumsum()
    cum_vol = df["Volume"].cumsum()
    vwap = cum_tp_vol / cum_vol.replace(0, np.nan)
    result = float(vwap.iloc[-1])
    return round(result, 2) if not np.isnan(result) else round(float(df["Close"].iloc[-1]), 2)


def calc_bollinger(df: pd.DataFrame, period: int = 20, std_dev: float = 2.0) -> tuple[float, float, float]:
    sma = df["Close"].rolling(window=period).mean()
    std = df["Close"].rolling(window=period).std()
    upper = sma + (std_dev * std)
    lower = sma - (std_dev * std)
    u, m, lo = float(upper.iloc[-1]), float(sma.iloc[-1]), float(lower.iloc[-1])
    if np.isnan(u):
        p = float(df["Close"].iloc[-1])
        return (p, p, p)
    return (round(u, 2), round(m, 2), round(lo, 2))


def calc_macd(df: pd.DataFrame) -> tuple[float, float, float]:
    ema12 = df["Close"].ewm(span=12, adjust=False).mean()
    ema26 = df["Close"].ewm(span=26, adjust=False).mean()
    macd_line = ema12 - ema26
    signal_line = macd_line.ewm(span=9, adjust=False).mean()
    histogram = macd_line - signal_line
    ml, sl, h = float(macd_line.iloc[-1]), float(signal_line.iloc[-1]), float(histogram.iloc[-1])
    if np.isnan(ml):
        return (0.0, 0.0, 0.0)
    return (round(ml, 2), round(sl, 2), round(h, 2))


def get_ohlc_series(df: pd.DataFrame, max_points: int = 180) -> list[dict]:
    if max_points > 0 and len(df) > max_points:
        df = df.tail(max_points)
    bars = []
    for idx, row in df.iterrows():
        ts = idx.isoformat() if hasattr(idx, "isoformat") else str(idx)
        bars.append({
            "time": ts,
            "open": round(float(row["Open"]), 2),
            "high": round(float(row["High"]), 2),
            "low": round(float(row["Low"]), 2),
            "close": round(float(row["Close"]), 2),
        })
    return bars


def get_latest_price(df: pd.DataFrame) -> float:
    return round(float(df["Close"].iloc[-1]), 2)


def is_nse_trading_day(day: date_cls) -> bool:
    """Return True only for actual NSE trading days."""
    day_str = day.isoformat()
    if day_str in NSE_HOLIDAYS_2026:
        return False
    if day.weekday() >= 5:
        return False

    try:
        import exchange_calendars as xcals
        import pandas as pd

        cal = xcals.get_calendar("XNSE")
        return bool(cal.is_session(pd.Timestamp(day)))
    except Exception:
        return True


def is_indian_market_open(dt: datetime) -> tuple[bool, str]:
    """
    Check if the Indian stock market (NSE) is currently open.
    Uses a shared trading-day helper with a manual holiday list and, when
    available, exchange_calendars for calendar confirmation.
    Market hours: 09:15 to 15:30 IST.
    """
    ist = pytz.timezone("Asia/Kolkata")
    now_ist = dt.astimezone(ist)
    today = now_ist.date()
    today_str = today.isoformat()

    if today_str in NSE_HOLIDAYS_2026:
        return False, f"Market is CLOSED - NSE Holiday ({today_str})"
    if now_ist.weekday() >= 5:
        return False, f"Market is CLOSED ({now_ist.strftime('%A')})"
    if not is_nse_trading_day(today):
        weekday_name = now_ist.strftime("%A")
        return False, f"Market is CLOSED - {weekday_name} / NSE Holiday"

    market_start = time(9, 15)
    market_end = time(15, 30)
    current_time = now_ist.time()

    if current_time < market_start:
        return False, f"Market Opens at 09:15 AM IST (Current: {current_time.strftime('%H:%M')})"
    if current_time >= market_end:
        return False, f"Market Closed at 03:30 PM IST (Current: {current_time.strftime('%H:%M')})"

    return True, "Market is OPEN"

# Swing / Structure Detection


def detect_swings(df: pd.DataFrame, lookback: int = 3) -> str:
    """
    Detect market structure: Higher Highs + Higher Lows → Bullish, etc.
    Uses last N swing points from the high/low columns.
    Returns: 'Bullish', 'Bearish', or 'Sideways'
    """
    if len(df) < lookback * 3:
        return "Sideways"

    highs = df["High"].rolling(window=lookback * 2 + 1, center=True).max()
    lows = df["Low"].rolling(window=lookback * 2 + 1, center=True).min()

    # Find swing highs (local maxima)
    swing_highs = df["High"][df["High"] == highs].dropna().tail(4)
    # Find swing lows (local minima)
    swing_lows = df["Low"][df["Low"] == lows].dropna().tail(4)

    if len(swing_highs) < 2 or len(swing_lows) < 2:
        return "Sideways"

    # Check Higher Highs + Higher Lows
    hh = all(swing_highs.iloc[i] >= swing_highs.iloc[i - 1] for i in range(1, len(swing_highs)))
    hl = all(swing_lows.iloc[i] >= swing_lows.iloc[i - 1] for i in range(1, len(swing_lows)))

    # Check Lower Highs + Lower Lows
    lh = all(swing_highs.iloc[i] <= swing_highs.iloc[i - 1] for i in range(1, len(swing_highs)))
    ll = all(swing_lows.iloc[i] <= swing_lows.iloc[i - 1] for i in range(1, len(swing_lows)))

    if hh and hl:
        return "Bullish"
    elif lh and ll:
        return "Bearish"
    return "Sideways"


def detect_divergence(df: pd.DataFrame, lookback: int = 20) -> dict:
    """
    Detect RSI divergence vs price.
    Returns: { 'bearish_div': bool, 'bullish_div': bool }
    """
    result = {"bearish_div": False, "bullish_div": False}
    if len(df) < lookback + 5:
        return result

    recent = df.tail(lookback)
    rsi = calc_rsi_series(df).tail(lookback)

    # Split into two halves for comparison
    mid = len(recent) // 2
    first_half = recent.iloc[:mid]
    second_half = recent.iloc[mid:]
    rsi_first = rsi.iloc[:mid]
    rsi_second = rsi.iloc[mid:]

    # Bearish divergence: Price HH but RSI LH
    price_hh = second_half["High"].max() > first_half["High"].max()
    rsi_lh = rsi_second.max() < rsi_first.max()
    if price_hh and rsi_lh:
        result["bearish_div"] = True

    # Bullish divergence: Price LL but RSI HL
    price_ll = second_half["Low"].min() < first_half["Low"].min()
    rsi_hl = rsi_second.min() > rsi_first.min()
    if price_ll and rsi_hl:
        result["bullish_div"] = True

    return result


def check_volume_spike(df: pd.DataFrame, lookback: int = 5) -> bool:
    """Check if latest candle volume > average of last N candles."""
    if len(df) < lookback + 1:
        return False
    avg_vol = df["Volume"].iloc[-(lookback + 1):-1].mean()
    latest_vol = df["Volume"].iloc[-1]
    if avg_vol == 0:
        return False
    return float(latest_vol) > float(avg_vol) * 1.3


def get_range_context(df: pd.DataFrame, lookback: int = 3) -> str:
    """
    Assess range context from last N candles.
    Heavy overlap → LOW, clean expansion → HIGH, else NORMAL.
    """
    if len(df) < lookback:
        return "NORMAL"

    last_candles = df.tail(lookback)
    bodies = abs(last_candles["Close"] - last_candles["Open"])
    ranges = last_candles["High"] - last_candles["Low"]

    avg_body = bodies.mean()
    avg_range = ranges.mean()

    if avg_range == 0:
        return "LOW"

    body_ratio = avg_body / avg_range

    # Heavy overlap = small bodies relative to range
    if body_ratio < 0.3:
        return "LOW"
    elif body_ratio > 0.6:
        return "HIGH"
    return "NORMAL"


def get_market_levels(df_daily_or_15m: pd.DataFrame) -> dict:
    """
    Extract key levels: Yesterday High/Low, Today Open, First 15m High/Low.
    """
    levels = {}
    if df_daily_or_15m.empty:
        return levels

    # Get today's date
    now = pd.Timestamp.now(tz=df_daily_or_15m.index.tz) if df_daily_or_15m.index.tz else pd.Timestamp.now()
    today = now.normalize()

    today_data = df_daily_or_15m[df_daily_or_15m.index >= today]
    yesterday_data = df_daily_or_15m[df_daily_or_15m.index < today]

    if not yesterday_data.empty:
        levels["yesterday_high"] = round(float(yesterday_data["High"].max()), 2)
        levels["yesterday_low"] = round(float(yesterday_data["Low"].min()), 2)

    if not today_data.empty:
        levels["today_open"] = round(float(today_data["Open"].iloc[0]), 2)
        levels["first_15m_high"] = round(float(today_data["High"].iloc[0]), 2)
        levels["first_15m_low"] = round(float(today_data["Low"].iloc[0]), 2)

    return levels
