# Vercel Deploy Stuck — Fix Guide

If GitHub shows a new commit but **prod** or **dev** URLs still show an old build badge (for example `86864BC` instead of `2EBC723`), use this checklist.

## Two separate deploys (common confusion)

| Layer | Host | What it serves | How to verify |
|-------|------|----------------|---------------|
| **Frontend (UI)** | Vercel | Pages, logo, Data & AI Pulse panel | Build badge in sidebar: `Main \| XXXXXXX` |
| **Backend (API)** | Render | `/api/v1/*`, career pulse, AI, checkpoints | `/health` → `git_commit` |

They deploy **independently**. GitHub can be latest while only one layer updated.

## Current expected state (check live)

**GitHub:** `main` and `dev` → `2ebc723`

**Render (API) — should already be latest:**
- Prod: https://stock-intelligence-api.onrender.com/health → `"git_commit": "2ebc723"`
- Dev: https://stock-intelligence-api-dev.onrender.com/health → `"git_commit": "2ebc723"`

**Vercel (UI) — often stuck on older commit:**
- Last **successful** deploy: `4df0b2a` (includes Data & AI Pulse + Bloomberg UI)
- Latest `2ebc723` may show **rate limited** on GitHub commit status

## Why Vercel does not auto-deploy

This repo is linked to **3 Vercel projects** (`trade-craft-app`, `dhanya-diaries`, `binita-profile`). **Each git push tries to deploy all three**, which hits the **Hobby plan daily limit**:

```text
Deployment rate limited — retry in 24 hours.
```

After the limit, **Production stays on the last successful deployment** until you redeploy manually or the limit resets (~24 hours).

## Fix A — Manual redeploy (do this first)

1. Open https://vercel.com/dashboard → **trade-craft-app**
2. Go to **Deployments**
3. Find commit **`2ebc723`** (or **`4df0b2a`** if latest still rate-limited)
4. Click **⋯** → **Redeploy** → confirm
5. Wait 2–4 minutes until status is **Ready**
6. Hard-refresh the app: `Ctrl+Shift+R` / `Cmd+Shift+R`

**Dev preview:** same project → filter branch `dev` → redeploy latest.

If redeploy fails with **rate limited**, wait until the message clears (check GitHub → commit → status checks) or try again the next day.

## Fix B — Stop wasting deploy quota (one-time setup)

In Vercel, for **`dhanya-diaries`** and **`binita-profile`** (not Trade-Craft):

1. Project → **Settings** → **Git**
2. Turn off **Automatic deployments** for Preview (or disconnect repo if unused)

This repo now includes `ignoreCommand` in each app's `vercel.json` so unchanged apps **skip** builds on push — only Trade-Craft builds when its folder changes.

## Fix C — Confirm after redeploy

| Check | Expected |
|-------|----------|
| Sidebar badge | `Main \| 2EBC723` (prod) or `Dev \| 2EBC723` (preview) |
| Data & AI Pulse | Loads without HTTP 404 |
| Render `/health` | `git_commit` = `2ebc723`, job `career_pulse_0800` present |

## Fix D — Render backend only (if API 404)

If UI is new but API returns 404:

1. https://dashboard.render.com
2. **stock-intelligence-api** and **stock-intelligence-api-dev**
3. **Manual Deploy** → **Deploy latest commit**

## Still stuck?

Run locally to use latest code immediately:

```bash
cd web-app-dev/stock-intelligence-app/frontend
git pull origin dev
npm install
npm run dev
```

Set `BACKEND_URL=https://stock-intelligence-api-dev.onrender.com` in `.env.local`.
