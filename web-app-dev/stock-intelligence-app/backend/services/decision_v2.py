"""
Advanced Decision Engine v2 — Multi-timeframe scalping analysis.

Six-step pipeline:
  0.  HTF Trend Filter (15m + 1h)
  0.5 Reversal / Exhaustion Filter
  1.  Market Structure + Range Context
  2.  Scalp Analysis (1m/3m/5m)
  3.  3-Min Confirmation
  4.  Option Strike Selection
  5.  Risk & Trade Management

PLUS:
  6.  10–20 Min Momentum Forecast
"""

import math
import pandas as pd
from datetime import datetime, timezone, timedelta

from services.market_data import (
    calc_ema,
    calc_ema9,
    calc_ema20,
    calc_rsi,
    calc_rsi_series,
    calc_vwap,
    calc_macd,
    detect_swings,
    detect_divergence,
    check_volume_spike,
    get_range_context,
    get_market_levels,
    get_latest_price,
)

IST = timezone(timedelta(hours=5, minutes=30))

SYMBOL_NAMES = {
    "^NSEI": "Nifty 50",
    "^NSEBANK": "Bank Nifty",
    "^BSESN": "Sensex",
}

# ── Step 0: HTF Trend Filter ──────────────────────────────


def htf_trend_filter(df_15m: pd.DataFrame, df_1h: pd.DataFrame) -> dict:
    """
    Check 15m & 1h charts for trend alignment.
    Both must agree for directional bias.
    """
    results = {"signal": "⚪ Sideways", "details": []}

    for label, df in [("15m", df_15m), ("1h", df_1h)]:
        if df.empty or len(df) < 20:
            results["details"].append(f"{label}: Insufficient data")
            continue

        price = get_latest_price(df)
        ema20 = calc_ema20(df)
        vwap = calc_vwap(df)
        rsi = calc_rsi(df)
        structure = detect_swings(df)

        # RSI bias
        if rsi > 55:
            rsi_bias = "Bullish"
        elif rsi < 45:
            rsi_bias = "Bearish"
        else:
            rsi_bias = "Sideways"

        # Composite
        bullish_count = sum([
            price > ema20,
            price > vwap,
            rsi_bias == "Bullish",
            structure == "Bullish",
        ])
        bearish_count = sum([
            price < ema20,
            price < vwap,
            rsi_bias == "Bearish",
            structure == "Bearish",
        ])

        if bullish_count >= 3:
            tf_trend = "Bullish"
        elif bearish_count >= 3:
            tf_trend = "Bearish"
        else:
            tf_trend = "Sideways"

        results[f"{label}_trend"] = tf_trend
        results["details"].append(
            f"{label}: {tf_trend} (Price {'>' if price > ema20 else '<'} EMA20, "
            f"RSI {rsi} [{rsi_bias}], Structure: {structure})"
        )

    t15 = results.get("15m_trend", "Sideways")
    t1h = results.get("1h_trend", "Sideways")

    if t15 == "Bullish" and t1h == "Bullish":
        results["signal"] = "🟢 Bullish"
    elif t15 == "Bearish" and t1h == "Bearish":
        results["signal"] = "🔴 Bearish"
    else:
        results["signal"] = "⚪ Sideways"

    return results


# ── Step 0.5: Reversal / Exhaustion Filter ─────────────────


def reversal_filter(df_5m: pd.DataFrame, df_15m: pd.DataFrame, now: datetime) -> dict:
    """
    Check for exhaustion signals that should block entries.
    """
    result = {
        "blocked_longs": False,
        "blocked_shorts": False,
        "reasons": [],
        "force_no_trade": False,
    }

    ist_now = now.astimezone(IST)
    hour_min = ist_now.hour * 60 + ist_now.minute

    for label, df in [("5m", df_5m), ("15m", df_15m)]:
        if df.empty or len(df) < 20:
            continue

        div = detect_divergence(df)
        rsi = calc_rsi(df)
        vol_spike = check_volume_spike(df)

        # Block longs
        if div["bearish_div"]:
            result["blocked_longs"] = True
            result["reasons"].append(f"{label}: Bearish RSI divergence detected")

        if vol_spike and df["Close"].iloc[-1] < df["Open"].iloc[-1]:
            # Long upper wick rejection + volume spike
            wick = df["High"].iloc[-1] - max(df["Open"].iloc[-1], df["Close"].iloc[-1])
            body = abs(df["Close"].iloc[-1] - df["Open"].iloc[-1])
            if body > 0 and wick / body > 1.5:
                result["blocked_longs"] = True
                result["reasons"].append(f"{label}: Upper wick rejection with volume spike")

        # After 11:30 AM: RSI > 70 and flattening
        if hour_min >= 690 and rsi > 70:  # 11:30 = 690 min
            result["blocked_longs"] = True
            result["reasons"].append(f"{label}: RSI {rsi} > 70 after 11:30 AM — exhaustion risk")

        # Block shorts
        if div["bullish_div"]:
            result["blocked_shorts"] = True
            result["reasons"].append(f"{label}: Bullish RSI divergence detected")

        # After 2:00 PM: RSI < 30 and turning up
        if hour_min >= 840 and rsi < 30:  # 14:00 = 840 min
            result["blocked_shorts"] = True
            result["reasons"].append(f"{label}: RSI {rsi} < 30 after 2:00 PM — reversal risk")

    if result["blocked_longs"] and result["blocked_shorts"]:
        result["force_no_trade"] = True
        result["reasons"].append("Both directions blocked → FORCE NO TRADE")

    return result


