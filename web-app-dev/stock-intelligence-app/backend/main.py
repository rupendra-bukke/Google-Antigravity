"""FastAPI application entry point with checkpoint scheduler."""

from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from routers.analyze import router as analyze_router
from routers.checkpoints import (
    reconcile_missing_checkpoints,
    router as checkpoints_router,
    run_checkpoint_for_all_symbols,
)
from services.market_data import is_nse_trading_day

IST = timezone(timedelta(hours=5, minutes=30))
scheduler = AsyncIOScheduler(timezone="Asia/Kolkata")

CHECKPOINT_SCHEDULE = [
    ("0915", 9, 15),
    ("0930", 9, 30),
    ("1000", 10, 0),
    ("1130", 11, 30),
    ("1300", 13, 0),
    ("1400", 14, 0),
    ("1500", 15, 0),
]


async def _run_scheduled_checkpoint(checkpoint_id: str):
    """Run an intraday checkpoint only on actual NSE trading days."""
    today_ist = datetime.now(IST).date()
    if not is_nse_trading_day(today_ist):
        print(f"[CHECKPOINT] skipped {checkpoint_id} | non-trading day {today_ist}")
        return

    summary = await run_checkpoint_for_all_symbols(checkpoint_id)
    print(
        f"[CHECKPOINT] scheduler {checkpoint_id} | "
        f"saved={summary.get('saved_symbols')} failed={summary.get('failed_symbols')} "
        f"skipped={summary.get('skipped')}"
    )


for cp_id, hour, minute in CHECKPOINT_SCHEDULE:
    scheduler.add_job(
        _run_scheduled_checkpoint,
        CronTrigger(day_of_week="mon-fri", hour=hour, minute=minute),
        args=[cp_id],
        id=f"checkpoint_{cp_id}",
        replace_existing=True,
    )


async def _trigger_eod_analysis():
    """Run end-of-day next-day outlook at market close for Nifty 50 only."""
    from services.ai_decision import get_eod_analysis

    today_ist = datetime.now(IST).date()
    if not is_nse_trading_day(today_ist):
        print(f"[EOD] skipped | non-trading day {today_ist}")
        return

    now = datetime.now(timezone.utc)
    try:
        result = await get_eod_analysis("^NSEI", now)
        print(f"[EOD] ok | next_day_bias={result.get('next_day_bias')}")
    except Exception as exc:
        print(f"[EOD] failed: {exc}")


scheduler.add_job(
    _trigger_eod_analysis,
    CronTrigger(day_of_week="mon-fri", hour=15, minute=30),
    id="eod_analysis",
    replace_existing=True,
)


async def _run_eod_reconcile():
    """Backfill any missing checkpoint slots after market close."""
    try:
        result = await reconcile_missing_checkpoints()
        print(
            f"[EOD-RECON] done | date={result.get('date')} "
            f"filled={result.get('filled_checkpoint_ids')} "
            f"failed={result.get('failed_checkpoint_ids')}"
        )
    except Exception as exc:
        print(f"[EOD-RECON] failed: {exc}")


scheduler.add_job(
    _run_eod_reconcile,
    CronTrigger(day_of_week="mon-fri", hour=15, minute=31),
    id="eod_reconcile_1531",
    replace_existing=True,
)

scheduler.add_job(
    _run_eod_reconcile,
    CronTrigger(day_of_week="mon-fri", hour=15, minute=36),
    id="eod_reconcile_1536",
    replace_existing=True,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    env_label = "DEV" if settings.is_dev else "PROD"
    print(f"\n{'=' * 55}")
    print(f"  Trade-Craft API  |  {env_label}  |  {settings.app_env.upper()}")
    print(f"{'=' * 55}\n")
    scheduler.start()
    print(f"[SCHEDULER] started with {len(CHECKPOINT_SCHEDULE)} checkpoint jobs (IST, Mon-Fri)")
    print("[SCHEDULER] external checkpoint wake/capture endpoints ready for GitHub Actions")
    yield
    scheduler.shutdown()
    print("[SCHEDULER] stopped")


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
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
        "app_version": settings.app_version,
        "channel": settings.release_channel,
        "build_label": settings.build_label,
        "git_branch": settings.git_branch or None,
        "git_commit": settings.short_commit,
        "scheduler": "running" if scheduler.running else "stopped",
        "next_jobs": [
            {"id": job.id, "next_run": str(job.next_run_time)}
            for job in scheduler.get_jobs()
        ],
        "server_time_ist": now_ist,
    }
