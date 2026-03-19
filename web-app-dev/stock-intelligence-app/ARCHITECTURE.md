# Trade-Craft Architecture (Current)

Last updated: 2026-03-19
Status: Active source-of-truth for technical behavior

## 1) System Overview

```text
Frontend (Next.js on Vercel)
  -> /api/* rewrite (next.config.mjs)
  -> Backend (FastAPI on Render)
  -> Upstash Redis (cache + checkpoint storage)
  -> External sources:
     - yfinance (active deployed market candles)
     - tvDatafeed (optional local source if installed)
     - NSE/BSE expiry APIs
     - Gemini API (AI analysis)
```

## 2) Frontend Runtime Flow

Main page file:
- `frontend/src/app/page.tsx`

Data fetch pattern:
- Dashboard page fetches every 180 seconds (hidden tabs paused):
  - `/api/v1/analyze`
  - `/api/v1/advanced-analyze`
- AI panel fetches `/api/v1/ai-decision` on its own checkpoint-aware cycle.
- Timeline panel fetches `/api/v1/checkpoints` for the selected symbol on its own cycle.
- Expiry panels fetch `/api/v1/expiry-calendar` hourly.

Current UI order:
1. Header (title, clock, refresh)
2. Index selector
3. Error panel (if any)
4. Market status banner
5. Expiry banner
6. Stock header
7. AI decision panel
8. Expiry zero-to-hero panel
9. Indicators strip + combined signal
10. Checkpoint timeline
11. Footer

## 3) Backend API Surface

Router prefix:
- `/api/v1`

Primary endpoints:
- `GET /analyze`
- `GET /advanced-analyze`
- `GET /ai-decision`
- `GET /watchlist-snapshot`
- `GET /expiry-calendar`
- `GET /expiry-zero-hero`
- `GET /gemini-test`
- `GET /gemini-models`

Checkpoint endpoints:
- `GET /checkpoints`
- `POST /checkpoints/trigger`
- `POST /checkpoints/reconcile`
- `GET /checkpoints/cron-capture`
- `GET /checkpoints/cron-reconcile`
- `GET /checkpoints/diag`

System endpoint:
- `GET /health`

## 4) Data and Decision Layers

Files:
- `backend/services/market_data.py`
- `backend/services/decision.py`
- `backend/services/decision_v2.py`
- `backend/services/ai_decision.py`

Source strategy:
1. Attempt tvDatafeed if it is installed locally
2. Fall back to yfinance per timeframe
3. Production Render deploy currently runs without tvDatafeed, so yfinance is the effective live source

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
- In-process APScheduler still runs while the Render backend is awake.
- Repo-root GitHub Actions workflow `.github/workflows/stock-intelligence-checkpoint-capture.yml` wakes the backend and calls secure cron endpoints so timeline snapshots can be stored even when no browser is open.
- Scheduled external captures use historical slice mode, so a slightly delayed cron still saves the exact 09:15 / 09:30 / 10:00 style checkpoint view.
- Catch-up and external cron paths both skip non-trading days to avoid saving stale holiday data.
- If jobs are missed, catch-up runs historical-at-time reconstruction via:
  - `fetch_multi_timeframe_at_time(...)`
- Current operational setup:
  - Render services use `CHECKPOINT_CRON_SECRET`
  - GitHub repository secrets provide dev/prod base URLs and matching secrets
  - Manual prod validation succeeded with a `0915` capture for `2026-03-19`

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
2. Shared `is_nse_trading_day(...)` helper used by market status, EOD selection, and checkpoint TTL
3. `exchange_calendars` (`XNSE`) only when it is available locally
4. Time-window validation (09:15 to 15:30 IST)

Frontend also has a status fallback check in `page.tsx`.

## 8) Expiry Banner Logic

File:
- `frontend/src/app/components/ExpiryBanner.tsx`

Tracks:
- Nifty, Bank Nifty, FinNifty, Sensex expiry schedules
- exchange API backed next-expiry dates
- weekly/monthly state
- urgency visuals (`today` / `tomorrow` / `in N days`)

Refresh:
- Client clock state every 60 seconds
- Live expiry calendar refresh every 60 minutes

Note:
- Primary path uses `/api/v1/expiry-calendar` backed by NSE/BSE exchange APIs.
- Client-side weekday rules are fallback only if the expiry API is unavailable.

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
