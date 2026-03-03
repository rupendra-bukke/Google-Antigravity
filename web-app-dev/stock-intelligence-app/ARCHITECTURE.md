# Trade-Craft — Architecture & Code Flow Reference

> **Last Updated:** 2026-03-03 (Holi Holiday Fix Session)
> **App:** Trade-Craft | RB Stock Intelligence
> **Stack:** Next.js (Vercel) + FastAPI (Render) + Redis (Upstash) + Gemini AI

---

## Table of Contents

1. [System Architecture Overview](#1-system-architecture-overview)
2. [Section 1 — Header, Clock & Index Selector](#2-section-1--header-clock--index-selector)
3. [Section 2 — Market Status Banner](#3-section-2--market-status-banner)
4. [Section 3 — Stock Header (Live Price)](#4-section-3--stock-header-live-price)
5. [Section 4 — AI Price Action Analysis (Gemini)](#5-section-4--ai-price-action-analysis-gemini)
6. [Section 5 — Nifty 50 Market Timeline (Checkpoints)](#6-section-5--nifty-50-market-timeline-checkpoints)
7. [Section 6 — Technical Indicators Strip](#7-section-6--technical-indicators-strip)
8. [Section 7 — Intraday Decision Badge](#8-section-7--intraday-decision-badge)
9. [Data Sources & Priority](#9-data-sources--priority)
10. [Caching Strategy](#10-caching-strategy)
11. [Gemini AI Quota Management](#11-gemini-ai-quota-management)
12. [NSE Holiday Detection](#12-nse-holiday-detection)
13. [Bug Fixes Applied](#13-bug-fixes-applied)
14. [Environment Variables](#14-environment-variables)
15. [File Map](#15-file-map)

---

## 1. System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│  FRONTEND (Vercel — Next.js)                                    │
│                                                                 │
│  page.tsx ──→ /api/v1/analyze        → StockHeader, Indicators  │
│           ──→ /api/v1/advanced-analyze → Advanced Decision       │
│  AIDecision.tsx ──→ /api/v1/ai-decision → AI Price Action (S4)  │
│  CheckpointBoard.tsx ──→ /api/v1/checkpoints → Timeline (S5)    │
└──────────────────────────┬──────────────────────────────────────┘
                           │ HTTPS (proxied via next.config.mjs)
┌──────────────────────────▼──────────────────────────────────────┐
│  BACKEND (Render — FastAPI + Uvicorn)                           │
│                                                                 │
│  routers/analyze.py      → Basic + Advanced + AI Decision       │
│  routers/checkpoints.py  → Checkpoint CRUD + Catch-up           │
│  services/market_data.py → tvDatafeed (primary) / yfinance      │
│  services/ai_decision.py → Gemini API calls + JSON parsing      │
│  services/decision_v2.py → V2 Decision Engine (6-step pipeline) │
│  services/checkpoint_store.py → Redis read/write                │
│  main.py                 → APScheduler (checkpoint triggers)    │
└──────────────────────────┬──────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│  EXTERNAL SERVICES                                              │
│                                                                 │
│  tvDatafeed  → NSE real-time candles (NIFTY, BANKNIFTY, SENSEX) │
│  yfinance    → Fallback data source (^NSEI, ^NSEBANK, ^BSESN)  │
│  Gemini API  → AI analysis (gemini-2.5-flash)                   │
│  Upstash     → Redis cache (checkpoints, AI signal cache)       │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Section 1 — Header, Clock & Index Selector

| Item | File | Description |
|------|------|-------------|
| App Logo & Title | `Sidebar.tsx` | "Trade-Craft" branding |
| IST Clock | `ISTClock.tsx` | Live digital clock in IST timezone |
| Index Selector | `IndexSelector.tsx` | Tabs: NIFTY 50, Bank NIFTY, SENSEX |

**Data Flow:** Purely frontend — no API calls. Clock updates every second via `setInterval`.

---

## 3. Section 2 — Market Status Banner

| | Details |
|---|---|
| **Frontend Check** | `getNseMarketStatus()` in `page.tsx` |
| **Backend Check** | `is_indian_market_open()` in `market_data.py` |
| **Priority** | Backend message preferred (has holiday names), frontend as fallback |

**Code Flow:**
```
page.tsx renders → getNseMarketStatus() runs client-side
  → Checks NSE_HOLIDAYS_2026 set (Holi, Diwali, Republic Day, etc.)
  → Checks weekday (Sat/Sun)
  → Checks time (9:15–15:30 IST)
  → Returns { isOpen, message }

Backend's advanced-analyze also returns is_market_open + market_message
  → Frontend uses backend's message if available (may include "NSE Holiday" detail)
```

**Holiday List (2026):**
| Date | Holiday |
|------|---------|
| Jan 26 | Republic Day |
| Mar 3 | Holi (Dhuleti) |
| Mar 4 | Holi 2nd day |
| Apr 2 | Good Friday / Ram Navami |
| Apr 14 | Dr Ambedkar Jayanti |
| May 1 | Maharashtra Day |
| Aug 15 | Independence Day |
| Oct 2 | Gandhi Jayanti |
| Oct 20 | Diwali Laxmi Pujan |
| Oct 21 | Diwali Balipratipada |
| Nov 18 | Guru Nanak Jayanti |

> Holidays are hardcoded in BOTH frontend (`page.tsx`) and backend (`market_data.py`) as a safety net over `exchange_calendars`.

---

## 4. Section 3 — Stock Header (Live Price)

| | Details |
|---|---|
| **Component** | `StockHeader.tsx` |
| **API** | `GET /api/v1/analyze?symbol=^NSEI` |
| **Backend** | `analyze.py → fetch_multi_timeframe()` |
| **Refresh** | Every 60 seconds (auto) |

**Code Flow:**
```
Frontend calls /api/v1/analyze
  → Backend fetches 3m candles (resampled from 1m tvDatafeed/yfinance data)
  → Calculates: EMA20, RSI14, VWAP, Bollinger Bands, MACD
  → Returns: { price, indicators, signals, decision, reasoning, candles }
```

---

## 5. Section 4 — AI Price Action Analysis (Gemini)

This is the **most complex section**. It has TWO modes:

### 5a. Live Market Mode (9:15 AM – 3:30 PM IST, Trading Days Only)

```
User opens app / clicks ↻ Refresh
        ↓
AIDecision.tsx → GET /api/v1/ai-decision?symbol=^NSEI
        ↓
analyze.py: is_indian_market_open(now) → TRUE
        ↓
┌─ Check Redis cache (key: "ai_decision:<md5(symbol)>")
│   Cached + < 45 min? → Return immediately (no Gemini call)
│   No cache → Continue ↓
│
├─ fetch_multi_timeframe(symbol) via tvDatafeed → yfinance fallback
│   → 5m candles (primary for Gemini prompt)
│   → 15m candles (HTF context)
│   → 1h candles (higher timeframe trend)
│
├─ _build_market_data_block(): Formats candle data into text prompt
│   → If no live price exists → skip Gemini, return "No data" fallback
│
├─ _call_gemini(prompt, api_key):
│   → Tries models in order: gemini-2.5-flash → 2.5-flash-latest → fallbacks
│   → maxOutputTokens: 8000
│   → temperature: 0.3
│   → 429 rate limit → stop immediately (don't waste quota)
│   → 404 → try next model
│
├─ _extract_json(raw_text): Parse Gemini response
│   → Strategy 1: Complete ```json…``` fence
│   → Strategy 1b: Truncated fence (no closing ```)
│   → Strategy 2: Text starts with {
│   → Strategy 3: Find first {...} anywhere
│
├─ json.loads(extracted_text)
│   → Success → cache ONLY if decision is BULLISH/BEARISH (not WAIT/error)
│   → JSONDecodeError → _repair_json() tries closing missing braces
│   → If repair works → use partial result
│   → If repair fails → serve last EOD as fallback
│
└─ Return: { decision, bias_strength, market_structure, entry_zone,
             stop_loss, target, trade_quality, news_items, reasoning }
```

**Gemini Prompt Fields (all word-limited to prevent truncation):**
| Field | Max Length | Example |
|-------|-----------|---------|
| `decision` | 1 word | BULLISH / BEARISH / WAIT |
| `bias_strength` | 1 word | HIGH / MEDIUM / LOW |
| `market_structure` | 15 words | "Uptrend with higher highs on 5m" |
| `reasoning` | 40 words | "Price holding above VWAP with bullish volume..." |
| `news_impact` | 20 words | "FII selling pressure may cap upside near 25000" |

### 5b. EOD / Market-Closed Mode (After 3:30 PM / Holidays / Weekends)

```
analyze.py: is_indian_market_open(now) → FALSE
        ↓
┌─ Check Redis cache (key: "ai_eod:<date>:<md5(symbol)>")
│   Cached? → Return (20-hour TTL)
│   No cache → Continue ↓
│
├─ get_eod_analysis(symbol, now):
│   → Fetches daily candle data (last 30 days)
│   → Calls Gemini with EOD_NEXT_DAY_PROMPT
│   → Returns: next-day outlook with support/resistance/entry plan
│
└─ Cache result for 20 hours
```

**Frontend Display (`AIDecision.tsx`):**
- Shows 🌙 "NEXT DAY OUTLOOK" header (instead of "AI PRICE ACTION ANALYSIS")
- Shows "Based on <date>" badge
- Auto-refresh countdown: 4:27 (45 min for intraday, longer for EOD)
- ↻ Refresh button for manual trigger

---

## 6. Section 5 — Nifty 50 Market Timeline (Checkpoints)

### 7 Checkpoint Times (IST)

| ID | Label | Time | Purpose |
|----|-------|------|---------|
| 0915 | Market Open | 09:15 | Opening gap analysis |
| 0930 | Opening Range | 09:30 | First 15-min range established |
| 1000 | Morning Trend | 10:00 | Early trend direction |
| 1130 | Mid-Morning | 11:30 | Mid-session review |
| 1300 | Lunch Lull | 13:00 | Low-volatility check |
| 1400 | Afternoon Setup | 14:00 | Afternoon reversal/continuation |
| 1500 | Power Hour | 15:00 | Final session analysis |

### Live Market Flow

```
APScheduler (main.py) fires CronTrigger at each checkpoint time
        ↓
run_checkpoint_for_all_symbols(checkpoint_id="0915")
        ↓
For each symbol (^NSEI):
  ├─ fetch_multi_timeframe(symbol) → LIVE current data
  ├─ run_advanced_analysis(frames, symbol, now) — V2 6-step pipeline:
  │   Step 1: HTF Filter (15m EMA trend)
  │   Step 2: Reversal Check (candle patterns)
  │   Step 3: Market Structure (HH/HL/LH/LL detection)
  │   Step 4: Scalp Signal (BUY/SELL/NEUTRAL)
  │   Step 5: 3-min Confirmation
  │   Step 6: Option Strike Selection + Risk Assessment
  │
  ├─ save_checkpoint(date, "0915", symbol, payload) → Redis
  │   Key: "checkpoint:2026-03-04:0915:^NSEI"
  │   TTL: expires at midnight IST
  │
  └─ Print: "[CHECKPOINT] ✅ 0915 | ^NSEI | SCALP_BUY"
```

### Catch-up Logic (for missed checkpoints)

```
User opens app → GET /api/v1/checkpoints?symbol=^NSEI
        ↓
Backend checks: is_indian_market_open(now) → is it a trading day?
        ↓
YES → Find panels where data is null AND time has passed
   → Background task: run_catchup_sequential(["0915", "0930"])
   → Uses fetch_multi_timeframe_at_time() for HISTORICAL data at each slot
   → Response includes catchup_triggered: true
        ↓
Frontend (CheckpointBoard.tsx):
   → Shows 🔄 "Catching up..." on missed panels
   → Shows amber "CATCHING UP HISTORICAL DATA..." banner
   → Uses 10-second refresh interval (instead of 30s)
   → Switches back to 30s refresh once catch-up completes

NO (holiday/weekend) → No catch-up triggered
   → Panels show 📭 "No Data" (static)
```

### Panel States

| Icon | State | Meaning |
|------|-------|---------|
| ⏳ | Waiting... | Checkpoint time hasn't arrived yet |
| 🔄 | Catching up... | Missed checkpoint, backend is fetching historical data |
| 📭 | No Data | Holiday / weekend / no data available |
| ✅ | Populated | Shows: Signal, Price, Trend, Execute quality, Option strike |

---

## 7. Section 6 — Technical Indicators Strip

| Indicator | Signal Logic | File |
|-----------|-------------|------|
| **EMA20** | Price > EMA×1.0005 → BUY, < EMA×0.9995 → SELL | `analyze.py` |
| **RSI(14)** | < 35 → BUY, > 65 → SELL | `analyze.py` |
| **VWAP** | Price > VWAP×1.0002 → BUY, < VWAP×0.9998 → SELL | `analyze.py` |
| **BB** | Price < Lower Band → BUY, > Upper Band → SELL | `analyze.py` |
| **MACD** | MACD Line > Signal Line → BUY, < → SELL | `analyze.py` |

### Combined Signal Panel (Majority Vote)

```
Count BUY, SELL, NEUTRAL votes from all 5 indicators:

  4-5 BUY  → STRONG BUY  🟢
  3 BUY    → BUY          🟢
  2 BUY (most) → LEAN BUY 🟢
  Tied     → NEUTRAL       ⚪
  2 SELL (most) → LEAN SELL 🔴
  3 SELL   → SELL          🔴
  4-5 SELL → STRONG SELL  🔴

Display: "3B · 1S · 1N" (vote breakdown)
```

**Data Source:** Same `/api/v1/analyze` endpoint as Section 3. Calculated from 3m candle data. Refreshes every 60 seconds.

---

## 8. Section 7 — Intraday Decision Badge

| | Details |
|---|---|
| **Component** | `DecisionBadge.tsx` |
| **Data Source** | `/api/v1/analyze` response `decision` + `reasoning` fields |
| **Logic** | Rule-based (not AI) — uses indicator signals to produce BUY/SELL/HOLD |

---

## 9. Data Sources & Priority

```
Indian Market Indices (NIFTY, BANKNIFTY, SENSEX):

  Priority 1: tvDatafeed (TradingView)
    → Symbol mapping: ^NSEI → NIFTY/NSE, ^NSEBANK → BANKNIFTY/NSE
    → Intervals: 1m, 5m, 15m, 1h
    → Non-authenticated (guest mode)

  Priority 2: yfinance (Yahoo Finance)
    → Fallback for each individual interval if tvDatafeed fails
    → Uses standard Yahoo symbols (^NSEI, ^NSEBANK, ^BSESN)
```

---

## 10. Caching Strategy

| Cache Key | TTL | Purpose |
|-----------|-----|---------|
| `ai_decision:<hash>` | 45 min | Intraday Gemini result (only BULLISH/BEARISH cached) |
| `ai_eod:<date>:<hash>` | 20 hours | EOD next-day outlook |
| `checkpoint:<date>:<id>:<symbol>` | Until midnight | Checkpoint panel data |

> **Smart caching rule:** WAIT/error results are NEVER cached. If Gemini fails, the next request gets a fresh attempt instead of repeating the error for 45 minutes.

---

## 11. Gemini AI Quota Management

| Limit | Value |
|-------|-------|
| Free tier RPD | ~20 requests/day |
| Free tier RPM | 15 requests/min |
| Model priority | gemini-2.5-flash → gemini-2.5-flash-latest → gemini-1.5-flash-latest |
| maxOutputTokens | 8000 (safe within 65k model limit) |

**Quota-saving measures:**
- 45-min cache for intraday signals
- Skip Gemini if no live price data available
- Don't retry on 429 (rate limit) — return fallback immediately
- Only ~8 Gemini calls per symbol per trading day

---

## 12. NSE Holiday Detection

**Three layers of protection:**

| Layer | Location | Checks |
|-------|----------|--------|
| 1. Manual holiday set | `market_data.py` + `page.tsx` | `NSE_HOLIDAYS_2026` hardcoded dates |
| 2. exchange_calendars | `market_data.py` | XNSE calendar (weekends + official holidays) |
| 3. Weekday check | Fallback if library missing | `weekday() >= 5` for Sat/Sun |

---

## 13. Bug Fixes Applied

### Session: 2026-03-02 to 2026-03-03

| # | Bug | Root Cause | Fix |
|---|-----|-----------|-----|
| 1 | AI section error on live market | `maxOutputTokens: 3000` too small, Gemini verbose → JSON truncated mid-field | Raised to 8000 + added word limits to prompt |
| 2 | AI section error on NSE holiday | `_is_market_open_now()` only checked weekday+time, not holidays | Replaced with `is_indian_market_open()` using exchange_calendars |
| 3 | Backend 503 crash | `tvDatafeed>=1.3.0` wrong PyPI name (correct: `tvdatafeed` lowercase) | Fixed in `requirements.txt` |
| 4 | Checkpoints showing "Catching up" on holiday | Catch-up used `is_weekday` not holiday-aware check | Replaced with `is_indian_market_open()` |
| 5 | Truncated JSON not recovered | `_extract_json` couldn't handle incomplete ` ```json ` fences | Added Strategy 1b for partial fences + `_repair_json()` |
| 6 | exchange_calendars missing Holi 2026 | Library may not have latest holiday data | Added `NSE_HOLIDAYS_2026` manual set in both backend + frontend |
| 7 | Checkpoints NO DATA on live day | Render free tier sleeps → APScheduler misses cron jobs | Added catch-up system + frontend auto-refresh (10s during catchup) |
| 8 | No combined indicator signal | Only individual indicator badges shown | Added majority-vote Combined Signal panel with vote counts |

---

## 14. Environment Variables

### Backend (Render)

| Variable | Purpose |
|----------|---------|
| `GEMINI_API_KEY` | Google Gemini API access |
| `UPSTASH_REDIS_REST_URL` | Redis checkpoint storage |
| `UPSTASH_REDIS_REST_TOKEN` | Redis authentication |

### Frontend (Vercel)

| Variable | Purpose |
|----------|---------|
| `BACKEND_URL` | Render backend URL (server-side proxy) |

---

## 15. File Map

### Backend (`backend/`)

| File | Purpose |
|------|---------|
| `main.py` | FastAPI app + APScheduler (checkpoint cron triggers) |
| `config.py` | Settings (env vars, default symbol) |
| `routers/analyze.py` | `/analyze`, `/advanced-analyze`, `/ai-decision`, `/gemini-test` |
| `routers/checkpoints.py` | `/checkpoints`, `/checkpoints/trigger`, `/checkpoints/diag` |
| `services/market_data.py` | tvDatafeed + yfinance data fetching, indicators, holiday detection |
| `services/ai_decision.py` | Gemini prompts, API calls, JSON parsing, caching helpers |
| `services/decision.py` | Rule-based decision engine (BUY/SELL/HOLD) |
| `services/decision_v2.py` | V2 6-step pipeline (HTF → Scalp → Risk) |
| `services/checkpoint_store.py` | Redis CRUD for checkpoint data |
| `models/schemas.py` | Pydantic response models |
| `requirements.txt` | Python dependencies |

### Frontend (`frontend/src/app/`)

| File | Purpose |
|------|---------|
| `page.tsx` | Main dashboard, indicators strip, market status |
| `components/AIDecision.tsx` | Section 4 — AI Price Action panel |
| `components/CheckpointBoard.tsx` | Section 5 — Market Timeline grid |
| `components/StockHeader.tsx` | Section 3 — Price display |
| `components/DecisionBadge.tsx` | Section 7 — Intraday decision |
| `components/CandlestickChart.tsx` | Candlestick chart with EMA20 overlay |
| `components/MarketStatusBanner.tsx` | Section 2 — Open/Closed banner |
| `components/IndexSelector.tsx` | NIFTY/BANKNIFTY/SENSEX tabs |
| `components/ISTClock.tsx` | Live IST digital clock |
| `components/Sidebar.tsx` | Left sidebar navigation |

---

## Quick Debugging Reference

### Check if backend is alive:
```
https://stock-intelligence-api.onrender.com/api/v1/checkpoints/diag
```
Look for: `"version": "2.2-holiday-fix"`, `"is_market_open": true/false`

### Check if Gemini is working:
```
https://stock-intelligence-api.onrender.com/api/v1/gemini-test
```
Look for: `"status": 200`, `"raw_text": {"status": "ok"}`

### Check all available Gemini models:
```
https://stock-intelligence-api.onrender.com/api/v1/gemini-models
```

### Force a checkpoint manually:
```
POST https://stock-intelligence-api.onrender.com/api/v1/checkpoints/trigger?checkpoint_id=0915&symbol=^NSEI
```

---

> **Next Steps:** Test on live market day (March 4, 2026) and validate all sections working with real-time data.