# ── Step 1: Market Structure + Range Context ───────────────


def market_structure_analysis(df_15m: pd.DataFrame) -> dict:
    """Mark key levels and assess range."""
    result = {
        "levels": {},
        "range_context": "NORMAL",
        "structure": "Sideways",
        "details": [],
    }

    if df_15m.empty:
        return result

    result["levels"] = get_market_levels(df_15m)
    result["range_context"] = get_range_context(df_15m)
    result["structure"] = detect_swings(df_15m)

    lvl = result["levels"]
    result["details"].append(f"Range: {result['range_context']}")
    if "yesterday_high" in lvl:
        result["details"].append(f"Yesterday: {lvl['yesterday_low']} – {lvl['yesterday_high']}")
    if "today_open" in lvl:
        result["details"].append(f"Today Open: {lvl['today_open']}")
    if "first_15m_high" in lvl:
        result["details"].append(f"First 15m: {lvl['first_15m_low']} – {lvl['first_15m_high']}")

    return result


# ── Step 2: Scalp Analysis ─────────────────────────────────


def scalp_analysis(
    df_1m: pd.DataFrame,
    df_3m: pd.DataFrame,
    df_5m: pd.DataFrame,
) -> dict:
    """
    Analyze 1m/3m/5m for scalp signals.
    """
    result = {"signal": "⚪ NO TRADE", "details": []}
    bullish_score = 0
    bearish_score = 0

    for label, df in [("1m", df_1m), ("3m", df_3m), ("5m", df_5m)]:
        if df.empty or len(df) < 20:
            result["details"].append(f"{label}: Insufficient data")
            continue

        price = get_latest_price(df)
        ema9 = calc_ema9(df)
        ema20 = calc_ema20(df)
        vwap = calc_vwap(df)
        rsi = calc_rsi(df)
        macd_line, signal_line, hist = calc_macd(df)
        vol_spike = check_volume_spike(df)

        # Long conditions
        long_conds = [
            price > vwap,
            price > ema20,
            ema9 > ema20,
            50 <= rsi <= 70,
            hist > 0,
        ]
        short_conds = [
            price < vwap,
            price < ema20,
            ema9 < ema20,
            30 <= rsi <= 50,
            hist < 0,
        ]

        long_score = sum(long_conds)
        short_score = sum(short_conds)

        if long_score >= 4:
            bullish_score += 1
            result["details"].append(f"{label}: 🟢 Bullish ({long_score}/5 conditions)")
        elif short_score >= 4:
            bearish_score += 1
            result["details"].append(f"{label}: 🔴 Bearish ({short_score}/5 conditions)")
        else:
            result["details"].append(f"{label}: ⚪ Neutral (L:{long_score} S:{short_score})")

    if bullish_score >= 2:
        result["signal"] = "🟢 BUY/CE"
    elif bearish_score >= 2:
        result["signal"] = "🔴 SELL/PE"
    else:
        result["signal"] = "⚪ NO TRADE"

    return result


# ── Step 3: 3-Min Confirmation ─────────────────────────────


