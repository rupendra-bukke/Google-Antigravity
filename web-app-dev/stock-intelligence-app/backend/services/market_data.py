"""Market data service — multi-timeframe fetching + technical indicator calculations."""

import yfinance as yf
import pandas as pd
import numpy as np
from datetime import datetime, timezone


# ── Data Fetching ──────────────────────────────────────────


async def fetch_intraday(symbol: str = "^NSEI", interval: str = "15m", period: str = "5d") -> pd.DataFrame:
    """Download intraday data at the given interval."""
    ticker = yf.Ticker(symbol)
    df = ticker.history(period=period, interval=interval)

    if df.empty:
        raise ValueError(f"No data returned for '{symbol}' at {interval}.")

    if isinstance(df.columns, pd.MultiIndex):
        df.columns = df.columns.get_level_values(0)

    required = ["Open", "High", "Low", "Close", "Volume"]
    for col in required:
        if col not in df.columns:
            raise ValueError(f"Missing column '{col}' in yfinance data.")

    return df[required].dropna()


async def fetch_multi_timeframe(symbol: str = "^NSEI") -> dict[str, pd.DataFrame]:
    """
    Fetch 1m, 5m, 15m, 1h data and resample 1m → 3m.
    Returns dict keyed by interval string.
    """
    frames: dict[str, pd.DataFrame] = {}

    # Fetch available intervals
    configs = [
        ("1m", "7d"),
        ("5m", "5d"),
        ("15m", "5d"),
        ("1h", "5d"),
    ]

    for interval, period in configs:
        try:
            df = await fetch_intraday(symbol, interval=interval, period=period)
            frames[interval] = df
        except Exception:
            frames[interval] = pd.DataFrame()

    # Resample 1m → 3m
    if not frames["1m"].empty:
        df1 = frames["1m"].copy()
        df3 = df1.resample("3min").agg({
            "Open": "first",
            "High": "max",
            "Low": "min",
            "Close": "last",
            "Volume": "sum",
        }).dropna()
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


def get_ohlc_series(df: pd.DataFrame) -> list[dict]:
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


# ── Swing / Structure Detection ────────────────────────────


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
