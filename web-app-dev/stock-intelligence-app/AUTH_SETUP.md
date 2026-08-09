# Supabase Auth Setup (Vercel + Render)

Use this guide when login shows **"Load failed"**, **"Cannot reach Supabase"**, or auth works locally but not on production.

---

## What "Load failed" means

Safari and mobile browsers show **Load failed** when the app cannot reach your Supabase project over the network. This is almost always a **configuration** issue, not a wrong password.

Common causes:

1. Supabase env vars missing on **Vercel** (frontend)
2. Placeholder values still in Vercel (e.g. `YOUR_PROJECT_ID`)
3. Env vars added on Vercel but **no redeploy** after that
4. Supabase **Site URL** / **Redirect URLs** missing your Vercel domain
5. User not created in Supabase Authentication → Users

---

## Step 1 — Get values from Supabase

1. Open [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to **Project Settings** → **API**
4. Copy:
   - **Project URL** → e.g. `https://abcdefghijklmnop.supabase.co`
   - **anon public** key OR **publishable** key (not the `service_role` secret)

5. Go to **Authentication** → **Users**
6. Confirm your test user exists (e.g. `rupendra.test@gmail.com`)
   - If not: **Add user** → **Create new user** with email + password

---

## Step 2 — Set Vercel env vars (frontend)

1. Open [https://vercel.com](https://vercel.com) → your **trade-craft-app** project
2. **Settings** → **Environment Variables**
3. Add these for **Production** (and Preview if you use dev branch):

| Name | Value |
|------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://YOUR_PROJECT_REF.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | your anon/publishable key |

Alternative key name also supported:

| Name | Value |
|------|--------|
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | your anon key |

4. Also confirm `BACKEND_URL` points to your Render backend:
   - Production: `https://stock-intelligence-api.onrender.com`

---

## Step 3 — Redeploy Vercel (required)

Env vars only apply to **new builds**.

1. Vercel → **Deployments**
2. Click **⋯** on latest deployment → **Redeploy**
3. Wait until status is **Ready**

---

## Step 4 — Set Render env vars (backend)

On **both** Render services (prod + dev if used):

| Name | Value |
|------|--------|
| `SUPABASE_URL` | same Project URL as above |
| `SUPABASE_PUBLISHABLE_KEY` | same anon/publishable key |
| `AUTH_REQUIRED` | `true` |

Then **Manual Deploy** or push a commit so Render restarts with new env.

---

## Step 5 — Supabase URL configuration

In Supabase → **Authentication** → **URL Configuration**:

| Field | Value |
|-------|--------|
| **Site URL** | `https://trade-craft-rb.vercel.app` |
| **Redirect URLs** | add: `https://trade-craft-rb.vercel.app/**` |

If you use dev preview URL, also add:

`https://trade-craft-app-git-dev-rupendra-bukkes-projects.vercel.app/**`

Click **Save**.

---

## Step 6 — Test login

1. Open **https://trade-craft-rb.vercel.app/login** in a private/incognito window
2. Sign in with the Supabase user email + password
3. You should land on the dashboard

If it still fails:

- Double-check no extra spaces in env var values
- Confirm project is not **paused** in Supabase dashboard
- Try on desktop Chrome to compare with mobile Safari

---

## Quick checklist

- [ ] `NEXT_PUBLIC_SUPABASE_URL` set on Vercel Production
- [ ] `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (or `ANON_KEY`) set on Vercel Production
- [ ] Vercel redeployed after env changes
- [ ] `SUPABASE_URL` + `SUPABASE_PUBLISHABLE_KEY` set on Render
- [ ] `AUTH_REQUIRED=true` on Render
- [ ] Site URL + Redirect URLs updated in Supabase
- [ ] Test user exists in Supabase Users

---

## Local dev without login

For local testing only, in `backend/.env`:

```env
AUTH_REQUIRED=false
```

Leave Supabase vars empty on frontend if you want to skip login locally. **Do not** set `AUTH_REQUIRED=false` on production Render.
