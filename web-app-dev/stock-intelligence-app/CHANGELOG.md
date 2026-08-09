# Trade-Craft Changelog

This changelog tracks production releases for `stock-intelligence-app`.

Rule (mandatory for every prod push):
- Add one entry in `## Unreleased` while testing in `dev`.
- At release time, move that entry into a versioned section and add a release note file under `releases/`.

Version format:
- `vYYYY.MM.DD-NN` (example: `v2026.03.07-01`)

## Unreleased

### Added
- **Data & AI Pulse** dashboard panel: daily BI/analytics brief (Power BI, Databricks, KQL, Grafana, vehicle data) via scheduled Gemini digest + RSS headlines.
- Backend `GET /api/v1/career-pulse` (cached snapshot) and cron `POST /api/v1/career-pulse/cron-generate`.
- GitHub Actions workflow `stock-intelligence-career-pulse.yml` (daily 08:00 IST).

## [v2026.08.09-05] - 2026-08-09

### Changed
- **Bloomberg-style terminal UI (Option C):** black/orange dense layout, IBM Plex Mono data fonts, flat panels, indicator table grid.
- **Page header** redesigned: split brand zone with Trade-Craft logo, larger trademark title, and page context panel with module label + clock/actions.
- **Logo assets** upgraded: 512/1024px PNG exports, retina `srcSet`, app icons, and scalable SVG master.
- Replaced Terminal Gold (Option A) after user feedback.

### Added
- `IndicatorTable` component for compact technical signal display on dashboard.
- `TradeCraftBrand` / `TradeCraftLogo` shared branding components.
- Docs: Vercel rate-limit troubleshooting when dev preview lags behind GitHub (`BRANCH_DEPLOY_FLOW.md` §4.1).

## [v2026.08.09-04] - 2026-08-09

### Added
- GitHub Actions keepalive workflow (Mon/Wed/Fri) to ping Render, Supabase Auth, and Upstash Redis during long breaks from manual app usage.
- Secure backend endpoint `GET /health/keepalive` (cron secret) for free-tier service warm-up.

## [v2026.08.09-03] - 2026-08-09

### Fixed
- Dashboard **Show chart** toggle now reliably loads and renders candlesticks (removed race that cleared fetched candles; chart container always mounts for lightweight-charts).

## [v2026.08.09-02] - 2026-08-09

### Added
- Shared build badge in sidebar (visible on all authenticated pages).
- Settings: checkpoint timeline refresh intervals, catch-up polling, candlestick chart toggle, and watchlist symbol picker.
- Optional lazy-loaded candlestick chart on dashboard (`Show chart` toggle; candles fetched only when enabled).
- Watchlist pool expanded with RELIANCE, TCS, HDFC Bank, Infosys, and SBI.

### Changed
- Checkpoint board polling now respects user settings instead of hardcoded 120s / 30s.
- Watchlist page filters symbols based on Settings preferences (localStorage, free-tier friendly).

## [v2026.08.09-01] - 2026-08-09

### Added
- FinNIFTY (`^CNXFINSERVICE`) added to dashboard index selector.
- GitHub Actions CI workflow (`stock-intelligence-ci.yml`) for Python compile and TypeScript check.
- `GEMINI_API_KEY` and `CHECKPOINT_CRON_SECRET` documented in `backend/.env.example`.
- `BACKEND_URL` added to `frontend/.env.local.example`.

### Changed
- `README.md` and `ARCHITECTURE.md` updated for Supabase auth, protected routes, and env vars.
- Removed unused frontend components: `CandlestickChart`, `AdvancedDecision`, `DecisionBadge`.

## [v2026.03.30-01] - 2026-03-30

### Added
- Secure checkpoint cron endpoints plus a repo-root GitHub Actions workflow now support unattended intraday timeline capture and end-of-day reconcile, even when no browser is open.
- Strict 3 PM expiry breakout snapshots and expiry zero-to-hero panel.
- Scheduled AI decision snapshots with EOD retention and backfill.
- Supabase email/password login, protected app shell, and bearer auth on all `/api/v1/*` routes.
- Watchlist market focus selector and improved focus refresh flow.

### Fixed
- Checkpoint board now follows the selected dashboard index instead of staying hardcoded to Nifty 50.
- Shared NSE trading-day logic now keeps EOD date selection and checkpoint TTL holiday-aware even when `exchange_calendars` is not installed.
- Checkpoint capture and scheduler paths now skip non-trading days instead of risking stale holiday saves.
- EOD AI fallback stabilized when cache is missing; EOD snapshots retained and backfilled.

### Changed
- Active docs refreshed to match the deployed data-source strategy, live expiry APIs, selected-symbol timeline behavior, and latest production release reference.
- AI panel now shows clearer payload-state cues for live checkpoint, cached EOD, partial AI, and fallback output.
- EOD mode now uses overnight-cues wording, softer fallback copy, and next-market-open refresh messaging.
- Workflow docs now record the live Render/GitHub checkpoint-automation setup, successful prod validation flow, and later secret-rotation guidance.

## [v2026.03.13-01] - 2026-03-13

### Added
- Live expiry calendar API: `GET /api/v1/expiry-calendar` using trusted exchange endpoints:
  - NSE source: `option-chain-contract-info`
  - BSE source: `ddlExpiry_IV`
- Mandatory free-tier guardrail added to core workflow docs:
  - `FLOW_QUICK_REF.md`
  - `BRANCH_DEPLOY_FLOW.md`
  - `RELEASE_RUNBOOK.md`

### Changed
- Expiry banner now uses backend live expiry API instead of local weekday-only logic.
- Expiry zero-to-hero panel now uses the same live expiry calendar to decide active expiry day.
- Fallback expiry rules updated to match current structure more closely if API is unavailable:
  - NIFTY fallback: weekly Tuesday
  - BANKNIFTY fallback: last Tuesday of month
  - FINNIFTY fallback: last Tuesday of month
  - SENSEX fallback: weekly Thursday
- Free-tier optimization:
  - backend expiry cache increased to 6 hours
  - frontend expiry polling reduced to hourly

## [v2026.03.12-01] - 2026-03-12

### Added
- Watchlist MVP page with sidebar navigation entry.
- Batched watchlist backend endpoint: `GET /api/v1/watchlist-snapshot`.
- Separate lightweight analyze cache mode for watchlist cards (no candle payload).

### Changed
- Reduced backend market-data memory footprint:
  - OHLCV numeric downcast optimization
  - per-timeframe bar caps
  - optional 1m fetch in multi-timeframe pipeline (skip 1m for lighter endpoints)
- Analyze pipeline now prefers lighter frames (`5m`/`15m`) for standard card analysis.
- AI generation output cap reduced for lower response size and memory pressure.
- Frontend auto-refresh throttled to reduce Render load:
  - dashboard polling slowed
  - checkpoint polling slowed
  - hidden-tab polling paused for key panels

### Fixed
- Reduced chance of Render free-tier memory overage caused by repeated heavy fetch/refresh cycles.
- Lowered request burst pressure from watchlist by moving to a single batched snapshot call.

## [v2026.03.08-01] - 2026-03-08

### Added
- End-of-day checkpoint reconcile automation to prevent empty timeline slots:
  - scheduled backfill runs at `15:31 IST` and `15:36 IST` on market days
  - manual reconcile endpoint: `POST /api/v1/checkpoints/reconcile?date=YYYY-MM-DD`
- Timeline UI context labels:
  - data date banner in timeline header
  - per-card board date + captured timestamp
- Environment URL references added in workflow docs:
  - `FLOW_QUICK_REF.md`
  - `BRANCH_DEPLOY_FLOW.md`

### Changed
- Checkpoint default-date selection now falls back to the latest NSE trading day on market-closed days.
- Checkpoint TTL now expires at `09:00 IST` on the next actual NSE trading day (holiday-aware).
- Timeline empty-card message for older board dates now shows `Not captured` instead of misleading catch-up text.

### Fixed
- Weekend/holiday timeline now correctly serves last trading-day snapshots instead of empty current-day slots.
- Reduced missed-slot persistence by adding automatic EOD reconciliation and retry.

## [v2026.03.07-02] - 2026-03-07

### Changed
- AI decision panel redesigned for clarity in both live and EOD modes:
  - cleaner section hierarchy
  - clearer labels and readability
  - improved reasoning visibility
- AI prompt strengthened to explicitly consider global macro/geopolitical context.
- Option-action guidance added in AI panel:
  - `BUY CE` for bullish setups
  - `BUY PE` for bearish setups
  - `NO TRADE` for wait setups

### Added
- Suggested option-side guidance tile in trade-plan area (applies to both live and EOD modes).
- Expiry section redesign with stronger dynamic highlighting:
  - explicit `Expiry Today` highlighting
  - urgency-sorted cards
  - clearer status, hint text, and progress visuals

## [v2026.03.07-01] - 2026-03-07

### Added
- Expiry banner moved to production and validated.
- Workflow docs added and improved:
  - `RELEASE_RUNBOOK.md`
  - `BRANCH_DEPLOY_FLOW.md`
  - `FLOW_QUICK_REF.md`
  - `DOCS_INDEX.md`

### Changed
- Dashboard layout updated: indicators strip moved above checkpoint timeline.
- Core docs refreshed (`README.md`, `ARCHITECTURE.md`).
- Legacy docs marked archived with clear warning banners.
