# 📊 Trade-Craft — Complete Project Outline

> Your personal Nifty 50 trading intelligence dashboard.  
> Built entirely on **free tools**. No subscriptions. No paid plans. Runs forever.

---

## 🧠 What Is This App?

**Trade-Craft** watches the Indian stock market (Nifty 50) for you.

Every day during market hours, it automatically captures a snapshot of the market at **7 strategic time points** — like a photographer taking pictures of the market mood at specific moments. It then shows you what the market was doing at each time, what the signals said, and what the next 10–20 minutes might look like.

You open the dashboard in your browser → everything is already there, waiting for you.

---

## 🌐 Where Does It Live?

The app has **3 parts**, all running for free in the cloud:

```
You (browser)
    ↓ opens
Vercel  ← the website (frontend)
    ↓ asks for data
Render  ← the brain (backend)
    ↓ stores & fetches
Upstash Redis  ← the memory (database)
    ↑
yfinance (Yahoo Finance) ← free NSE/BSE market data
```

| Part | Service | What it does | Cost |
|------|---------|-------------|------|
| Website | **Vercel** | Shows you the dashboard | Free forever |
| Brain | **Render** | Runs the analysis engine | Free (may sleep at night) |
| Memory | **Upstash Redis** | Stores today's 7 snapshots | Free (10,000 reads/day limit; we use ~50) |
| Market data | **yfinance** | Downloads NSE price data | Free, no API key needed |

---

## ⏰ The 7 Market Checkpoints

Every trading day (Monday to Friday), the app automatically captures data at these exact times:

| Time (IST) | Name | Why it matters |
|-----------|------|---------------|
| 09:15 AM | Market Open | First signal of the day's direction |
| 09:30 AM | Opening Range | Confirms or rejects the opening move |
| 10:00 AM | Morning Trend | Is the early trend holding? |
| 11:30 AM | Mid-Morning | Mid-session check |
| 01:00 PM | Lunch Lull | Pre-lunch momentum |
| 02:00 PM | Afternoon Setup | Post-lunch trend |
| 03:00 PM | Power Hour | Last push of the day |

Each snapshot is **frozen** — the price at 9:15 AM stays as 9:15 AM's price forever. It doesn't change as the day goes on.

---

## 🔄 How the App Works Day by Day

### On a Normal Trading Day

1. At each of the 7 times above, a built-in **scheduler** (like an alarm clock) wakes up and:
   - Downloads current Nifty 50 price data from Yahoo Finance
   - Runs our **6-step analysis engine** (see below)
   - Saves the result to the database with the exact time
2. You open the dashboard → the 7 cards are filled with that day's data
3. At **9:00 AM the next morning**, all the data automatically deletes itself (via an expiry timer called TTL — "Time To Live") so the dashboard is fresh and ready for a new day

### If the App Was Sleeping (Free Tier Catch-Up)

Render's free plan lets the backend sleep if no one visits for 15 minutes. Here's how we handle it:

1. You open the dashboard in the morning
2. Render wakes up
3. It checks: "Did I miss any checkpoints today?"
4. For each missed slot, it downloads **historical intraday data** from Yahoo Finance and slices it to the exact checkpoint time — so the 9:15 AM card shows the actual 9:15 AM price, not today's current price
5. All 7 cards fill correctly with historical-accurate data

---

## 🧮 The 6-Step Analysis Engine (V2)

When the scheduler fires at each checkpoint, this is what runs inside (in order):

| Step | Name | What it does in simple words |
|------|------|------------------------------|
| 0 | HTF Trend Filter | Looks at the 15-minute and 1-hour charts to understand the big-picture direction |
| 0.5 | Reversal Check | Checks if the market is exhausted/overextended and a reversal is likely |
| 1 | Market Structure | Identifies the previous day's high/low and today's key price levels |
| 2 | Scalp Analysis | Looks at 1m, 3m, and 5m charts for short-term buy/sell signals |
| 3 | 3-Min Confirmation | Cross-checks the scalp signal with the 3-minute chart for extra confirmation |
| 4 | Option Strike Selection | Suggests which Call/Put option strike price to trade (if signal is valid) |
| 5 | Risk Management | Decides if the trade is "Strong", "Weak", or "NO TRADE" based on all of the above |
| 6 | 10–20 Min Forecast | Predicts the next 10–20 minutes direction using 4 momentum indicators |

### The Forecast (Step 6) — How Does It Predict?

It uses 4 signals, each "voting" on direction across 1-minute, 3-minute, and 5-minute charts:

| Signal | What it measures |
|--------|-----------------|
| Rate of Change (ROC) | Is price moving faster up or down vs the last 5 candles? |
| RSI Trajectory | Is the strength indicator rising or falling? |
| MACD Histogram Slope | Is bullish or bearish momentum expanding? |
| Volume Surge | Is high volume supporting the move? |

The votes are tallied → direction is **UP / DOWN / FLAT** with a **confidence % bar** (0–95%).

---

## 📱 What You See on the Dashboard

