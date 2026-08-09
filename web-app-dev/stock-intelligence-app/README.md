# Trade-Craft Stock Intelligence App

Trade-Craft is a full-stack intraday market intelligence dashboard for Indian indices.

- Frontend: Next.js (Vercel)
- Backend: FastAPI (Render)
- Cache/Store: Upstash Redis
- Auth: Supabase (email/password login, JWT on API calls)
- AI: Gemini (intraday + EOD outlook)
- Market data: `yfinance` in deployed runtime, `tvDatafeed` optional locally if installed

## Current Product Scope

- Index support: `^NSEI`, `^NSEBANK`, `^CNXFINSERVICE`, `^BSESN` (Nifty 50, Bank Nifty, FinNifty, Sensex)
- Supabase login (`/login`) with protected dashboard and watchlist routes
- Bearer-token auth on all `/api/v1/*` endpoints (cron endpoints use a separate secret)
- Live/near-live technical analysis (EMA, RSI, VWAP, BB, MACD)
- Advanced multi-timeframe analysis (`/advanced-analyze`)
- AI decision panel (`/ai-decision`) with:
  - market-open intraday mode
  - market-closed EOD next-day mode
- Watchlist MVP with batched snapshot fetch
- Checkpoint timeline with 7 strategic market-time snapshots
- Holiday-aware market status handling
- Live expiry calendar plus expiry zero-to-hero panel

## UI Sections (Current Order in `page.tsx`)

1. Header (branding, IST clock, refresh)
2. Index selector
3. Error panel (if API fails)
4. Market status banner
5. Expiry banner
6. Stock header (symbol + price)
7. AI decision panel
8. Expiry zero-to-hero panel
9. Indicators strip + combined signal
10. Selected index market timeline (checkpoint board)
11. Footer

## Folder Structure

```text
stock-intelligence-app/
|-- backend/
|   |-- main.py
|   |-- config.py
|   |-- routers/
|   |   |-- analyze.py
|   |   `-- checkpoints.py
|   |-- services/
|   |   |-- market_data.py
|   |   |-- ai_decision.py
|   |   |-- decision.py
|   |   `-- decision_v2.py
|   `-- models/
|       `-- schemas.py
|-- frontend/
|   |-- next.config.mjs
|   |-- src/app/
|   |   |-- layout.tsx
|   |   |-- page.tsx
|   |   |-- login/page.tsx
|   |   |-- watchlist/page.tsx
|   |   |-- context/
|   |   `-- components/
|   `-- package.json
`-- docs (*.md)
```

## Quick Start

### Backend

```powershell
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
# Set GEMINI_API_KEY and Supabase vars; use AUTH_REQUIRED=false for local dev without login
uvicorn main:app --reload --port 8000
```

### Frontend

```powershell
cd frontend
npm install
copy .env.local.example .env.local
# Set BACKEND_URL=http://localhost:8000 and Supabase keys (or leave empty with AUTH_REQUIRED=false on backend)
npm run dev
```

Open `http://localhost:3000`. If backend `AUTH_REQUIRED=false`, the dashboard loads without login.

## Authentication

- Users sign in at `/login` with Supabase email/password.
- `AppShell.tsx` redirects unauthenticated users to `/login`.
- Frontend API calls use `authedFetch` (`frontend/src/lib/authedFetch.ts`) to attach `Authorization: Bearer <jwt>`.
- Backend validates tokens via `backend/services/auth_guard.py` (Supabase `/auth/v1/user`).
- Checkpoint cron endpoints (`/checkpoints/cron-capture`, `/checkpoints/cron-reconcile`) use `X-Checkpoint-Cron-Secret`, not Supabase.
- `GET /health` remains public.

Login issues: see `AUTH_SETUP.md`.

## API Endpoints (Key)

All `/api/v1/*` routes below require a valid Supabase bearer token unless `AUTH_REQUIRED=false` on the backend.

- `GET /health`
- `GET /api/v1/analyze?symbol=^NSEI`
- `GET /api/v1/advanced-analyze?symbol=^NSEI`
- `GET /api/v1/ai-decision?symbol=^NSEI`
- `GET /api/v1/watchlist-snapshot?symbols=^NSEI,^NSEBANK,^CNXFINSERVICE,^BSESN`
- `GET /api/v1/checkpoints?symbol=^NSEI`
- `POST /api/v1/checkpoints/trigger?checkpoint_id=0915&symbol=^NSEI`
- `POST /api/v1/checkpoints/reconcile?date=YYYY-MM-DD`
- `GET /api/v1/expiry-calendar`
- `GET /api/v1/expiry-zero-hero?index=NIFTY`
- `GET /api/v1/checkpoints/diag`
- `GET /api/v1/gemini-test`
- `GET /api/v1/gemini-models`

## Environment Variables

### Backend (Render/local)

- `APP_ENV` (`development` or `production`)
- `GEMINI_API_KEY` (required for AI panel)
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `AUTH_REQUIRED` (`true` in production; set `false` for local dev without login)
- `CHECKPOINT_CRON_SECRET` (required for unattended checkpoint GitHub Actions)
- `DEFAULT_SYMBOL` (optional)

### Frontend (Vercel/local)

- `BACKEND_URL` (used by `next.config.mjs` rewrite for `/api/*`)
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

## Branch and Deploy Flow

- Build/test on `dev`
- Push `origin/dev`
- Validate on Vercel Preview
- Merge `dev` -> `main`
- Push `origin/main` to deploy production

Detailed docs:

- `FLOW_QUICK_REF.md`
- `BRANCH_DEPLOY_FLOW.md`
- `RELEASE_RUNBOOK.md`

## Documentation Map

Start with `PROJECT_REFERENCE_AND_ROADMAP.md` for a full project overview and roadmap.

Use `DOCS_INDEX.md` to know which files are active vs archived.