def three_min_confirm(df_3m: pd.DataFrame, df_5m: pd.DataFrame) -> dict:
    """3m + 5m confirmation check."""
    result = {"signal": "⚪ NEUTRAL", "details": []}

    checks = {"3m": df_3m, "5m": df_5m}
    green_count = 0
    red_count = 0

    for label, df in checks.items():
        if df.empty or len(df) < 20:
            result["details"].append(f"{label}: Insufficient data")
            continue

        price = get_latest_price(df)
        ema9 = calc_ema9(df)
        ema20 = calc_ema20(df)
        vwap = calc_vwap(df)
        rsi = calc_rsi(df)

        green_conds = [
            price > ema20,
            price > vwap,
            ema9 > ema20,
            rsi > (55 if label == "3m" else 50),
        ]
        red_conds = [
            price < ema20,
            price < vwap,
            ema9 < ema20,
            rsi < (45 if label == "3m" else 50),
        ]

        g = sum(green_conds)
        r = sum(red_conds)

        if g >= 3:
            green_count += 1
            result["details"].append(f"{label}: 🟢 GREEN ({g}/4)")
        elif r >= 3:
            red_count += 1
            result["details"].append(f"{label}: 🔴 RED ({r}/4)")
        else:
            result["details"].append(f"{label}: ⚪ NEUTRAL (G:{g} R:{r})")

    if green_count == 2:
        result["signal"] = "🟢 GREEN"
    elif red_count == 2:
        result["signal"] = "🔴 RED"
    else:
        result["signal"] = "⚪ NEUTRAL"

    return result


# ── Step 4: Option Strike Selection ────────────────────────


def option_strike_selection(
    spot_price: float,
    direction: str,  # "CE" or "PE" or "NONE"
    setup_strength: str,  # "STRONG", "NORMAL", "WEAK"
    range_context: str,  # "LOW", "NORMAL", "HIGH"
) -> dict | None:
    """
    Compute ATM strike and recommendations.
    ATM = nearest 50-point strike.
    """
    if direction == "NONE" or setup_strength == "WEAK":
        return None

    # ATM = nearest 50
    atm = round(spot_price / 50) * 50

    # Strike offset
    if setup_strength == "STRONG" and range_context in ("NORMAL", "HIGH"):
        strike = atm  # ATM
        strike_label = "ATM"
    else:
        # ITM by 50 points
        if direction == "CE":
            strike = atm - 50
        else:
            strike = atm + 50
        strike_label = "ITM"

    # Estimated premium (simplified — not live data)
    # Rough estimate: ~0.4-0.6% of spot for ATM weekly
    distance = abs(spot_price - strike)
    if spot_price > 0:
        base_premium = spot_price * 0.005  # ~0.5% of spot
        distance_adj = max(0, (distance / spot_price) * spot_price * 0.3)
        est_premium = round(base_premium + distance_adj, 0)
    else:
        est_premium = 0
    
    est_premium = max(80, min(est_premium, 300))  # Clamp to ₹80–300

    # SL and target
    sl_points = round(est_premium * 0.28, 0)  # ~28% of premium
    target_points = round(sl_points * 2, 0)   # 1:2 RR minimum

    return {
        "strike": int(strike),
        "strike_label": strike_label,
        "option_type": direction,
        "est_premium": int(est_premium),
        "sl_points": int(sl_points),
        "target_points": int(target_points),
        "premium_valid": 80 <= est_premium <= 250,
    }


# ── Step 5: Risk & Trade Management ───────────────────────


def risk_management(
    htf: dict,
    reversal: dict,
    scalp: dict,
    confirm: dict,
    option: dict | None,
    now: datetime,
) -> dict:
    """
    Final execute decision with risk checks.
    """
    ist_now = now.astimezone(IST)
    hour_min = ist_now.hour * 60 + ist_now.minute
    result = {"execute": "NO TRADE", "reason": "", "skip_reasons": []}

    # Time checks
    if hour_min >= 870:  # After 2:30 PM
        result["skip_reasons"].append("After 2:30 PM — no new trades")

    # HTF opposite
    if "Sideways" in htf["signal"]:
        result["skip_reasons"].append("HTF sideways — no directional bias")

    # Reversal filter
    if reversal["force_no_trade"]:
        result["skip_reasons"].append("Reversal filter: both directions blocked")
    elif reversal["blocked_longs"] and "BUY" in scalp["signal"]:
        result["skip_reasons"].append("Reversal filter: longs blocked")
    elif reversal["blocked_shorts"] and "SELL" in scalp["signal"]:
        result["skip_reasons"].append("Reversal filter: shorts blocked")

    # 3-min non-confirmation
    if "NEUTRAL" in confirm["signal"]:
        result["skip_reasons"].append("3-min confirmation: NEUTRAL — no clear signal")

    # Premium filter
    if option and not option.get("premium_valid", True):
        result["skip_reasons"].append(f"Premium ₹{option['est_premium']} outside ₹80–₹250 range")

    # Determine strength
    if result["skip_reasons"]:
        result["execute"] = "NO TRADE"
        result["reason"] = " | ".join(result["skip_reasons"])
    else:
        # Check alignment strength
        htf_aligned = "Bullish" in htf["signal"] or "Bearish" in htf["signal"]
        confirm_aligned = "GREEN" in confirm["signal"] or "RED" in confirm["signal"]
        scalp_aligned = "BUY" in scalp["signal"] or "SELL" in scalp["signal"]
        no_reversal = not reversal["blocked_longs"] and not reversal["blocked_shorts"]

        if htf_aligned and confirm_aligned and scalp_aligned and no_reversal:
            result["execute"] = "Strong"
            result["reason"] = "HTF aligned + 3-min confirmed + no reversal filter"
        elif htf_aligned and confirm_aligned:
            result["execute"] = "Weak"
            result["reason"] = "Aligned but scalp not fully confirmed"
        else:
            result["execute"] = "NO TRADE"
            result["reason"] = "Insufficient alignment across timeframes"

    return result


