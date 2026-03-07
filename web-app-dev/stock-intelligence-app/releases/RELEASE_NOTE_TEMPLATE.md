# Release Note Template

## Version

- `vYYYY.MM.DD-NN`

## Date

- `YYYY-MM-DD`

## Branch and Commit Info

- Source branch: `dev`
- Target branch: `main`
- Dev commit(s):
- Main merge commit:

## Summary

- What was released:
- Why:
- Impacted areas:

## Changes

### Added
- 

### Changed
- 

### Fixed
- 

## Validation (must be checked)

- [ ] Preview tested on Vercel
- [ ] Production smoke test completed
- [ ] Core APIs healthy (`/health`, `/api/v1/analyze`, `/api/v1/checkpoints/diag`)
- [ ] No blocking UI regressions

## Rollback

- Previous stable main commit:
- Rollback command reference:
  - `git checkout main`
  - `git revert <merge_commit_sha>` (preferred safe rollback)
  - `git push origin main`

## Notes

- Known limitations:
- Follow-up tasks:

