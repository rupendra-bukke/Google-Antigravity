# Trade-Craft Beginner System Guide (From Scratch)

Last updated: 2026-03-13
Audience: New team member, non-technical user, or anyone joining this project for the first time.

## 1) One-minute understanding

This project is a stock intelligence web app.

- Frontend (UI): Next.js app on Vercel.
- Backend (logic and APIs): FastAPI app on Render.
- Cache and timeline storage: Upstash Redis.
- AI analysis: Gemini API.
- Market data feed: yfinance (with optional TradingView adapter code path).

Simple flow:

1. You write code in VS Code.
2. You push code to GitHub (`dev` or `main`).
3. Vercel builds frontend and serves the website.
4. Render runs backend Python APIs.
5. Frontend calls backend APIs.
6. Backend fetches market/news data, runs logic/AI, returns JSON.
7. UI shows output sections to user.

Memory trick:
- UI asks, API thinks, cache remembers.

## 2) Big-picture architecture

```text
Browser (User)
  -> Vercel Frontend (Next.js)
     -> /api/* rewrite proxy
        -> Render Backend (FastAPI)
           -> Market data (yfinance)
           -> AI (Gemini API)
           -> Upstash Redis (cache + checkpoint storage)
```

Important:
- GitHub is code storage and version control.
- GitHub is NOT where your market analysis runtime happens.
- Actual runtime is Render (backend) + Vercel (frontend).

## 3) Stage-by-stage explanation

## 3.1 Stage A: Local development in VS Code

This is where you write code files.

Main folders:

- `backend/` Python API + analysis logic
- `frontend/` React/Next UI
- `releases/` release notes
- root `.md` files for workflow documentation

Output of this stage:
- New or modified code files on your local machine only.
- Nothing is live yet until pushed.

### Backend libraries (what, why, output)

Source: `backend/requirements.txt`

- `fastapi`
  - Why: Create web API endpoints quickly.
  - Output: Routes like `/api/v1/analyze`, `/api/v1/ai-decision`.

- `uvicorn`
  - Why: Run FastAPI server.
  - Output: Backend process listening on a port.

- `yfinance`
  - Why: Fetch market OHLCV candles for indices.
  - Output: DataFrames with Open/High/Low/Close/Volume.

- `pandas`, `numpy`
  - Why: Data processing and indicator calculations.
  - Output: EMA/RSI/VWAP/BB/MACD values and transformed frames.

- `httpx`
  - Why: HTTP calls to Gemini, NSE/BSE expiry APIs, Upstash REST.
  - Output: External API responses consumed by backend.

- `apscheduler`
  - Why: Trigger checkpoint jobs at fixed market times.
  - Output: Timeline snapshots captured automatically.

- `google-generativeai`
  - Why: Gemini ecosystem compatibility (main calls are REST/httpx).
  - Output: AI decision payloads shown in UI.

- `pydantic-settings`, `python-dotenv`
  - Why: Read environment variables safely.
  - Output: Centralized config object (`settings`).

- `pytz`
  - Why: IST timezone handling.
  - Output: Correct market-time calculations and display timestamps.

Note:
- `tvDatafeed` is coded as optional lazy path in `market_data.py`.
- In current setup it is not installed by default, so runtime mostly uses `yfinance`.

### Frontend libraries (what, why, output)

Source: `frontend/package.json`

- `next`, `react`, `react-dom`
  - Why: Build web UI pages and components.
  - Output: Dashboard and watchlist pages in browser.

- `lightweight-charts`
  - Why: Financial chart rendering support.
  - Output: Candlestick visualization where used.

- `typescript`
  - Why: Type-safe frontend code.
  - Output: Safer components and structured interfaces.

- `tailwindcss`, `postcss`, `autoprefixer`
  - Why: Styling and CSS build pipeline.
  - Output: Responsive modern UI styles.

## 3.2 Stage B: Git and GitHub

Branches used:

- `dev` = development and testing branch.
- `main` = production branch.

What GitHub does in this project:
- Stores your code history.
- Tracks commits/branches.
- Triggers Vercel/Render auto-deploy (based on branch settings).

What GitHub does NOT do:
- It does not run your live market analysis app logic directly.

Output of this stage:
- Versioned code in remote repository.
- Deploy triggers for frontend/backend services.

Memory trick:
- Dev is workshop, Main is showroom.

## 3.3 Stage C: Backend runtime on Render

Main file: `backend/main.py`

What happens when backend starts:

1. FastAPI app starts.
2. Routers are mounted:
   - `backend/routers/analyze.py`
   - `backend/routers/checkpoints.py`
3. APScheduler starts 7 checkpoint jobs:
   - 09:15, 09:30, 10:00, 11:30, 13:00, 14:00, 15:00 IST
4. EOD jobs run around 15:30 and reconcile missing slots.

Output of this stage:
- API endpoints live.
- Scheduled checkpoint capture and reconciliation runs.

