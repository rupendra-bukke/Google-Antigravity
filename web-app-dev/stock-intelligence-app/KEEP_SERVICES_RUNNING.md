# Keep Trade-Craft running

Use this when you have been away from the app and want it to work the next time you open it.

You do **not** need to use the app every day. A short weekly check is enough. Scheduled jobs cover the rest, as long as GitHub Actions keeps running.

Last updated: 2026-11-09

---

## What each service does

| Service | What breaks if it goes quiet | What “quiet” actually means |
|---------|------------------------------|-----------------------------|
| **Vercel** (website) | The site at [trade-craft-rb.vercel.app](https://trade-craft-rb.vercel.app/) does not open | The free site does not pause the way Supabase does. No weekly visit is required just to keep Vercel alive. |
| **Render** (API) | Dashboard data, AI, checkpoints, watchlist | Free services **sleep after about 15 minutes** with no traffic. The service is not deleted. The first open can take about a minute while it wakes up. |
| **Supabase** (login) | Sign-in. The red “Cannot reach Supabase” box is this, not a wrong password. | Free projects **pause after about 7 days** with no API calls. A paused project that sits too long can be **removed**. After removal, the old project address no longer exists. |
| **Upstash Redis** | Saved checkpoints, cached AI snapshots, Data & AI Pulse | The keepalive job touches Redis so it is not left idle for weeks. |
| **GitHub Actions** | All of the automatic wakes above | GitHub **turns off scheduled workflows after about 60 days** with no activity on the repository. After that, nothing wakes Render or Supabase until you turn the workflows back on. |

Production URLs:

- App: https://trade-craft-rb.vercel.app/login
- API health: https://stock-intelligence-api.onrender.com/health
- Dev app (preview only): https://trade-craft-app-git-dev-rupendra-bukkes-projects.vercel.app/
- Dev API health: https://stock-intelligence-api-dev.onrender.com/health

Dashboards:

- Supabase: https://supabase.com/dashboard
- Render: https://dashboard.render.com
- Vercel: https://vercel.com/dashboard
- GitHub Actions: https://github.com/rupendra-bukke/Google-Antigravity/actions

---

## What already runs without you

These workflows live in `.github/workflows/`. Times below are **IST**.

| Workflow | When | What it does |
|----------|------|----------------|
| `stock-intelligence-checkpoint-capture.yml` | Weekdays during market hours (about 09:17, 09:32, 10:02, 11:32, 13:02, 14:02, 15:02, 15:37 IST) | Wakes Render and saves the checkpoint timeline |
| `stock-intelligence-ai-snapshot.yml` | Weekdays 10:00, 14:30, and 15:30 IST | Wakes Render and stores the AI snapshots |
| `stock-intelligence-career-pulse.yml` | Every day 08:00 IST | Wakes Render and refreshes Data & AI Pulse |
| `stock-intelligence-keepalive.yml` | **Monday, Wednesday, Friday at 09:45 IST** | Wakes **prod and dev** Render, calls Supabase Auth, and writes a small key in Upstash |

The keepalive call is `GET /health/keepalive` with the cron secret. It reuses the GitHub secrets already used by checkpoints:

- `CHECKPOINT_CRON_PROD_BASE_URL`
- `CHECKPOINT_CRON_PROD_SECRET`
- `CHECKPOINT_CRON_DEV_BASE_URL`
- `CHECKPOINT_CRON_DEV_SECRET`

Those base URLs must be the Render root only, for example `https://stock-intelligence-api.onrender.com`, not `/health`.

You do **not** need to:

- Leave a browser tab open
- Open the Render dashboard every day
- Redeploy, unless environment variables change or you create a new Supabase project

---

## What you should do yourself

### Once a week (about two minutes)

1. Open https://trade-craft-rb.vercel.app/login and **sign in once**.
2. Open the [Supabase dashboard](https://supabase.com/dashboard).
3. Confirm the project status is **Active**.
4. If it says **Paused**, click **Restore** the same day. Do not leave it paused.

Signing in is the real check that Vercel, Render, and Supabase are connected. The Monday/Wednesday/Friday job only helps while the Supabase project still exists.

### Once a month (about two minutes)

1. Open https://github.com/rupendra-bukke/Google-Antigravity/actions
2. Open **Stock Intelligence Keepalive**
3. Confirm the latest run is **green**
4. If GitHub says scheduled workflows are disabled, turn them back on. Then run **Stock Intelligence Keepalive** once with **Run workflow** → target **both**.

Also glance at these if the dashboard looks empty on a market day:

- **Stock Intelligence Checkpoint Capture**
- **Stock Intelligence AI Snapshot**
- **Stock Intelligence Career Pulse**

A red run means that job did not finish. The site can still open. The missing piece is whatever that job saves (timeline, AI text, or the daily pulse).

---

## If login shows “Cannot reach Supabase”

That message means the browser could not reach the Supabase project. It is not an incorrect password.

Do this in order:

1. Supabase dashboard → if the project is **Paused**, click **Restore**, wait until it is Active, then try login again.
2. If the project is **gone**, create a new project (or restore one if Supabase still offers that).
3. In the new project, **Project Settings → API**, copy:
   - Project URL (`https://YOUR_PROJECT_REF.supabase.co`)
   - Publishable key, or the anon key
4. **Authentication → Users**: create your login again (for example `rupendra.test@gmail.com`) if this is a new project. The old user does not come back automatically.
5. **Authentication → URL Configuration**:
   - Site URL: `https://trade-craft-rb.vercel.app`
   - Redirect URLs:
     - `https://trade-craft-rb.vercel.app/**`
     - `https://trade-craft-app-git-dev-rupendra-bukkes-projects.vercel.app/**`
6. Put the same URL and key in both places, then redeploy:

   **Vercel** → project `trade-craft-app` → Settings → Environment Variables, for **Production** and **Preview**:

   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (or `NEXT_PUBLIC_SUPABASE_ANON_KEY`)

   Redeploy the latest Production deployment after saving. Preview too, if you use the dev URL.

   **Render**, on both `stock-intelligence-api` and `stock-intelligence-api-dev`:

   - `SUPABASE_URL` = the same project URL
   - `SUPABASE_PUBLISHABLE_KEY` = the same key
   - `AUTH_REQUIRED` = `true`

   Save so Render restarts.

7. Sign in again. A wrong password then says **Invalid email or password**. The red “Cannot reach Supabase” box means the address is still wrong or the project is still paused.

More login setup notes: [AUTH_SETUP.md](./AUTH_SETUP.md)

---

## If the site opens but data does not

1. Wait one minute and refresh. Render may have been asleep.
2. Open https://stock-intelligence-api.onrender.com/health
   - `200` and a `git_commit` means the API is awake.
   - A long spin, then failure, means Render did not wake. Open the Render dashboard and check the service is not suspended.
3. If health is fine and only the AI panel or timeline is empty, check the matching GitHub Action from the table above. Those jobs fill the saved snapshots. They do not run on weekends for checkpoints and AI snapshots.

---

## Short checklist

- [ ] This week: signed in once on production
- [ ] This week: Supabase project is Active (restored the same day if it was Paused)
- [ ] This month: Keepalive workflow is green, and schedules are not disabled
