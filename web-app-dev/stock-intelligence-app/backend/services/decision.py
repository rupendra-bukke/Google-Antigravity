"""Intraday decision engine — rule-based BUY / SELL / HOLD logic with enriched reasoning."""


def make_decision(
    price: float,
    ema20: float,
    rsi: float,
    vwap: float,
    bollinger: tuple[float, float, float] | None = None,
    macd: tuple[float, float, float] | None = None,
) -> tuple[str, list[str]]:
    """
    Evaluate intraday indicators and return a (decision, reasoning) tuple.

    Core Rules (unchanged)
    ----------------------
    BUY  — price > EMA20  AND  RSI < 60  AND  price > VWAP
    SELL — price < EMA20  AND  RSI > 70  AND  price < VWAP
    HOLD — everything else

    Enrichment: Bollinger Bands + MACD add informational context to reasoning.
    """
    reasons: list[str] = []

    # --- trend checks ---
    above_ema = price > ema20
    reasons.append(f"Price {'above' if above_ema else 'below'} EMA20 ({ema20})")

    # --- momentum checks ---
    rsi_bullish = rsi < 60
    rsi_bearish = rsi > 70
    if rsi_bullish:
        reasons.append(f"RSI ({rsi}) indicates room to move up")
    elif rsi_bearish:
        reasons.append(f"RSI ({rsi}) indicates overbought conditions")
    else:
        reasons.append(f"RSI ({rsi}) is in neutral zone (60-70)")

    # --- value checks ---
    above_vwap = price > vwap
    reasons.append(f"Price {'above' if above_vwap else 'below'} VWAP ({vwap})")

    # --- Bollinger Bands context ---
    if bollinger:
        bb_upper, bb_middle, bb_lower = bollinger
        if price >= bb_upper:
            reasons.append(f"Price at/above upper Bollinger Band ({bb_upper}) — potential resistance")
        elif price <= bb_lower:
            reasons.append(f"Price at/below lower Bollinger Band ({bb_lower}) — potential support")
        else:
            band_pos = ((price - bb_lower) / (bb_upper - bb_lower) * 100) if bb_upper != bb_lower else 50
            reasons.append(f"Price at {band_pos:.0f}% within Bollinger Bands ({bb_lower} – {bb_upper})")

    # --- MACD context ---
    if macd:
        macd_line, signal_line, histogram = macd
        if macd_line > signal_line:
            reasons.append(f"MACD ({macd_line}) above signal ({signal_line}) — bullish momentum")
        else:
            reasons.append(f"MACD ({macd_line}) below signal ({signal_line}) — bearish momentum")

    # --- core decision (unchanged thresholds) ---
    below_ema = price < ema20
    below_vwap = price < vwap

    if above_ema and rsi_bullish and above_vwap:
        return "BUY", reasons
    elif below_ema and rsi_bearish and below_vwap:
        return "SELL", reasons
    else:
        reasons.append("Conditions do not strongly favour BUY or SELL")
        return "HOLD", reasons
