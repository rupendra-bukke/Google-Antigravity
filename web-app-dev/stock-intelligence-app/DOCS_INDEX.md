# Trade-Craft Documentation Index

This file defines which docs are active source-of-truth and which are archive/history only.

## Active Docs (Use These)

0. `README.md`
- Purpose: **project hub** — all live URLs, workflow, services, folder map, and doc index in one file.
- Use when: you need to open apps, backends, or dashboards; or remember the dev → prod workflow.

1. `PROJECT_REFERENCE_AND_ROADMAP.md`
- Purpose: single re-orientation doc — what was built, current state, gaps, and future roadmap.
- Use when: returning after time away, planning next work, or explaining the project to someone new.

2. `AUTH_SETUP.md`
- Purpose: fix login / Supabase configuration on Vercel, Render, and Supabase dashboard.
- Use when: login shows "Load failed", or setting up auth for the first time.

3. `ARCHITECTURE.md`
- Purpose: current technical architecture and runtime behavior.
- Use when: implementation decisions, debugging data flow, backend/frontend integration.

4. `BRANCH_DEPLOY_FLOW.md`
- Purpose: detailed branch strategy and deploy workflow (`dev` -> preview -> `main`).
- Use when: branch/deploy confusion, process training, team handoff.

5. `FLOW_QUICK_REF.md`
- Purpose: short command cheat-sheet for daily workflow.
- Use when: day-to-day coding and release commands.

6. `RELEASE_RUNBOOK.md`
- Purpose: pre-prod and prod release checklist.
- Use when: preparing and executing releases.

7. `CHANGELOG.md`
- Purpose: versioned production release history.
- Use when: documenting each prod push.

8. `WORKFLOW_FROM_SCRATCH.md`
- Purpose: beginner-friendly end-to-end explanation from project purpose to release cycle.
- Use when: onboarding non-technical members or anyone new to this codebase.

9. `BEGINNER_SYSTEM_GUIDE.md`
- Purpose: full from-scratch beginner guide with plain-English explanation of libraries, file roles, runtime flow, and UI section outputs.
- Use when: onboarding new/non-technical team members who need deeper clarity on what runs where and why.

10. `releases/RELEASE_NOTE_TEMPLATE.md` + `releases/*.md`
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

0. `README.md` (project hub — URLs + workflow)
1. `PROJECT_REFERENCE_AND_ROADMAP.md`
2. `AUTH_SETUP.md` (if login issues)
3. `FLOW_QUICK_REF.md`
4. `BRANCH_DEPLOY_FLOW.md`
5. `RELEASE_RUNBOOK.md`
6. `CHANGELOG.md`
7. `ARCHITECTURE.md`
8. `BEGINNER_SYSTEM_GUIDE.md`

## Rule

If two docs conflict, prefer:

1. `ARCHITECTURE.md` for technical behavior
2. `BRANCH_DEPLOY_FLOW.md` / `RELEASE_RUNBOOK.md` for process
3. `README.md` for entry-level summary