Where Python "queries" actually run:
- On Render backend service (not in GitHub UI).

## 3.4 Stage D: Cache and timeline storage on Upstash Redis

Main file: `backend/services/checkpoint_store.py`

What is stored:

- Checkpoint snapshots:
  - key pattern: `checkpoint:{date}:{slot}:{symbol}`
- EOD close for last panel evaluation.
- AI and analyze caches (through `ai_decision.py`).

Why cache/storage is used:
- Reduce repeated API calls.
- Keep free-tier usage under limits.
- Preserve timeline data until next market reset.

Output:
- Faster responses.
- Stable UI even with temporary source/API issues.

## 3.5 Stage E: Frontend runtime on Vercel

Key config: `frontend/next.config.mjs`

Important behavior:
- Frontend calls `/api/...`.
- Next.js rewrite forwards to backend `BACKEND_URL`.

So browser does not call Render URL directly in components.
It calls frontend-relative API path, and Next proxy forwards request.

Output:
- Clean frontend API usage.
- Easy switch between dev/prod backend using env vars.

## 4) Backend files explained (simple)

## 4.1 `backend/config.py`
- Reads env vars like app version, channel, commit SHA.
- Output: `settings` object used across backend.

## 4.2 `backend/services/market_data.py`
- Fetches multi-timeframe data.
- Calculates indicators and market status.
- Output: DataFrames and indicator numbers used by endpoints.

## 4.3 `backend/services/decision.py`
- Rule-based basic BUY/SELL/HOLD logic.
- Output: base decision + reasoning list.

## 4.4 `backend/services/decision_v2.py`
- Advanced multi-step intraday logic pipeline.
- Output: richer analysis used in advanced endpoint and checkpoints.

## 4.5 `backend/services/ai_decision.py`
- Builds AI prompts.
- Fetches live macro/news context (RSS).
- Calls Gemini model and normalizes JSON output.
- Handles fallback if AI/API fails.
- Output: intraday AI panel, EOD outlook, and zero-to-hero plan payloads.

## 4.6 `backend/services/checkpoint_store.py`
- Reads/writes checkpoint data in Upstash.
- Output: persistent timeline panel data.

## 4.7 `backend/routers/analyze.py`
Main endpoints:

- `GET /api/v1/analyze`
  - Output: price, indicators, signal summary, candles.

- `GET /api/v1/watchlist-snapshot`
  - Output: batched index cards for watchlist screen.

- `GET /api/v1/advanced-analyze`
  - Output: advanced decision pipeline payload.

- `GET /api/v1/ai-decision`
  - Output: intraday AI panel (market open) or EOD plan (market closed).

- `GET /api/v1/expiry-calendar`
  - Output: expiry calendar cards (NIFTY/BANKNIFTY/FINNIFTY/SENSEX).

- `GET /api/v1/expiry-zero-hero`
  - Output: expiry-day high-risk CE/PE AI plan.

## 4.8 `backend/routers/checkpoints.py`
Main endpoints:

- `GET /api/v1/checkpoints`
  - Output: 7 checkpoint panel data + EOD close + metadata.

- `GET /api/v1/checkpoints/diag`
  - Output: diagnostic health for checkpoints/Redis/market mode.

- `POST /api/v1/checkpoints/reconcile`
  - Output: backfill missing checkpoint slots for date.

- `POST /api/v1/checkpoints/trigger`
  - Output: manual checkpoint run for testing.

## 5) Frontend files explained (simple)

## 5.1 `frontend/src/app/layout.tsx`
- Global app shell, sidebar, symbol provider.
- Output: consistent app structure across pages.

## 5.2 `frontend/src/app/context/SymbolContext.tsx`
- Stores selected index symbol globally.
- Output: dashboard and watchlist stay in sync.

## 5.3 `frontend/src/app/page.tsx` (Dashboard)
- Main dashboard page.
- Calls analyze + advanced endpoints periodically.
- Renders all major panels.
- Output: complete live dashboard view.

## 5.4 `frontend/src/app/watchlist/page.tsx`
- Watchlist page with batched snapshot call.
- Output: compact cards for all indices.

## 5.5 Key UI components and their output

- `AIDecision.tsx`
  - Calls `/api/v1/ai-decision`.
  - Output: AI intraday/EOD section with risk and levels.

- `ExpiryZeroHeroPanel.tsx`
  - Calls `/api/v1/expiry-calendar` and `/api/v1/expiry-zero-hero`.
  - Output: expiry-day CE/PE high-risk plan panel.

- `CheckpointBoard.tsx`
  - Calls `/api/v1/checkpoints`.
  - Output: 7 timeline cards + win/loss review summary.

- `ExpiryBanner.tsx`
  - Calls `/api/v1/expiry-calendar`.
  - Output: upcoming/today expiry cards.

- `MarketStatusBanner.tsx`
  - Uses frontend time check plus backend market message.
  - Output: Market open/closed status bar.

- `StockHeader.tsx`
  - Shows selected symbol and LTP.

- `IndexSelector.tsx`
  - Lets user switch index context.

- `Sidebar.tsx`
  - Dashboard + Watchlist active routes.
  - History/Settings are placeholders (coming soon).

## 6) UI section order and what each section means

Current dashboard order (`page.tsx`):

1. Hero header + IST clock + refresh
   - Output: title, live time, manual refresh button.

2. Build badge + index selector
   - Output: Dev/Prod + commit label, selected index control.

3. Error panel (only when fetch fails)
   - Output: human-readable API error.

4. Market status banner
   - Output: open/closed with reason.

5. Expiry banner
   - Output: nearest expiry and index cards.

6. Stock header
   - Output: selected index price and update timestamp.

7. AI price action section
   - Output: intraday or EOD decision payload.

8. Expiry zero-to-hero section
   - Output: expiry-day CE/PE setup panel.

9. Indicator strip
   - Output: EMA/RSI/VWAP/BB/MACD signal states and combined signal.

10. NIFTY 50 checkpoint timeline
   - Output: 7-slot capture board + win/loss review.

11. Footer
   - Output: last refresh time and source note.

## 7) Exact runtime examples (request to UI)

## Example A: Loading Dashboard

1. User opens dashboard URL.
2. `page.tsx` calls:
   - `/api/v1/analyze`
   - `/api/v1/advanced-analyze`
3. Backend calculates indicators and decisions.
4. JSON response returns to frontend.
5. UI cards update.

Output user sees:
- latest price, indicators, baseline decision.

## Example B: AI panel refresh

1. `AIDecision.tsx` calls `/api/v1/ai-decision`.
2. Backend checks market-open vs market-closed.
3. Backend may call Gemini and/or return cache/fallback.
4. JSON response returns.

Output user sees:
- intraday setup or next-day outlook block.

## Example C: Timeline board

1. `CheckpointBoard.tsx` calls `/api/v1/checkpoints`.
2. Backend reads Upstash stored slots.
3. If missing and needed, catch-up/reconcile logic may run.
4. Board displays captured cards and review stats.

Output user sees:
- per-checkpoint move suggestion + win/loss summary.

## 8) Dev to Prod workflow (with meaning)

Standard flow:

1. `git checkout dev`
2. Make code changes.
3. `git add ...`
4. `git commit -m "dev: ..."`
5. `git push origin dev`
6. Validate on Vercel dev preview URL.
7. Merge `dev` to `main`.
8. `git push origin main`
9. Verify production URL.
10. Switch back to dev: `git checkout dev`.

Meaning:
- Dev is for testing safely.
- Main is only for approved production code.

## 9) Free-tier guardrails (mandatory project rule)

This project must stay within free-tier limits across all providers.

Always follow:

- Use cache first whenever possible.
- Avoid very frequent polling.
- Avoid duplicate API calls for same data.
- Return fallback payloads instead of aggressive retries.
- Keep heavy dependencies minimal.
- Prefer batched endpoints (example: watchlist snapshot).

Provider-sensitive points:

- Render free tier: watch memory and CPU.
- Gemini free tier: request/minute and daily request limits.
- Upstash free tier: request quota and throughput.
- Vercel free tier: build and bandwidth limits.

If a new feature increases call volume significantly, redesign before release.

Memory trick:
- Measure first, then add.

## 10) Common confusion cleared

Q1) Do we have separate dev/prod folders locally?
- No. Same local folder. Branch switch changes version.

Q2) Do we have separate GitHub repos for dev and prod?
- No. Same repo, different branches.

Q3) Is GitHub running Python logic?
- No. Render runs Python backend.

Q4) Is frontend calling backend directly by full URL in components?
- Mostly no. It calls `/api/...`; Next rewrite forwards to backend URL.

Q5) Why cache data?
- Speed, stability, and free-tier cost control.

## 11) Quick reference file map

- Backend entry: `backend/main.py`
- Backend config: `backend/config.py`
- Analyze routes: `backend/routers/analyze.py`
- Checkpoint routes: `backend/routers/checkpoints.py`
- Market data service: `backend/services/market_data.py`
- AI service: `backend/services/ai_decision.py`
- Redis store helper: `backend/services/checkpoint_store.py`
- Frontend dashboard page: `frontend/src/app/page.tsx`
- Frontend watchlist page: `frontend/src/app/watchlist/page.tsx`
- Frontend API rewrite: `frontend/next.config.mjs`
- Render config: `render.yaml`

## 12) Final summary

You write code locally, GitHub stores version history, Render runs backend logic, Vercel serves frontend UI, Upstash stores cache/timeline state, and Gemini adds AI analysis.

For safe delivery:
- Build in dev, test in preview, release to main, document every production release.