### 1. Live IST Clock (top-right on desktop, below title on mobile)
- Shows **current Indian time** — hours, minutes, seconds — ticking every second
- Each digit is in its own amber/gold box with a glow effect (digital terminal style)
- Shows the date below (Sat, 28-02-2026) with an `IST` badge
- **How it works:** Pure browser JavaScript — reads your computer's clock, converts to IST (UTC+5:30), updates every 1 second. No backend needed.
- **Responsive:** On mobile it sits below the title so it doesn't overlap

### 2. Market Status Banner
- Shows a 🌙 **"Indian Market is Closed"** amber banner when the market is not open
- Shows the **day name** + **date** + **time** dynamically  
  → e.g., *"Market is CLOSED — Saturday, 28-02-2026 01:20 PM"*
- **How it knows:** The browser computes IST time directly (no backend call). Checks:
  - Is it Saturday or Sunday? → Closed
  - Is it before 9:15 AM? → Closed
  - Is it after 3:30 PM? → Closed
  - Otherwise → Open
- On weekdays, if the backend is running, it additionally checks the **official NSE trading calendar** (via `exchange_calendars` library) which knows about Holi, Diwali, Republic Day, etc.
- **Why the frontend computes it:** The backend fails on weekends (no market data in yfinance), so we can't rely on it for status. The frontend is always reliable.

### 3. The 7 Checkpoint Cards (Market Timeline)
Each card shows:
- **Signal** — BUY / SELL / NO TRADE (with colour)
- **Price** — frozen at the time of capture
- **Trend** — Bullish / Bearish / Sideways
- **Execute** — ✅ STRONG / ⚠️ WEAK / ⛔ NO TRADE
- **Reason** — plain-text explanation of why
- **Next 15–20 Min** — direction arrow (📈/📉/➡️), label, confidence bar

---

## 🗑️ Daily Reset Logic

| When | What happens |
|------|-------------|
| Monday–Thursday at end of day | Data auto-deletes next morning at 9:00 AM IST |
| Friday at end of day | Data auto-deletes Monday at 9:00 AM IST (skips weekend) |
| Saturday / Sunday | No data capture (market closed). Dashboard shows the closed banner. |

The delete is automatic — a Redis TTL (expiry timer) is set when data is saved. No manual work.

---

## 🔧 Key Files — What Each One Does

```
stock-intelligence-app/
├── backend/
│   ├── main.py                  Sets up the app + the 7 scheduled alarms
│   ├── routers/
│   │   ├── checkpoints.py       Handles the 7 checkpoint slots (save/read/catch-up)
│   │   └── analyze.py           Handles live analysis requests from the dashboard
│   └── services/
│       ├── market_data.py       Downloads data from Yahoo Finance; also slices it
│       │                        at specific historical times for catch-up
│       ├── decision_v2.py       The 6-step analysis + 10-20 min forecast engine
│       └── checkpoint_store.py  Reads/writes to Upstash Redis; manages TTL expiry
├── frontend/
│   ├── next.config.mjs          Routes /api/* calls to the Render backend
│   └── src/app/
│       ├── page.tsx             Main dashboard page; live IST clock logic; market
│       │                        status logic (frontend-computed)
│       └── components/
│           ├── CheckpointBoard.tsx   The 7-card timeline grid
│           ├── ISTClock.tsx          Live ticking IST clock widget
│           └── MarketStatusBanner.tsx  Amber "market closed" banner
```

---

## 🔑 Environment Variables (Settings You Must Set)

### On Render (Backend):
| Variable | What it is |
|----------|-----------|
| `UPSTASH_REDIS_REST_URL` | The address of your Upstash Redis database |
| `UPSTASH_REDIS_REST_TOKEN` | The password to access your Upstash Redis database |

### On Vercel (Frontend):
| Variable | What it is |
|----------|-----------|
| `BACKEND_URL` | The full web address of your Render backend (e.g. `https://your-app.onrender.com`) |

---

## 🚀 How to Deploy Changes

1. Write code / make a change locally
2. Run `git push origin main` (or Antigravity does it automatically)
3. **Vercel** detects the push → auto-rebuilds the website in ~1 minute
4. **Render** detects the push → auto-rebuilds the backend in ~3–5 minutes
5. Done — no manual steps, no server management

---

## ⚠️ Known Limitations & How We Handle Them

| Limitation | Our Solution |
|-----------|-------------|
| Render free plan sleeps after 15 min idle | Historical catch-up fills missed slots using yfinance data sliced at each checkpoint time |
| yfinance historical 1m data only for last 7 days | Catch-up only works for today — past days are not recovered |
| Upstash free: 10,000 commands/day | We use ~50/day — well within the limit |
| Backend fails on weekends (no yfinance data) | Market status is computed in the browser (not from backend) — always reliable |
| No NSE holiday awareness on frontend | Backend uses `exchange_calendars` (XNSE calendar) for official holiday list on weekdays |
| No real-time push notifications | Frontend refreshes automatically every 30 seconds |

---

## 📋 Diagnostic Tool

If something goes wrong, open this URL in any browser:

```
https://your-render-url.onrender.com/api/v1/checkpoints/diag
```

It returns:
- Current server time in IST
- Whether Redis is connected
- How many checkpoints are stored today
- The last error message (if any)
- A debug log of recent activity

---

*Last updated: Feb 2026 | Stack: FastAPI + Next.js + Upstash Redis + yfinance + Vercel + Render*
