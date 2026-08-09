# Trade-Craft — Project Reference & Roadmap

> **Purpose:** Single document to re-orient yourself after time away from the project.  
> **Last updated:** 2026-08-09  
> **Current `main` head:** `d1a5b17` (Supabase API auth protection)  
> **Live prod:** [trade-craft-rb.vercel.app](https://trade-craft-rb.vercel.app/)

---

## 1. What Is This Project?

**Trade-Craft** is a full-stack **Indian index intraday market intelligence dashboard**. It helps a trader monitor Nifty 50, Bank Nifty, Sensex (and FinNifty via API) with:

- Live technical indicators (EMA, RSI, VWAP, Bollinger Bands, MACD)
- Rule-based multi-timeframe analysis
- Google Gemini AI intraday and end-of-day outlook
- A 7-checkpoint intraday timeline with win/loss review
- Expiry calendar tracking and a 3 PM expiry breakout panel
- A watchlist page with market-focus cards

The app is designed to run **entirely on free-tier cloud services** (Vercel + Render + Upstash Redis + Supabase Auth).

---

## 2. What We Built — Timeline of Work

Project active period: **Feb 20 – Mar 30, 2026** (~5 weeks of intensive development).

### Phase 1 — Foundation (Late Feb 2026)

| What | Details |
|------|---------|
| **Backend engine** | FastAPI server fetching OHLCV from Yahoo Finance (`yfinance`), computing indicators |
| **Frontend shell** | Next.js 14 dashboard with glassmorphic dark UI, index selector, IST clock |
| **Decision engine v1** | Basic rule-based buy/sell signals from indicators |
| **Decision engine v2** | 6-step multi-timeframe pipeline (HTF trend → structure → scalp → strike → risk → forecast) |
| **Cloud deploy** | Render (backend) + Vercel (frontend) + GitHub as source of truth |
| **Branding** | Named "Trade-Craft" with custom RB logo in sidebar |

### Phase 2 — Intelligence Layer (Early Mar 2026)

| What | Details |
|------|---------|
| **AI decision panel** | Gemini-powered intraday analysis with structured JSON output |
| **EOD mode** | Post-market next-day outlook when NSE is closed |
| **AI prompt tuning** | Macro/geopolitical context, option-side guidance (BUY CE / BUY PE / NO TRADE) |
| **Checkpoint timeline** | 7 IST snapshots (09:15, 09:30, 10:00, 11:30, 13:00, 14:00, 15:00) stored in Upstash Redis |
| **Win/loss review** | Compare checkpoint signals against actual price movement |
| **Candlestick chart** | Built with `lightweight-charts` (later removed from dashboard to reduce load) |

### Phase 3 — Expiry & Automation (Mid Mar 2026)

| What | Details |
|------|---------|
| **Expiry banner** | Live NSE/BSE expiry calendar via `GET /api/v1/expiry-calendar` |
| **Expiry zero-to-hero panel** | Strict 3 PM CE/PE breakout snapshots on expiry days |
| **EOD reconcile** | Auto backfill at 15:31 and 15:36 IST so timeline slots are never empty |
| **Holiday awareness** | Manual `NSE_HOLIDAYS_2026` set; trading-day logic for checkpoint TTL and EOD date |
| **Checkpoint automation** | GitHub Actions cron workflow wakes Render and captures checkpoints unattended |
| **AI snapshot scheduling** | Saved AI decisions at 10:00, 14:30 IST; EOD at 15:30 IST |

### Phase 4 — Scale & Polish (Late Mar 2026)

| What | Details |
|------|---------|
| **Watchlist MVP** | `/watchlist` page with batched `GET /api/v1/watchlist-snapshot` |
| **Market focus selector** | Indices + individual stock (`JPPOWER.NS`) with live/EOD trend cards |
| **Free-tier optimization** | Memory downcast, bar caps, slower polling (180s dashboard), hidden-tab pause |
| **Process docs** | `DOCS_INDEX`, `RELEASE_RUNBOOK`, `BRANCH_DEPLOY_FLOW`, `BEGINNER_SYSTEM_GUIDE` |
| **Versioned releases** | `v2026.03.07` through `v2026.03.13` with per-release notes in `releases/` |

### Phase 5 — Security (Mar 30, 2026 — latest)

| What | Details |
|------|---------|
| **Supabase login** | Email/password auth on `/login` |
| **Protected app shell** | `AppShell.tsx` redirects unauthenticated users |
| **API bearer auth** | All `/api/v1/*` routes require `Authorization: Bearer <supabase_jwt>` |
| **Cron secret** | Checkpoint endpoints use `X-Checkpoint-Cron-Secret` header (separate from user auth) |
| **Local dev bypass** | `AUTH_REQUIRED=false` in backend `.env` for offline work |

---

## 3. Current Architecture (As of Aug 2026)

```
┌─────────────────────────────────────────────────────────────┐
│  Browser (PWA-capable)                                      │
│  Next.js 14 + React + Tailwind — Vercel                     │
│  Pages: / (dashboard) · /watchlist · /login                 │
└──────────────────────────┬──────────────────────────────────┘
                           │ /api/* rewrite → BACKEND_URL
                           │ Authorization: Bearer <jwt>
┌──────────────────────────▼──────────────────────────────────┐
│  FastAPI — Render (Singapore, free tier)                    │
│  Routers: analyze.py · checkpoints.py                       │
│  Services: market_data · decision · decision_v2 ·           │
│            ai_decision · checkpoint_store · stock_focus ·   │
│            auth_guard                                       │
│  Scheduler: APScheduler (in-process IST jobs)               │
└──────┬──────────────┬──────────────┬────────────────────────┘
       │              │              │
  yfinance      Google Gemini    Upstash Redis
  (market data)  (AI analysis)   (checkpoints, caches)
       │
  NSE/BSE APIs (expiry calendar)
       │
  Supabase Auth REST (JWT validation)
```

### Key API Endpoints

| Endpoint | Purpose |
|----------|---------|
| `GET /api/v1/analyze` | Basic indicators + combined signal |
| `GET /api/v1/advanced-analyze` | 6-step multi-TF pipeline |
| `GET /api/v1/ai-decision` | Gemini intraday or EOD outlook |
| `GET /api/v1/expiry-calendar` | Live NSE/BSE expiry dates |
| `GET /api/v1/expiry-zero-hero` | 3 PM expiry breakout snapshot |
| `GET /api/v1/watchlist-snapshot` | Batched watchlist cards |
| `GET /api/v1/market-focus` | Focus stock/index trend |
| `GET /api/v1/checkpoints` | Timeline snapshots for a date |
| `POST /api/v1/checkpoints/reconcile` | Manual EOD backfill |
| `GET /health` | Public health check |

### Data Stores

| System | What it holds |
|--------|---------------|
| **Upstash Redis** | Checkpoint snapshots, AI cache, analyze cache, stock focus cache |
| **Supabase Auth** | User sessions only — no app data tables in codebase |

### Deployment URLs

| Environment | Frontend | Backend |
|-------------|----------|---------|
| **Production** | [trade-craft-rb.vercel.app](https://trade-craft-rb.vercel.app/) | `stock-intelligence-api.onrender.com` |
| **Dev preview** | `trade-craft-app-git-dev-rupendra-bukkes-projects.vercel.app` | `stock-intelligence-api-dev.onrender.com` |

### Branch Strategy

| Branch | Deploys to |
|--------|------------|
| `dev` | Vercel Preview + Render dev |
| `main` | Vercel Production + Render prod |

Workflow: develop on `dev` → validate preview → merge to `main` → follow `RELEASE_RUNBOOK.md`.

---

## 4. Dashboard UI — What You See Today

Order of sections on the main dashboard (`frontend/src/app/page.tsx`):

1. Header — branding, IST clock, manual refresh, build badge
2. Index selector — Nifty 50, Bank Nifty, FinNifty, Sensex
3. Market status banner — open/closed + holiday overlay
4. Expiry banner — countdown to next expiry per index
5. Stock header — live price + timestamp
6. AI decision panel — Gemini intraday/EOD with checkpoint-aware refresh
7. Expiry zero-to-hero panel — 3 PM breakout on expiry days
8. Indicators strip — EMA, RSI, VWAP, BB, MACD + majority-vote signal
9. Checkpoint timeline — 7 intraday cards + win/loss review
10. Footer — last refresh time

Sidebar navigation: **Dashboard** (live), **Watchlist** (live), **History** (live), **Settings** (live).

---

## 5. Known Gaps & Technical Debt

These are intentional deferrals or unfinished items as of the latest commit:

| Gap | Status |
|-----|--------|
| **No automated tests** | Manual smoke tests only (`py_compile`, `tsc --noEmit`, URL checks) |
| **Auth docs stale** | Resolved in `v2026.08.09-01` — `README.md` and `ARCHITECTURE.md` updated |
| **FinNifty not in index selector** | Resolved in `v2026.08.09-01` |
| **Checkpoint capture scope** | Auto-capture only for `^NSEI` and `^NSEBANK`; Sensex/FinNifty manual only |
| **Dead/orphan components** | Resolved in `v2026.08.09-01` — removed unused chart/decision components |
| **History & Settings pages** | Nav stubs with "Coming soon" |
| **Mobile app** | `stock-intelligence-mobile/` is a placeholder README only |
| **Unreleased changelog items** | Resolved — versioned as `v2026.03.30-01` and `v2026.08.09-01` |
| **No CI for lint/build** | Resolved in `v2026.08.09-01` — `stock-intelligence-ci.yml` added |
| **Render cold start** | Free tier sleeps after ~15 min idle; first request takes ~30s |

---

## 6. Future Roadmap

Prioritized by impact and dependency order. Each phase can be a separate `dev` → `main` release cycle.

### Phase A — Stabilize & Document (Short term) ✅ Completed in `v2026.08.09-01`

**Goal:** Bring docs and tooling in line with what is actually deployed.

- [x] Update `README.md` and `ARCHITECTURE.md` for Supabase auth layer
- [x] Version and release current `CHANGELOG.md` unreleased items (`v2026.03.30-01` + `v2026.08.09-01`)
- [x] Add `GEMINI_API_KEY` to `backend/.env.example`
- [x] Wire or remove dead components (`CandlestickChart`, `AdvancedDecision`, `DecisionBadge`)
- [x] Add FinNifty to `IndexSelector.tsx` (API already supports it)
- [x] Add GitHub Actions workflow for `tsc --noEmit` + `py_compile` on PR/push

### Phase B — Feature Completion (Medium term)

**Goal:** Finish the UI promises already visible in the app.

- [ ] **History page** — browse past checkpoint timelines by date; query Redis archives
- [ ] **Settings page** — user preferences (default index, refresh interval, notification toggles)
- [ ] **Extend checkpoint capture** — add Sensex (`^BSESN`) and FinNifty (`^CNXFINSERVICE`) to scheduler
- [ ] **Re-enable candlestick chart** — optional toggle on dashboard (lazy-load to protect free tier)
- [ ] **Watchlist expansion** — add more stocks beyond `JPPOWER.NS`; user-editable watchlist stored in Supabase DB
- [ ] **Alerting** — email or push when AI signal changes at a checkpoint (Supabase Edge Functions or similar)

### Phase C — Data & AI Improvements (Medium term)

**Goal:** Make analysis more reliable and auditable.

- [ ] **Backtesting module** — replay checkpoint signals against historical data; accuracy metrics per engine
- [ ] **AI model versioning** — track which Gemini model/prompt produced each snapshot
- [ ] **Fallback data source** — re-evaluate `tvDatafeed` on a paid Render plan or use NSE official API
- [ ] **Supabase database tables** — persist user watchlists, alert preferences, and historical AI outputs beyond Redis TTL
- [ ] **Rate limiting** — protect API from abuse now that auth is required

### Phase D — Mobile App (Long term — Phase 2)

**Goal:** Native mobile experience sharing the same backend.

- [ ] Scaffold Expo/React Native app in `stock-intelligence-mobile/`
- [ ] Reuse Supabase auth flow
- [ ] Core screens: dashboard summary, AI panel, checkpoint timeline, watchlist
- [ ] Push notifications for checkpoint captures and signal changes

### Phase E — Scale Beyond Free Tier (When needed)

**Goal:** Remove free-tier constraints when usage justifies cost.

- [ ] Upgrade Render to paid plan (no cold starts, more RAM for `tvDatafeed`)
- [ ] Upgrade Upstash Redis tier if checkpoint history grows
- [ ] Custom domain for Vercel production
- [ ] Staging environment with dedicated Redis instance

---

## 7. How to Get Back Up to Speed

### If you forgot the dev workflow

1. Read `FLOW_QUICK_REF.md` — daily commands and environment URLs
2. Read `BRANCH_DEPLOY_FLOW.md` — dev → preview → main process
3. Read `RELEASE_RUNBOOK.md` — before any prod push

### If you forgot how the code works

1. Read `BEGINNER_SYSTEM_GUIDE.md` — plain-English file-by-file walkthrough
2. Read `ARCHITECTURE.md` — technical data flow (note: auth section needs update)
3. Read `CHANGELOG.md` + `releases/` — what changed in each release

### If you forgot the project story

1. Read `STOCK_APP_JOURNEY.md` — archived narrative with analogies (Feb 2026 snapshot)

### Local setup (quick)

```bash
# Backend
cd web-app-dev/stock-intelligence-app/backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # set GEMINI_API_KEY, AUTH_REQUIRED=false for local
uvicorn main:app --reload --port 8000

# Frontend (separate terminal)
cd web-app-dev/stock-intelligence-app/frontend
npm install
cp .env.local.example .env.local   # set BACKEND_URL=http://localhost:8000
npm run dev
```

Open `http://localhost:3000`. With `AUTH_REQUIRED=false`, no login needed locally.

---

## 8. Release History at a Glance

| Version | Date | Highlights |
|---------|------|------------|
| `v2026.03.07-01` | Mar 7 | Expiry banner to prod; workflow docs added |
| `v2026.03.07-02` | Mar 7 | AI panel redesign; option-side guidance; expiry highlighting |
| `v2026.03.08-01` | Mar 8 | EOD checkpoint reconcile automation |
| `v2026.03.12-01` | Mar 12 | Watchlist MVP; memory optimizations; polling throttle |
| `v2026.03.13-01` | Mar 13 | Live NSE/BSE expiry calendar API |
| *(unreleased)* | Mar 19–30 | Checkpoint automation, AI snapshots, expiry zero-hero, Supabase auth → **`v2026.03.30-01`** |
| `v2026.08.09-01` | Aug 9 | Phase A stabilization: auth docs, FinNifty selector, CI, cleanup |

Full details: `CHANGELOG.md` and `releases/v*.md`.

---

## 9. Free-Tier Guardrails (Do Not Break)

These constraints keep the app running at zero cost. Any new feature must respect them:

| Constraint | Mitigation already in place |
|------------|----------------------------|
| Render sleeps after 15 min | GitHub Actions cron wakes it; checkpoint catch-up on next request |
| Render 512 MB RAM limit | `tvdatafeed` removed; OHLCV downcast; bar caps; skip 1m for light endpoints |
| Upstash ~10k commands/day | Checkpoint TTL to next trading day; 6h expiry cache; ~50 commands/day actual |
| Vercel serverless limits | API proxied to Render; no heavy compute on Vercel |
| Gemini API cost | Cached AI responses; scheduled snapshots; reduced `maxOutputTokens` |

See `BRANCH_DEPLOY_FLOW.md` and `RELEASE_RUNBOOK.md` for the mandatory free-tier checklist on every release.

---

## 10. Document Map

| When you need… | Read this |
|----------------|-----------|
| **This overview + roadmap** | `PROJECT_REFERENCE_AND_ROADMAP.md` (this file) |
| Quick daily commands | `FLOW_QUICK_REF.md` |
| Onboarding from scratch | `BEGINNER_SYSTEM_GUIDE.md` → `WORKFLOW_FROM_SCRATCH.md` |
| Technical architecture | `ARCHITECTURE.md` |
| Release process | `RELEASE_RUNBOOK.md` |
| What changed per version | `CHANGELOG.md` + `releases/` |
| Full doc index | `DOCS_INDEX.md` |

---

*Built for Rupendra Bukke · Trade-Craft Stock Intelligence Project*
