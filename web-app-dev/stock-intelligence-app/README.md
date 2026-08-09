# Trade-Craft — Project Hub

> **Open this file first.** All live URLs, workflow, services, and documentation links in one place.  
> **Repo:** [github.com/rupendra-bukke/Google-Antigravity](https://github.com/rupendra-bukke/Google-Antigravity)  
> **GitHub login:** username `rupendra-bukke` · email `bukke.rupendra@gmail.com`  
> **Current release:** `v2026.08.09-01`  
> **Last updated:** 2026-08-09

---

## Quick Links — Live Apps

| Environment | Branch | Frontend URL | Vercel project | Use for |
|-------------|--------|--------------|----------------|---------|
| **Dev / Preview** | `dev` | [trade-craft-app-git-dev (Vercel Preview)](https://trade-craft-app-git-dev-rupendra-bukkes-projects.vercel.app/) | `trade-craft-app` (preview) | Test changes before prod |
| **Production** | `main` | [trade-craft-rb.vercel.app](https://trade-craft-rb.vercel.app/) | `trade-craft-app` (production) | Live app for daily use |

**Vercel login:** [vercel.com/dashboard](https://vercel.com/dashboard) → account `rupendra-bukkes-projects` → email `bukke.rupendra@gmail.com` *(confirm)*

### App pages (add to base URL)

| Page | Dev | Prod |
|------|-----|------|
| Login | [Dev Login](https://trade-craft-app-git-dev-rupendra-bukkes-projects.vercel.app/login) | [Prod Login](https://trade-craft-rb.vercel.app/login) |
| Dashboard | [Dev Dashboard](https://trade-craft-app-git-dev-rupendra-bukkes-projects.vercel.app/) | [Prod Dashboard](https://trade-craft-rb.vercel.app/) |
| Watchlist | [Dev Watchlist](https://trade-craft-app-git-dev-rupendra-bukkes-projects.vercel.app/watchlist) | [Prod Watchlist](https://trade-craft-rb.vercel.app/watchlist) |

---

## Quick Links — Backends (API)

| Environment | Branch | Backend URL | Health check | Render service name |
|-------------|--------|-------------|--------------|---------------------|
| **Dev** | `dev` | [stock-intelligence-api-dev.onrender.com](https://stock-intelligence-api-dev.onrender.com) | [Dev /health](https://stock-intelligence-api-dev.onrender.com/health) | `stock-intelligence-api-dev` |
| **Production** | `main` | [stock-intelligence-api.onrender.com](https://stock-intelligence-api.onrender.com) | [Prod /health](https://stock-intelligence-api.onrender.com/health) | `stock-intelligence-api` |

**Render login:** [dashboard.render.com](https://dashboard.render.com) → email *[update me]*

Frontend calls backend via `/api/*` rewrite — you normally use the frontend URLs above, not the backend directly.

---

## Quick Links — Cloud Services & Dashboards

> **Login info:** Update this section when you change accounts. Tell the agent: *"Update README login info for [service]"*.

| Service | Dashboard | Account / username | Login email | Project / resource name |
|---------|-----------|-------------------|-------------|-------------------------|
| **GitHub** | [Repo](https://github.com/rupendra-bukke/Google-Antigravity) | `rupendra-bukke` | `bukke.rupendra@gmail.com` | `Google-Antigravity` |
| **Vercel** | [Dashboard](https://vercel.com/dashboard) | `rupendra-bukkes-projects` (team) | `bukke.rupendra@gmail.com` *(confirm)* | `trade-craft-app` |
| **Render** | [Dashboard](https://dashboard.render.com) | *[update me]* | *[update me]* | `stock-intelligence-api` (prod), `stock-intelligence-api-dev` (dev) |
| **Supabase** | [Dashboard](https://supabase.com/dashboard) | *[update me]* | *[update me]* | *[update me — your project name]* |
| **Upstash** | [Console](https://console.upstash.com) | *[update me]* | *[update me]* | Redis DB for checkpoints + cache |
| **Google AI Studio** | [API Keys](https://aistudio.google.com/apikey) | Google account | `bukke.rupendra@gmail.com` *(confirm)* | Gemini API key → `GEMINI_API_KEY` on Render |

### Trade-Craft app login (end users)

This is **not** a cloud dashboard login — it is the email/password you use inside the app at `/login`.

| Field | Value |
|-------|--------|
| **Login page (dev)** | [Dev Login](https://trade-craft-app-git-dev-rupendra-bukkes-projects.vercel.app/login) |
| **Login page (prod)** | [Prod Login](https://trade-craft-rb.vercel.app/login) |
| **Test user email** | `rupendra.test@gmail.com` |
| **Password** | *(set in Supabase → Authentication → Users — not stored in this repo)* |
| **Managed in** | [Supabase Dashboard](https://supabase.com/dashboard) → Authentication → Users |

---

## What Is This Project?

**Trade-Craft** is a full-stack **Indian index intraday market intelligence dashboard**.

It monitors Nifty 50, Bank Nifty, FinNifty, and Sensex with:

- Live technical indicators (EMA, RSI, VWAP, Bollinger Bands, MACD)
- Rule-based multi-timeframe analysis
- Google Gemini AI intraday and end-of-day outlook
- 7-checkpoint intraday timeline with win/loss review
- Expiry calendar tracking and 3 PM expiry breakout panel
- Watchlist page with market-focus cards
- Supabase email/password login

### Tech stack

| Layer | Technology | Hosted on |
|-------|-----------|-----------|
| Frontend | Next.js 14, React, TypeScript, Tailwind | Vercel |
| Backend | FastAPI, Python 3.11 | Render |
| Auth | Supabase | Supabase cloud |
| Cache / checkpoints | Upstash Redis | Upstash cloud |
| AI | Google Gemini | Google AI API |
| Market data | Yahoo Finance (`yfinance`) | Fetched by backend |
| Expiry data | NSE + BSE APIs | Fetched by backend |
| CI / automation | GitHub Actions | GitHub |

---

## Our Workflow (dev → prod)

This is the workflow we follow for every feature:

```
1. Work on `dev` branch
2. Commit + push to origin/dev
3. Test on DEV preview URL
4. If good → PR: dev → main → merge
5. Test on PROD URL
6. Back to `dev` for next feature
```

### Golden rules

- **Build in `dev`, ship in `main`**
- **Preview before public** — always test dev URL first
- **Never** push untested changes directly to `main`
- Set Supabase env vars on Vercel **Preview AND Production**
- Keep free-tier limits in mind (Render, Upstash, Gemini)

### Daily commands

```powershell
git checkout dev
git pull origin dev
# ... make changes ...
git add <files>
git commit -m "dev: <what you changed>"
git push origin dev
# → test DEV URL
```

### Release to production

```powershell
# On GitHub: create PR dev → main, review, merge
# OR via CLI:
git checkout main
git pull origin main
git merge dev
git push origin main
git checkout dev
# → test PROD URL
```

Memory tricks: `D-P-S-A-C-P` = Dev, Pull, Status, Add, Commit, Push  
Memory tricks: `Build in dev, ship in main`

### Smoke test before every prod merge

- [ ] Login works
- [ ] Dashboard loads
- [ ] Index selector works (Nifty, Bank Nifty, FinNifty, Sensex)
- [ ] Watchlist loads
- [ ] No red error panels

---

## What's Inside This Folder

```text
stock-intelligence-app/
├── backend/                  # FastAPI API server (Python)
│   ├── main.py               # App entry + scheduler
│   ├── routers/              # API routes (analyze, checkpoints)
│   ├── services/             # Business logic (AI, market data, auth)
│   └── models/               # Pydantic schemas
├── frontend/                 # Next.js dashboard (TypeScript)
│   └── src/app/
│       ├── page.tsx          # Main dashboard
│       ├── login/            # Login page
│       ├── watchlist/        # Watchlist page
│       ├── components/       # UI components
│       └── context/          # Auth + symbol state
├── releases/                 # Per-release notes (v2026.03.*, v2026.08.*)
├── README.md                 # ← THIS FILE (project hub)
└── docs (*.md)               # Detailed guides (see below)
```

### Related folders in the monorepo

| Path | Status |
|------|--------|
| `web-app-dev/stock-intelligence-app/` | **Active** — main product |
| `web-app-dev/stock-intelligence-mobile/` | Planned — Phase 2 mobile app (placeholder) |
| `web-app-dev/dhanya-diaries-app/` | Separate project |
| `web-app-dev/profile-app/` | Separate project |

---

## Documentation Map

| When you need… | Read this file |
|----------------|----------------|
| **This hub (URLs + workflow)** | `README.md` (this file) |
| **Project history + roadmap** | `PROJECT_REFERENCE_AND_ROADMAP.md` |
| **Fix login / Supabase setup** | `AUTH_SETUP.md` |
| **Daily git commands** | `FLOW_QUICK_REF.md` |
| **Full branch/deploy guide** | `BRANCH_DEPLOY_FLOW.md` |
| **Release checklist** | `RELEASE_RUNBOOK.md` |
| **What changed per version** | `CHANGELOG.md` + `releases/` |
| **Technical architecture** | `ARCHITECTURE.md` |
| **Beginner walkthrough** | `BEGINNER_SYSTEM_GUIDE.md` |
| **Which docs are active** | `DOCS_INDEX.md` |

---

## Environment Variables

### Vercel (frontend)

Set for **Preview** (dev URL) and **Production** (prod URL):

| Variable | Dev (Preview) value | Prod (Production) value |
|----------|--------------------|-----------------------|
| `BACKEND_URL` | `https://stock-intelligence-api-dev.onrender.com` | `https://stock-intelligence-api.onrender.com` |
| `NEXT_PUBLIC_SUPABASE_URL` | your Supabase project URL | same |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | your anon/publishable key | same |
| `NEXT_PUBLIC_APP_CHANNEL` | `dev` | `prod` |
| `NEXT_PUBLIC_APP_VERSION` | `vYYYY.MM.DD-NN` | `vYYYY.MM.DD-NN` |

### Render (backend)

| Variable | Required |
|----------|----------|
| `GEMINI_API_KEY` | Yes (AI panel) |
| `UPSTASH_REDIS_REST_URL` | Yes (checkpoints + cache) |
| `UPSTASH_REDIS_REST_TOKEN` | Yes |
| `SUPABASE_URL` | Yes (auth) |
| `SUPABASE_PUBLISHABLE_KEY` | Yes |
| `AUTH_REQUIRED` | `true` in prod |
| `CHECKPOINT_CRON_SECRET` | Yes (GitHub Actions cron) |
| `APP_ENV` | `development` or `production` |

Login not working? → see [AUTH_SETUP.md](./AUTH_SETUP.md)

---

## Key API Endpoints

All `/api/v1/*` routes require Supabase bearer token (except when `AUTH_REQUIRED=false` locally).

| Endpoint | Purpose |
|----------|---------|
| `GET /health` | Public health check |
| `GET /api/v1/analyze` | Basic indicators |
| `GET /api/v1/advanced-analyze` | Multi-timeframe analysis |
| `GET /api/v1/ai-decision` | Gemini AI panel |
| `GET /api/v1/checkpoints` | Timeline snapshots |
| `GET /api/v1/expiry-calendar` | Live expiry dates |
| `GET /api/v1/watchlist-snapshot` | Batched watchlist data |

---

## Local Development

### Backend

```powershell
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
# Set GEMINI_API_KEY; use AUTH_REQUIRED=false to skip login locally
uvicorn main:app --reload --port 8000
```

### Frontend

```powershell
cd frontend
npm install
copy .env.local.example .env.local
# Set BACKEND_URL=http://localhost:8000
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Release History (recent)

| Version | Date | Highlights |
|---------|------|------------|
| `v2026.08.09-01` | Aug 9, 2026 | Phase A: auth docs, FinNifty, CI, cleanup |
| `v2026.03.30-01` | Mar 30, 2026 | Supabase auth, checkpoint automation, AI snapshots |
| `v2026.03.13-01` | Mar 13, 2026 | Live NSE/BSE expiry calendar |
| `v2026.03.12-01` | Mar 12, 2026 | Watchlist MVP, memory optimizations |
| `v2026.03.08-01` | Mar 8, 2026 | EOD checkpoint reconcile |
| `v2026.03.07-02` | Mar 7, 2026 | AI panel redesign, expiry highlighting |

Full history: [CHANGELOG.md](./CHANGELOG.md)

---

## Roadmap (what's next)

| Phase | Status | Focus |
|-------|--------|-------|
| **A — Stabilize** | ✅ Done | Docs, FinNifty, CI, cleanup |
| **B — Complete UI** | Next | History page, Settings page, watchlist expansion |
| **C — Data & AI** | Planned | Backtesting, Supabase DB tables, rate limiting |
| **D — Mobile** | Planned | React Native / Expo app |
| **E — Scale** | When needed | Paid Render/Upstash tiers |

Details: [PROJECT_REFERENCE_AND_ROADMAP.md](./PROJECT_REFERENCE_AND_ROADMAP.md)

---

## GitHub Actions (automation)

| Workflow | File | Purpose |
|----------|------|---------|
| Stock Intelligence CI | `.github/workflows/stock-intelligence-ci.yml` | Python + TypeScript checks on push/PR |
| Checkpoint Capture | `.github/workflows/stock-intelligence-checkpoint-capture.yml` | Unattended intraday timeline snapshots |

---

*Trade-Craft · Built by Rupendra Bukke · Stock Intelligence Project*
