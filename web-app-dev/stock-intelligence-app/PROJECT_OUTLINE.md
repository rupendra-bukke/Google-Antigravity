# 📊 Trade-Craft — Project Outline

> Nifty 50 Intraday Intelligence Dashboard | Free Cloud Stack | No Paid Plans

---

## What This App Does

Trade-Craft is a **personal trading intelligence dashboard** that:
- Captures a snapshot of Nifty 50 market conditions at **7 key intraday times** every trading day
- Runs a **multi-timeframe technical analysis engine** (V2) to generate scalp signals
- Displays a **10–20 min momentum forecast** on each checkpoint card
- Stores results in Redis so data is accessible **any time of day**, even after market close
- Auto-resets every morning at **9:00 AM IST** for a fresh day

---

## Architecture (100% Free Stack)

```
User → Vercel (Frontend) → Render (Backend) → Upstash Redis (DB)
                                    ↑
                               yfinance (Free NSE/BSE data)
```

| Layer | Service | Plan | Notes |
|-------|---------|------|-------|
| Frontend | Vercel | Free | Never sleeps, auto-deploys from GitHub |
| Backend | Render | Free | Sleeps after 15 min idle — handled by catch-up |
| Database | Upstash Redis | Free | ~50 commands/day, limit is 10,000 |
| Market Data | yfinance | Free | No API key needed |

---

## The 7 Market Checkpoints

| ID | Label | Time (IST) |
|----|-------|-----------|
| 0915 | Market Open | 09:15 AM |
| 0930 | Opening Range | 09:30 AM |
| 1000 | Morning Trend | 10:00 AM |
| 1130 | Mid-Morning | 11:30 AM |
| 1300 | Lunch Lull | 01:00 PM |
| 1400 | Afternoon Setup | 02:00 PM |
| 1500 | Power Hour | 03:00 PM |

---

## How Data Flows

### During Market Hours (9:15 AM – 3:30 PM, Mon–Fri)
1. **APScheduler** (inside Render) fires at each checkpoint time
2. `fetch_multi_timeframe(^NSEI, ^NSEBANK)` pulls live 1m/3m/5m/15m/1h data
3. `run_advanced_analysis()` runs the V2 decision engine
4. `momentum_forecast()` predicts next 10–20 min direction
5. Snapshot (JSON) is saved to Redis with TTL = **9:00 AM next trading day**

### When Backend Was Sleeping (Catch-Up)
1. User opens dashboard → frontend calls `GET /api/v1/checkpoints`
2. Backend wakes up, finds empty Redis slots for past checkpoint times
3. Runs **catch-up**: calls `fetch_multi_timeframe_at_time()` which slices yfinance historical data **up to each checkpoint's exact time**
4. Each slot gets the correct historical price and indicators — not the current price
5. Results saved to Redis (same TTL)

### Daily Reset
- Redis keys have TTL = **9:00 AM IST next trading day**
- On Friday, TTL skips to **Monday 9:00 AM**
- Dashboard automatically shows empty cards on a new day — ready for fresh captures

---

## V2 Decision Engine — 6-Step Pipeline

```
Step 0   → HTF Trend Filter (15m + 1h)
Step 0.5 → Reversal / Exhaustion Filter
Step 1   → Market Structure + Range Context
Step 2   → Scalp Analysis (1m / 3m / 5m)
Step 3   → 3-Min Confirmation Signal
Step 4   → Option Strike Selection
Step 5   → Risk & Trade Management
Step 6   → 10–20 Min Momentum Forecast (ROC + RSI + MACD + Volume)
```

Output per checkpoint:
- `scalp_signal` — BUY / SELL / NO TRADE
- `execute` — Strong / Weak / NO TRADE
- `trend_direction` — Bullish / Bearish / Sideways
- `spot_price` — Price at the time of capture (frozen)
- `forecast` — UP / DOWN / FLAT + confidence %

---

## Key Files

```
stock-intelligence-app/
├── backend/
│   ├── main.py                     # FastAPI app + APScheduler setup
│   ├── config.py                   # Settings (CORS, env vars)
│   ├── routers/
│   │   └── checkpoints.py          # GET /checkpoints, POST /trigger, GET /diag
│   └── services/
│       ├── market_data.py          # yfinance fetch + historical slice
│       ├── decision_v2.py          # 6-step analysis engine
│       └── checkpoint_store.py     # Upstash Redis read/write + TTL
├── frontend/
│   ├── next.config.mjs             # /api/* proxy → Render backend
│   └── src/app/
│       ├── page.tsx                # Main dashboard
│       └── components/
│           └── CheckpointBoard.tsx # 7-panel timeline UI
```

---

## Environment Variables

### Render (Backend)
| Variable | Purpose |
|----------|---------|
| `UPSTASH_REDIS_REST_URL` | Upstash Redis endpoint |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash auth token |

### Vercel (Frontend)
| Variable | Purpose |
|----------|---------|
| `BACKEND_URL` | Full Render backend URL (server-side, no `NEXT_PUBLIC_`) |

---

## Deployment

1. Push to `main` branch on GitHub
2. **Vercel** auto-detects and redeploys frontend (< 1 min)
3. **Render** auto-detects and redeploys backend (3–5 min)

---

## Diagnostic Endpoint

```
GET /api/v1/checkpoints/diag
```
Returns: server time, Redis config status, last error, durable debug log.

---

## Limitations & Mitigations

| Limitation | Mitigation |
|-----------|-----------|
| Render sleeps on free tier | Catch-up with historical yfinance data |
| yfinance 1m data only available for last 7 days | Catch-up only runs same-day |
| Upstash 10,000 commands/day free limit | ~50 used/day — well within limit |
| No real-time push (WebSocket) | Frontend polls every 30 seconds |

---

*Last updated: Feb 2026 | Built with FastAPI + Next.js + Upstash Redis*