# ── Step 6: 10–20 Min Momentum Forecast ────────────────────────────────────


def momentum_forecast(
    df_1m: pd.DataFrame,
    df_3m: pd.DataFrame,
    df_5m: pd.DataFrame,
) -> dict:
    """
    Predict the likely price direction over the next 10–20 minutes.
    Uses rate-of-change, RSI trajectory, MACD histogram slope, and volume.
    Returns: direction ('UP', 'DOWN', 'FLAT'), confidence (0–100), and reasons.
    """
    up_score = 0
    dn_score = 0
    reasons = []

    for label, df, weight in [("1m", df_1m, 1), ("3m", df_3m, 2), ("5m", df_5m, 2)]:
        if df is None or df.empty or len(df) < 10:
            continue

        close = df["Close"]
        volume = df["Volume"] if "Volume" in df.columns else None

        # 1. Rate of Change — last 5 candles vs previous 5
        roc_now = close.iloc[-1] / close.iloc[-6] - 1 if len(close) >= 6 else 0
        if roc_now > 0.0015:
            up_score += weight
            reasons.append(f"{label}: ROC +{roc_now*100:.2f}% → rising")
        elif roc_now < -0.0015:
            dn_score += weight
            reasons.append(f"{label}: ROC {roc_now*100:.2f}% → falling")

        # 2. RSI trajectory (last 3 readings)
        rsi_series = calc_rsi_series(df)
        if isinstance(rsi_series, pd.Series) and len(rsi_series) >= 3:
            rsi_now = rsi_series.iloc[-1]
            rsi_prev = rsi_series.iloc[-3]
            if rsi_now > rsi_prev + 3 and rsi_now < 75:
                up_score += weight
                reasons.append(f"{label}: RSI rising {rsi_prev:.1f}→{rsi_now:.1f}")
            elif rsi_now < rsi_prev - 3 and rsi_now > 25:
                dn_score += weight
                reasons.append(f"{label}: RSI falling {rsi_prev:.1f}→{rsi_now:.1f}")

        # 3. MACD histogram slope (expanding or contracting)
        # calc_macd returns scalar floats — compute histogram Series inline
        try:
            ema12 = close.ewm(span=12, adjust=False).mean()
            ema26 = close.ewm(span=26, adjust=False).mean()
            hist_series = (ema12 - ema26) - (ema12 - ema26).ewm(span=9, adjust=False).mean()
            if isinstance(hist_series, pd.Series) and len(hist_series) >= 3:
                h_now = hist_series.iloc[-1]
                h_prev = hist_series.iloc[-3]
                if h_now > h_prev and h_now > 0:
                    up_score += weight
                    reasons.append(f"{label}: MACD hist expanding bullish")
                elif h_now < h_prev and h_now < 0:
                    dn_score += weight
                    reasons.append(f"{label}: MACD hist expanding bearish")
        except Exception:
            pass  # Skip MACD if insufficient data

        # 4. Volume surging on green candles (bullish) or red candles (bearish)
        if volume is not None and len(df) >= 3:
            avg_vol = volume.iloc[-6:-1].mean() if len(volume) >= 6 else volume.mean()
            last_vol = volume.iloc[-1]
            is_green = close.iloc[-1] > df["Open"].iloc[-1]
            if last_vol > avg_vol * 1.3:
                if is_green:
                    up_score += weight
                    reasons.append(f"{label}: Volume surge on green candle")
                else:
                    dn_score += weight
                    reasons.append(f"{label}: Volume surge on red candle")

    total = up_score + dn_score
    if total == 0:
        return {"direction": "FLAT", "confidence": 40, "reasons": ["Insufficient momentum data"]}

    if up_score > dn_score:
        confidence = min(int((up_score / total) * 100), 95)
        arrow = "📈 UP"
        direction = "UP"
    elif dn_score > up_score:
        confidence = min(int((dn_score / total) * 100), 95)
        arrow = "📉 DOWN"
        direction = "DOWN"
    else:
        arrow = "➡️ FLAT"
        direction = "FLAT"
        confidence = 50

    return {
        "direction": direction,
        "arrow": arrow,
        "confidence": confidence,
        "reasons": reasons[:4],  # top 4 reasons only
    }


