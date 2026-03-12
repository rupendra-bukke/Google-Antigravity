# Trade-Craft Workflow From Scratch

This is the complete guide for a new person (including non-technical users) to understand:
- what this project is,
- what each section does,
- how data moves through the app,
- and how we safely release changes from `dev` to `main`.

## 1) What We Built

Trade-Craft is a stock/index intelligence web app focused on Indian indices:
- NIFTY
- BANKNIFTY
- FINNIFTY
- SENSEX

Main purpose:
- give intraday context,
- show AI-supported decision blocks,
- track checkpoint signals during the day,
- and keep a release-safe workflow (`dev` first, then `main`).

Memory trick:
- `Build -> Verify -> Release`

## 2) Project Structure (Simple View)

- `frontend/` = UI (what user sees in browser)
- `backend/` = APIs + analysis logic
- `releases/` = one release note file per production release
- root docs (`*.md`) = workflow and release documentation

Memory trick:
- `F = Face` (frontend), `B = Brain` (backend)

## 3) UI Sections and What They Do

## 3.1 Dashboard (`/`)
- Live index header/price area.
- Market status and expiry tracker cards.
- AI Price Action Analysis panel.
- Expiry Zero-to-Hero (AI Plan) panel.
- Indicators and timeline/checkpoint board.

What user gets:
- quick market context,
- directional idea,
- checkpoint-by-checkpoint progression.

## 3.2 Watchlist (`/watchlist`)
- Multi-index cards with current price, move %, and simple decision label.
- Uses one batched API call for lower load.

What user gets:
- one-screen index snapshot without opening full dashboard per symbol.

## 3.3 Timeline / Checkpoints
- 7 market slots (09:15 to 15:00 IST).
- Stores each slot response and shows review (win/loss/skip/pending).
- Last slot is evaluated using EOD close when needed.

What user gets:
- signal history visibility and accountability.

## 4) End-to-End Data Flow (Who Calls What Next)

## 4.1 Browser to Frontend
- User opens app URL (dev or prod).
- Next.js renders pages and components.

## 4.2 Frontend to Backend
- Frontend calls relative API paths (for example `/api/v1/analyze`).
- Next.js rewrite/proxy routes this to backend URL configured in env (`BACKEND_URL`).

## 4.3 Backend Endpoints (Core)

1. `GET /api/v1/analyze`
- standard indicator/decision payload for selected symbol.

2. `GET /api/v1/advanced-analyze`
- multi-step advanced engine output.

3. `GET /api/v1/ai-decision`
- AI intraday/EOD decision panel payload.

4. `GET /api/v1/expiry-zero-hero`
- dedicated expiry AI plan payload.

5. `GET /api/v1/checkpoints`
- returns timeline slots + metadata.

6. `GET /api/v1/watchlist-snapshot`
- batched data for watchlist cards.

## 4.4 Backend Services

- `services/market_data.py`
  - fetches market candles (tries TradingView client if available, else yfinance fallback).
  - computes indicators and normalized OHLC series.

- `services/ai_decision.py`
  - builds AI prompt blocks,
  - adds live news context,
  - calls Gemini API,
  - applies fallback when unavailable.

- `services/checkpoint_store.py`
  - reads/writes checkpoint and EOD records in Upstash Redis.

## 4.5 Storage and External Services

- Upstash Redis:
  - caches AI/analyze responses,
  - stores checkpoint timeline snapshots.

- Gemini API:
  - generates AI decision outputs.

- Market feed:
  - TradingView client when available,
  - yfinance fallback.

Memory trick:
- `UI -> API -> Service -> Cache -> UI`

## 5) Dev and Prod Environments

Current URLs:
- Dev (preview): `https://trade-craft-app-git-dev-rupendra-bukkes-projects.vercel.app/`
- Prod: `https://trade-craft-rb.vercel.app/`

Important truth:
- no separate dev/prod folders,
- same codebase, different branch versions and environment variables.

Memory trick:
- `Same files, different branch state`

## 6) Branch Workflow (How We Work Safely)

Branches:
- `dev` = all active changes and testing
- `main` = production-only branch

Flow:
1. create/edit on `dev`
2. push `dev`
3. verify preview URL
4. merge `dev -> main`
5. push `main` (prod deploy)
6. switch back to `dev`

Memory trick:
- `DTVMPD`:
  - Dev
  - Test
  - Verify
  - Merge
  - Push
  - Dev again

## 7) Commands You Use Most

```powershell
cd /d d:\GitHub\Google-Antigravity\web-app-dev\stock-intelligence-app

git checkout dev
git pull origin dev
git status -sb

# make changes
git add <files>
git commit -m "dev: <message>"
git push origin dev

# release
git checkout main
git pull origin main
git merge dev
git push origin main
git checkout dev
```

Check where you are:

```powershell
git branch --show-current
```

Memory trick:
- `Show current, then continue`

## 8) Mandatory Release Documentation

For every production push:
1. update `CHANGELOG.md`
2. create `releases/vYYYY.MM.DD-NN.md`
3. keep release commit references
4. then merge/push to `main`
5. switch back to `dev`

Memory trick:
- `No docs, no release`

## 9) How The App Runs (Local)

Backend:

```powershell
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Frontend:

```powershell
cd frontend
npm install
npm run dev
```

## 10) Troubleshooting Basics

If preview and prod look different:
1. check branch
2. check deployed URL (dev vs prod)
3. check latest commit on that branch
4. check env variables

If timeline slots are empty:
1. check checkpoint API
2. check Redis config
3. check market day/time logic

If AI panel fails:
1. verify Gemini key
2. check API status/limits
3. fallback should still render panel safely

Memory trick:
- `Branch -> URL -> Commit -> Env`

## 11) One-Line Summary

Trade-Craft uses a single repo with disciplined branch workflow:
build in `dev`, validate in preview, document release, promote to `main`, then return to `dev`.
