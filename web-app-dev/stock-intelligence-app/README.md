# Trade-Craft Stock Intelligence App

Trade-Craft is a full-stack intraday market intelligence dashboard for Indian indices.

- Frontend: Next.js (Vercel)
- Backend: FastAPI (Render)
- Cache/Store: Upstash Redis
- AI: Gemini (intraday + EOD outlook)
- Market data: `yfinance` in deployed runtime, `tvDatafeed` optional locally if installed

## Current Product Scope

- Index support: `^NSEI`, `^NSEBANK`, `^CNXFINSERVICE`, `^BSESN` (Nifty 50, Bank Nifty, FinNifty, Sensex)
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
uvicorn main:app --reload --port 8000
```

### Frontend

```powershell
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000`.

## API Endpoints (Key)

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
- `GEMINI_API_KEY`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `DEFAULT_SYMBOL` (optional)

### Frontend (Vercel/local)

- `BACKEND_URL` (used by `next.config.mjs` rewrite for `/api/*`)

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

Use `DOCS_INDEX.md` to know which files are active vs archived.