# ── Master Pipeline ────────────────────────────────────────


def run_advanced_analysis(
    frames: dict[str, pd.DataFrame],
    symbol: str,
    now: datetime,
) -> dict:
    """
    Run the full 6-step analysis pipeline.
    Returns the structured result matching the user's output format.
    """
    df_1m = frames.get("1m", pd.DataFrame())
    df_3m = frames.get("3m", pd.DataFrame())
    df_5m = frames.get("5m", pd.DataFrame())
    df_15m = frames.get("15m", pd.DataFrame())
    df_1h = frames.get("1h", pd.DataFrame())

    # Get spot price from highest resolution available
    spot = 0.0
    for tf in ["1m", "3m", "5m", "15m", "1h"]:
        if not frames.get(tf, pd.DataFrame()).empty:
            spot = get_latest_price(frames[tf])
            break

    ist_now = now.astimezone(IST)

    # Step 0: HTF Trend Filter
    htf = htf_trend_filter(df_15m, df_1h)

    # Step 0.5: Reversal Filter
    reversal = reversal_filter(df_5m, df_15m, now)

    # Step 1: Market Structure
    mkt = market_structure_analysis(df_15m)

    # Step 2: Scalp Analysis
    scalp = scalp_analysis(df_1m, df_3m, df_5m)

    # Step 3: 3-Min Confirmation
    confirm = three_min_confirm(df_3m, df_5m)

    # Determine direction
    if "BUY" in scalp["signal"]:
        direction = "CE"
    elif "SELL" in scalp["signal"]:
        direction = "PE"
    else:
        direction = "NONE"

    # Setup strength
    htf_aligned = "Bullish" in htf["signal"] or "Bearish" in htf["signal"]
    confirm_ok = "GREEN" in confirm["signal"] or "RED" in confirm["signal"]
    no_reversal = not reversal["force_no_trade"]

    if htf_aligned and confirm_ok and no_reversal:
        setup_strength = "STRONG"
    elif htf_aligned and confirm_ok:
        setup_strength = "NORMAL"
    else:
        setup_strength = "WEAK"

    # Step 4: Option Strike
    option = option_strike_selection(spot, direction, setup_strength, mkt["range_context"])

    # Step 5: Risk Management
    risk = risk_management(htf, reversal, scalp, confirm, option, now)

    # Step 6: 10–20 Min Momentum Forecast
    forecast = momentum_forecast(df_1m, df_3m, df_5m)

    # Trend direction narrative
    htf_core = htf["signal"].split(" ", 1)[-1] if " " in htf["signal"] else htf["signal"]
    if "Sideways" in htf["signal"]:
        if "BUY" in scalp["signal"]:
            trend_dir = f"⚪ Sideways → 🟢 Bullish"
        elif "SELL" in scalp["signal"]:
            trend_dir = f"⚪ Sideways → 🔴 Bearish"
        else:
            trend_dir = f"⚪ Sideways"
    else:
        trend_dir = htf["signal"]

    # Format index name
    index_name = SYMBOL_NAMES.get(symbol, symbol)

    return {
        "prompt_version": 2,
        "date_time": ist_now.strftime("%d %b %Y, %I:%M %p IST"),
        "index": index_name,
        "spot_price": spot,

        "scalp_signal": scalp["signal"],
        "three_min_confirm": confirm["signal"],
        "htf_trend": htf["signal"],
        "trend_direction": trend_dir,

        "option_strike": option,
        "execute": risk["execute"],
        "execute_reason": risk["reason"],

        # Step 6: Forward prediction
        "forecast": forecast,

        "steps_detail": {
            "htf": htf,
            "reversal": reversal,
            "market_structure": mkt,
            "scalp": scalp,
            "confirm": confirm,
            "risk": risk,
        },
    }
