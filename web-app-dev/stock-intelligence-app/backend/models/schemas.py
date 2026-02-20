"""Pydantic response models for the analyze endpoints."""

from pydantic import BaseModel
from datetime import datetime
from typing import Any


# ── Basic Indicator Models (existing endpoint) ──


class BollingerData(BaseModel):
    upper: float
    middle: float
    lower: float


class MacdData(BaseModel):
    macd_line: float
    signal_line: float
    histogram: float


class OhlcBar(BaseModel):
    time: str
    open: float
    high: float
    low: float
    close: float


class IndicatorData(BaseModel):
    ema20: float
    rsi14: float
    vwap: float
    bollinger: BollingerData
    macd: MacdData


class AnalyzeResponse(BaseModel):
    symbol: str
    price: float
    indicators: IndicatorData
    decision: str
    reasoning: list[str]
    timestamp: datetime
    candles: list[OhlcBar]


# ── Advanced Analysis Models (v2 endpoint) ──


class OptionStrikeData(BaseModel):
    strike: int
    strike_label: str          # "ATM" or "ITM"
    option_type: str           # "CE" or "PE"
    est_premium: int
    sl_points: int
    target_points: int
    premium_valid: bool


class StepDetail(BaseModel):
    name: str
    details: list[str]


class AdvancedAnalysis(BaseModel):
    prompt_version: int
    date_time: str
    index: str
    spot_price: float

    scalp_signal: str          # 🟢 BUY/CE | 🔴 SELL/PE | ⚪ NO TRADE
    three_min_confirm: str     # 🟢 GREEN | 🔴 RED | ⚪ NEUTRAL
    htf_trend: str             # 🟢 Bullish | 🔴 Bearish | ⚪ Sideways
    trend_direction: str       # e.g., "⚪ Sideways → 🟢 Bullish"

    option_strike: OptionStrikeData | None
    execute: str               # Strong | Weak | NO TRADE
    execute_reason: str

    steps_detail: dict[str, Any]  # Full reasoning per step
