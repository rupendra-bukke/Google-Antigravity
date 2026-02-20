# 📊 NIFTY 50 Stock Intelligence

Full-stack intraday analyzer for NIFTY 50 — calculates **EMA20**, **RSI(14)**, **VWAP** and provides a **BUY / SELL / HOLD** decision using free yfinance data.

![stack](https://img.shields.io/badge/FastAPI-009688?style=flat&logo=fastapi&logoColor=white)
![stack](https://img.shields.io/badge/Next.js_14-000?style=flat&logo=next.js&logoColor=white)
![stack](https://img.shields.io/badge/Tailwind_CSS-38BDF8?style=flat&logo=tailwindcss&logoColor=white)
![stack](https://img.shields.io/badge/yfinance-FFD700?style=flat&logoColor=black)

---

## Folder Structure

```
stock-intelligence-app/
├── backend/           # FastAPI (Python)
│   ├── main.py
│   ├── config.py
│   ├── requirements.txt
│   ├── routers/
│   │   └── analyze.py
│   ├── services/
│   │   ├── market_data.py
│   │   └── decision.py
│   └── models/
│       └── schemas.py
├── frontend/          # Next.js 14 (App Router)
│   ├── src/app/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── globals.css
│   │   └── components/
│   └── package.json
└── README.md
```

---

## Quick Start

### 1. Backend

```bash
cd backend

# Create virtual env (recommended)
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # macOS / Linux

# Install dependencies
pip install -r requirements.txt

# Copy env file
copy .env.example .env

# Run server
uvicorn main:app --reload --port 8000
```

Verify: open [http://localhost:8000/api/v1/analyze](http://localhost:8000/api/v1/analyze)

### 2. Frontend

```bash
cd frontend

# Install dependencies
npm install

# Copy env file
copy .env.local.example .env.local

# Run dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## API

### `GET /api/v1/analyze`

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `symbol` | `string` | `^NSEI` | Yahoo Finance ticker |

**Response:**
```json
{
  "symbol": "^NSEI",
  "price": 22345.50,
  "indicators": {
    "ema20": 22310.45,
    "rsi14": 55.32,
    "vwap": 22298.10
  },
  "decision": "BUY",
  "reasoning": [
    "Price above EMA20 (22310.45)",
    "RSI (55.32) indicates room to move up",
    "Price above VWAP (22298.10)"
  ],
  "timestamp": "2026-02-20T06:37:52Z"
}
```

### Decision Rules

| Decision | Conditions |
|----------|-----------|
| **BUY** | Price > EMA20 **and** RSI < 60 **and** Price > VWAP |
| **SELL** | Price < EMA20 **and** RSI > 70 **and** Price < VWAP |
| **HOLD** | All other cases |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 (App Router), Tailwind CSS, TypeScript |
| Backend | FastAPI, Pydantic, uvicorn |
| Data | yfinance (free — no API key needed) |
| Indicators | EMA20, RSI(14), VWAP — pandas-based |

---

## Notes

- **Market hours**: During market-closed hours, data reflects the last available trading session.
- **Free data**: No paid APIs used — 100% yfinance.
- **Auto-refresh**: Dashboard refreshes every 60 seconds automatically.
