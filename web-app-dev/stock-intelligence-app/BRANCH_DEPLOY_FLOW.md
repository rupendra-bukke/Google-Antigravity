# Branch + Deploy Flow (From Scratch)

For a non-technical end-to-end explanation of product sections and data flow, see:
- `WORKFLOW_FROM_SCRATCH.md`

This guide explains your exact workflow using one repo with two branches:
- `dev` for building and testing
- `main` for production releases

It includes:
- Step-by-step commands
- Meaning of each command
- Memory tricks to remember quickly

## 0) Core idea in one line

You do not have separate dev/prod folders or repos.
You have one repo, same files, different branch versions.

Memory trick:
- `D = Draft` -> `dev`
- `M = Market` -> `main`

## 1) Create repo from scratch

```powershell
# Create project folder
mkdir stock-intelligence-app
cd stock-intelligence-app

# Initialize git with main branch
git init -b main

# Add all files to staging
git add .

# First commit
git commit -m "initial commit"

# Connect local repo to GitHub repo
# Replace URL with your own
git remote add origin https://github.com/<username>/<repo>.git

# Push main to GitHub
git push -u origin main

# Create dev branch from main
git checkout -b dev

# Push dev to GitHub
git push -u origin dev
```

Meaning:
- `git init -b main` creates your repo and makes `main` the default branch
- `git remote add origin ...` links local to GitHub
- `git checkout -b dev` creates development branch

Memory trick:
- "I-C-R-P-D" = Init, Connect, Raise first push, Prepare dev

## 2) Set deployment mapping (one-time)

In Vercel:
- Production Branch = `main`
- Preview deployments come from `dev` commits/PRs

Set env vars:
- Production env: `BACKEND_URL = <prod-backend-url>`
- Preview env: `BACKEND_URL = <dev-backend-url>`
- Production env: `NEXT_PUBLIC_APP_CHANNEL = prod`
- Preview env: `NEXT_PUBLIC_APP_CHANNEL = dev`
- Both envs: `NEXT_PUBLIC_APP_VERSION = vYYYY.MM.DD-NN` (bump every release)
- Optional (for short git id on UI): `NEXT_PUBLIC_GIT_SHA = <short-sha>`

For unattended timeline checkpoint automation:
- Render dev service `stock-intelligence-api-dev` needs `CHECKPOINT_CRON_SECRET`
- Render prod service `stock-intelligence-api` needs `CHECKPOINT_CRON_SECRET`
- GitHub repository secrets needed by `.github/workflows/stock-intelligence-checkpoint-capture.yml`:
  - `CHECKPOINT_CRON_DEV_BASE_URL`
  - `CHECKPOINT_CRON_DEV_SECRET`
  - `CHECKPOINT_CRON_PROD_BASE_URL`
  - `CHECKPOINT_CRON_PROD_SECRET`
- Base URL secrets must use backend root URLs only, not `/health` or `/api/v1/...`
- If a secret is ever exposed, rotate the value later but keep the same secret names

Current app URLs:
- Dev (Vercel Preview): `https://trade-craft-app-git-dev-rupendra-bukkes-projects.vercel.app/`
- Prod (Vercel Production): `https://trade-craft-rb.vercel.app/`

Meaning:
- Preview tests stay safe (do not hit prod backend)
- Header now shows `Build DEV|PROD | version` so you can validate correct deployment quickly.

Memory trick:
- "Preview points to Practice"
- "Production points to Public"

## 3) Daily development flow (dev branch)

```powershell
# Go to project
cd d:\GitHub\Google-Antigravity\web-app-dev\stock-intelligence-app

# Move to dev branch
git checkout dev

# Pull latest dev updates
git pull origin dev

# Check branch and file status
git status -sb

# (Recommended) bump release version for the dev validation cycle
# Example:
# setx NEXT_PUBLIC_APP_VERSION v2026.03.08-03

# Stage only the files you changed
git add frontend/src/app/components/ExpiryBanner.tsx

# Commit with clear message
git commit -m "dev: update expiry banner UI"

# Push to GitHub dev branch
git push origin dev
```

Meaning:
- This updates `origin/dev`
- Vercel generates/updates Preview URL from latest dev commit

Memory trick:
- "C-P-S-C-P" = Checkout, Pull, Status, Commit, Push
- "If not pushed, not previewed"

## 4) Test on Vercel Preview

After pushing `dev`:
- Open preview URL
- Check your changed section
- Run quick smoke tests (load, refresh, no errors)

Meaning:
- You validate before touching production

Memory trick:
- "Preview first, public later"

## 5) Move changes to production

Option A (recommended): GitHub PR
- Create PR: `dev -> main`
- Review and merge
- Vercel production deploy starts automatically

Option B: CLI merge

```powershell
# Switch to main
git checkout main

# Update local main
git pull origin main

# Merge dev changes into main
git merge dev

# Push main to GitHub (triggers prod deploy)
git push origin main

# Return to dev for next work
git checkout dev
```

Meaning:
- You are not moving folders; you are moving branch history

Memory trick:
- "Build in dev, ship in main"
- "Merge is the bridge"

## 6) Fast recovery commands (if confused)

```powershell
# See current branch
git branch --show-current

# See all branches
git branch --all

# See what is uncommitted
git status -sb

# See commits not in main yet
git log --oneline main..dev
```

Memory trick:
- "When confused: Branch, Status, Log"

## 6.1) How to confirm "Switched back to dev"

Run:

```powershell
git branch --show-current
```

Expected output:

```text
dev
```

Alternative checks:

```powershell
git status -sb   # first line should start with: ## dev
git branch       # current branch has * in front, e.g. * dev
```

Memory trick:
- "Show-Current = Single Truth"
- "Star means where you are now"

## 7) Your exact real-world mini example

Goal: Add one small text change in expiry banner.

```powershell
# 1) Work on dev
git checkout dev
git pull origin dev

# 2) Edit file
# frontend/src/app/components/ExpiryBanner.tsx

# 3) Save + commit + push
git add frontend/src/app/components/ExpiryBanner.tsx
git commit -m "dev: tweak expiry text"
git push origin dev

# 4) Test Vercel Preview URL

# 5) Promote to prod
git checkout main
git pull origin main
git merge dev
git push origin main
git checkout dev
```

Memory trick:
- "Edit -> Preview -> Promote"

## 8) Common misunderstandings

Q: "Do I need separate dev folder?"
A: No. Same folder, branch switch changes file version.

Q: "Do I need separate GitHub dev repo?"
A: No. Same repo, separate branches.

Q: "How do prod files change?"
A: Merge `dev` into `main` and push `main`.

## 9) Golden rule

Never code directly in `main` for normal feature work.
Always:
1. build in `dev`
2. test in Preview
3. merge to `main`
4. keep every feature free-tier safe across all providers (Vercel, Render, Upstash, AI APIs) by using caching, throttled refresh, and efficient API usage

Memory trick:
- "No direct main unless emergency"
- "If it burns free-tier, redesign before release"
