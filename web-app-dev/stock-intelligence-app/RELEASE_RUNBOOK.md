# Trade-Craft Release Runbook

This document captures the DEV -> PROD release flow for `stock-intelligence-app`.

## 1. Pre-Prod Checklist

0. Documentation/version update (mandatory before prod push)
- Update `CHANGELOG.md`:
  - Add current release notes under `## Unreleased` during dev testing.
  - At prod release, move to a version section (format: `vYYYY.MM.DD-NN`).
- Create a release note file from template:
  - `releases/RELEASE_NOTE_TEMPLATE.md`
  - Save as `releases/vYYYY.MM.DD-NN.md`
- Update version envs:
  - Frontend (Vercel Preview + Production): `NEXT_PUBLIC_APP_VERSION=vYYYY.MM.DD-NN`
  - Frontend channel env:
    - Preview: `NEXT_PUBLIC_APP_CHANNEL=dev`
    - Production: `NEXT_PUBLIC_APP_CHANNEL=prod`
  - Backend (Render dev + prod): `APP_VERSION=vYYYY.MM.DD-NN`
  - Optional backend channel override: `APP_CHANNEL=dev|prod`

0.1 Free-tier safety check (mandatory before prod push)
- Confirm new/updated feature does not exceed free-tier budgets across all active providers:
  - Vercel (frontend/serverless usage)
  - Render (RAM/CPU/request load)
  - Upstash Redis (request volume)
  - AI/external APIs (request quotas/cost)
- Enforce efficiency patterns before release:
  - cache where data is not tick-critical
  - batch API calls when possible
  - increase polling interval if real-time is not required
  - add fallback path if provider API fails/rate-limits

1. Clean `dev` branch
- `git checkout dev`
- `git pull origin dev`
- `git status -sb`
- Ensure no unintended untracked files.

2. Backend local validation
- `cd backend`
- `pip install -r requirements.txt`
- `uvicorn main:app --reload --port 8000`
- Test:
  - `/health`
  - `/api/v1/analyze?symbol=^NSEI`
  - `/api/v1/advanced-analyze?symbol=^NSEI`
  - `/api/v1/ai-decision?symbol=^NSEI`
  - `/api/v1/checkpoints?symbol=^NSEI`
  - `/api/v1/checkpoints/diag`

3. Frontend local validation
- `cd frontend`
- `npm install`
- `npm run dev`
- Validate:
  - Index switching
  - Price/header refresh
  - AI section refresh
  - Checkpoint board load/catch-up
  - Market open/closed banner behavior

4. Critical checks
- Manual checkpoint trigger:
  - `POST /api/v1/checkpoints/trigger?checkpoint_id=0915&symbol=^NSEI`
- Confirm Redis save/read via `/api/v1/checkpoints/diag`.
- Confirm AI fallback behavior when data/API is unavailable.

5. Environment checks
- Backend envs:
  - `GEMINI_API_KEY`
  - `UPSTASH_REDIS_REST_URL`
  - `UPSTASH_REDIS_REST_TOKEN`
  - `APP_VERSION`
  - `APP_CHANNEL` (optional)
- Frontend env:
  - `BACKEND_URL`
  - `NEXT_PUBLIC_APP_VERSION`
  - `NEXT_PUBLIC_APP_CHANNEL`

6. Known issue to verify/fix before prod
- `frontend/src/app/components/CheckpointBoard.tsx` is hardcoded to `^NSEI`.

7. Release promotion
- Push tested changes to `origin/dev`.
- Merge `dev` -> `main`.
- Push `origin/main`.

8. Post-deploy smoke test
- Verify prod endpoints and UI quickly.

## 2. Copy-Paste Command Script (Windows)

```powershell
# =========================
# TRADE-CRAFT RELEASE SCRIPT
# =========================

# 0) Go to project
cd /d d:\GitHub\Google-Antigravity\web-app-dev\stock-intelligence-app

# 1) Sync and clean check on DEV
git checkout dev
git pull origin dev
git status -sb

# 2) Backend setup + run (Terminal 1)
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# 3) Backend API smoke tests (Terminal 2)
cd /d d:\GitHub\Google-Antigravity\web-app-dev\stock-intelligence-app

curl http://localhost:8000/health
curl "http://localhost:8000/api/v1/analyze?symbol=^NSEI"
curl "http://localhost:8000/api/v1/advanced-analyze?symbol=^NSEI"
curl "http://localhost:8000/api/v1/ai-decision?symbol=^NSEI"
curl "http://localhost:8000/api/v1/checkpoints?symbol=^NSEI"
curl "http://localhost:8000/api/v1/checkpoints/diag"

# Optional manual checkpoint trigger
curl -X POST "http://localhost:8000/api/v1/checkpoints/trigger?checkpoint_id=0915&symbol=^NSEI"

# 4) Frontend setup + run (Terminal 3)
cd /d d:\GitHub\Google-Antigravity\web-app-dev\stock-intelligence-app\frontend
npm install
npm run dev

# 5) After UI testing, commit on DEV
cd /d d:\GitHub\Google-Antigravity\web-app-dev\stock-intelligence-app
git add .
git commit -m "Pre-prod validated: backend/frontend checks passed"
git push origin dev

# 6) Promote DEV -> MAIN
git checkout main
git pull origin main
git merge dev
git push origin main

# 7) Final prod quick checks (replace with your real backend URL)
# curl "https://<your-render-backend>/health"
# curl "https://<your-render-backend>/api/v1/checkpoints/diag"
```
