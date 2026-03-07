# Trade-Craft Architecture (Current)

Last updated: 2026-03-07
Status: Active source-of-truth for technical behavior

## 1) System Overview

```text
Frontend (Next.js on Vercel)
  -> /api/* rewrite (next.config.mjs)
  -> Backend (FastAPI on Render)
  -> Upstash Redis (cache + checkpoint storage)
  -> External sources:
     - tvDatafeed (primary market candles)
     - yfinance (fallback market candles)
     - Gemini API (AI analysis)
```

## 2) Frontend Runtime Flow

Main page file:
- `frontend/src/app/page.tsx`

Data fetch pattern:
- Every 60 seconds, page fetches:
  - `/api/v1/analyze`
  - `/api/v1/advanced-analyze`
- AI panel fetches `/api/v1/ai-decision` on its own cycle.
- Timeline panel fetches `/api/v1/checkpoints` on its own cycle.

Current UI order:
1. Header (title, clock, refresh)
2. Index selector
3. Error panel (if any)
4. Market status banner
5. Expiry banner
6. Stock header
7. AI decision panel
8. Indicators strip + combined signal
9. Checkpoint timeline
10. Footer

## 3) Backend API Surface

Router prefix:
- `/api/v1`

Primary endpoints:
- `GET /analyze`
- `GET /advanced-analyze`
- `GET /ai-decision`
- `GET /gemini-test`
- `GET /gemini-models`

Checkpoint endpoints:
- `GET /checkpoints`
- `POST /checkpoints/trigger`
- `GET /checkpoints/diag`

System endpoint:
- `GET /health`

## 4) Data and Decision Layers

Files:
- `backend/services/market_data.py`
- `backend/services/decision.py`
- `backend/services/decision_v2.py`
- `backend/services/ai_decision.py`

Source priority:
1. tvDatafeed
2. yfinance fallback

Indicator layer:
- EMA, RSI, VWAP, Bollinger, MACD
- Exposed by `/analyze`

Advanced analysis layer:
- Multi-timeframe decision pipeline
- Exposed by `/advanced-analyze`

AI layer:
- Intraday analysis when market is open
- EOD next-day outlook when market is closed
- Exposed by `/ai-decision`

## 5) Scheduler and Checkpoints

File:
- `backend/main.py`

APScheduler checkpoints (IST, Mon-Fri):
- 09:15, 09:30, 10:00, 11:30, 13:00, 14:00, 15:00

Behavior:
- Scheduled jobs run advanced analysis and store snapshot payloads.
- If jobs are missed (e.g., free-tier sleep), catch-up runs historical-at-time reconstruction via:
  - `fetch_multi_timeframe_at_time(...)`

Checkpoint storage:
- Upstash Redis through `backend/services/checkpoint_store.py`

## 6) AI Decision Behavior

File:
- `backend/services/ai_decision.py`

Modes:
- Market open:
  - fetch live frames
  - call Gemini
  - cache real analysis results (avoid caching weak/error fallbacks)
- Market closed:
  - run or return cached EOD outlook

Reliability protections:
- Multi-model fallback attempts
- JSON extraction/repair helpers
- Rate-limit handling and fallback responses

## 7) Market Open/Holiday Logic

File:
- `backend/services/market_data.py`

Checks:
1. Manual holiday safety list (`NSE_HOLIDAYS_2026`)
2. `exchange_calendars` (`XNSE`) when available
3. Time-window validation (09:15 to 15:30 IST)

Frontend also has a status fallback check in `page.tsx`.

## 8) Expiry Banner Logic

File:
- `frontend/src/app/components/ExpiryBanner.tsx`

Tracks:
- Nifty, Bank Nifty, FinNifty, Sensex expiry schedules
- weekly/monthly state
- urgency visuals (`today` / `tomorrow` / `in N days`)

Refresh:
- Recomputed every 60 seconds on client.

Note:
- Current logic is weekday-based and does not yet adjust for exchange holiday-shifted expiry.

## 9) Caching Summary

AI cache keys (in Redis):
- Intraday AI decision cache
- EOD AI analysis cache

Checkpoint keys:
- Date + checkpoint slot + symbol scoped records

Outcome:
- Reduced repeated expensive calls
- Better behavior during backend wake/sleep cycles

## 10) Environment and Deployment

Frontend:
- Deployed on Vercel
- `/api/*` rewritten to `BACKEND_URL`

Backend:
- Deployed on Render via `render.yaml`

Branch strategy:
- `dev` for changes and preview validation
- `main` for production release

Reference docs:
- `BRANCH_DEPLOY_FLOW.md`
- `FLOW_QUICK_REF.md`
- `RELEASE_RUNBOOK.md`

