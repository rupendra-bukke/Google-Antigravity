"""FastAPI application entry point with checkpoint scheduler."""

import asyncio
from contextlib import asynccontextmanager
from datetime import datetime, timezone, timedelta

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from config import settings
from routers.analyze import router as analyze_router
from routers.checkpoints import router as checkpoints_router, run_checkpoint_for_all_symbols

IST = timezone(timedelta(hours=5, minutes=30))

# ── APScheduler: fires V2 engine at each market checkpoint (IST, Mon–Fri) ──

scheduler = AsyncIOScheduler(timezone="Asia/Kolkata")

CHECKPOINT_SCHEDULE = [
    ("0915", 9,  15),
    ("0930", 9,  30),
    ("1000", 10,  0),
    ("1130", 11, 30),
    ("1300", 13,  0),
    ("1400", 14,  0),
    ("1500", 15,  0),
]

for cp_id, hour, minute in CHECKPOINT_SCHEDULE:
    scheduler.add_job(
        run_checkpoint_for_all_symbols,
        CronTrigger(day_of_week="mon-fri", hour=hour, minute=minute),
        args=[cp_id],
        id=f"checkpoint_{cp_id}",
        replace_existing=True,
    )


# ── EOD Analysis trigger at 3:30 PM IST ──────────────────────────────────────

async def _trigger_eod_analysis():
    """Run end-of-day next-day outlook analysis at market close."""
    from services.ai_decision import get_eod_analysis
    now = datetime.now(timezone.utc)
    symbols = ["^NSEI", "^NSEBANK", "^BSESN"]
    for sym in symbols:
        try:
            result = await get_eod_analysis(sym, now)
            print(f"[EOD] ✅ EOD analysis for {sym}: {result.get('next_day_bias')}")
        except Exception as e:
            print(f"[EOD] ❌ Failed for {sym}: {e}")

scheduler.add_job(
    _trigger_eod_analysis,
    CronTrigger(day_of_week="mon-fri", hour=15, minute=30),
    id="eod_analysis",
    replace_existing=True,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    scheduler.start()
    print(f"[SCHEDULER] ✅ Started — {len(CHECKPOINT_SCHEDULE)} checkpoints scheduled (IST, Mon–Fri)")
    yield
    scheduler.shutdown()
    print("[SCHEDULER] 🛑 Stopped")


# ── App ────────────────────────────────────────────────────────────────────

app = FastAPI(
    title=settings.app_name,
    version="2.0.0",
    description="Intraday NIFTY 50 analyzer with checkpoint snapshot board",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(analyze_router)
app.include_router(checkpoints_router)


@app.get("/health", tags=["system"])
async def health_check():
    now_ist = datetime.now(IST).strftime("%Y-%m-%d %H:%M:%S IST")
    return {
        "status": "ok",
        "app": settings.app_name,
        "scheduler": "running" if scheduler.running else "stopped",
        "next_jobs": [
            {"id": job.id, "next_run": str(job.next_run_time)}
            for job in scheduler.get_jobs()
        ],
        "server_time_ist": now_ist,
    }
