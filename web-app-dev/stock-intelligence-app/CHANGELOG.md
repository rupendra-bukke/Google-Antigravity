# Trade-Craft Changelog

This changelog tracks production releases for `stock-intelligence-app`.

Rule (mandatory for every prod push):
- Add one entry in `## Unreleased` while testing in `dev`.
- At release time, move that entry into a versioned section and add a release note file under `releases/`.

Version format:
- `vYYYY.MM.DD-NN` (example: `v2026.03.07-01`)

## Unreleased

- _Add upcoming release notes here before merging `dev` into `main`._

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

