# Trade-Craft Documentation Index

This file defines which docs are active source-of-truth and which are archive/history only.

## Active Docs (Use These)

1. `README.md`
- Purpose: project entry point, setup, architecture summary, API overview.
- Use when: onboarding, setup, quick understanding of current app.

2. `ARCHITECTURE.md`
- Purpose: current technical architecture and runtime behavior.
- Use when: implementation decisions, debugging data flow, backend/frontend integration.

3. `BRANCH_DEPLOY_FLOW.md`
- Purpose: detailed branch strategy and deploy workflow (`dev` -> preview -> `main`).
- Use when: branch/deploy confusion, process training, team handoff.

4. `FLOW_QUICK_REF.md`
- Purpose: short command cheat-sheet for daily workflow.
- Use when: day-to-day coding and release commands.

5. `RELEASE_RUNBOOK.md`
- Purpose: pre-prod and prod release checklist.
- Use when: preparing and executing releases.

6. `CHANGELOG.md`
- Purpose: versioned production release history.
- Use when: documenting each prod push.

7. `releases/RELEASE_NOTE_TEMPLATE.md` + `releases/*.md`
- Purpose: detailed per-release notes for each production deployment.
- Use when: every release cycle.

## Archived Docs (Read for Context Only)

1. `PROJECT_OUTLINE.md`
- Status: archived (contains stale workflow/section references).

2. `PROJECT_TECHNICAL_LOG.md`
- Status: archived (historical implementation narrative, not current source-of-truth).

3. `STOCK_APP_JOURNEY.md`
- Status: archived (project story/context, not implementation spec).

## Recommended Reference Order

1. `FLOW_QUICK_REF.md`
2. `BRANCH_DEPLOY_FLOW.md`
3. `RELEASE_RUNBOOK.md`
4. `CHANGELOG.md`
5. `ARCHITECTURE.md`
6. `README.md`

## Rule

If two docs conflict, prefer:

1. `ARCHITECTURE.md` for technical behavior
2. `BRANCH_DEPLOY_FLOW.md` / `RELEASE_RUNBOOK.md` for process
3. `README.md` for entry-level summary

