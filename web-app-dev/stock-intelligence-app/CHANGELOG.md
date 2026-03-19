# Trade-Craft Changelog

This changelog tracks production releases for `stock-intelligence-app`.

Rule (mandatory for every prod push):
- Add one entry in `## Unreleased` while testing in `dev`.
- At release time, move that entry into a versioned section and add a release note file under `releases/`.

Version format:
- `vYYYY.MM.DD-NN` (example: `v2026.03.07-01`)

## Unreleased

### Added
- Secure checkpoint cron endpoints plus a repo-root GitHub Actions workflow now support unattended intraday timeline capture and end-of-day reconcile, even when no browser is open.

### Fixed
- Checkpoint board now follows the selected dashboard index instead of staying hardcoded to Nifty 50.
- Shared NSE trading-day logic now keeps EOD date selection and checkpoint TTL holiday-aware even when `exchange_calendars` is not installed.
- Checkpoint capture and scheduler paths now skip non-trading days instead of risking stale holiday saves.

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
