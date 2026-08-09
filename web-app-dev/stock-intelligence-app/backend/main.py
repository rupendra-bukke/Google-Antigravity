"""FastAPI application entry point with checkpoint scheduler."""

import hmac
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from fastapi import FastAPI, Header, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from routers.analyze import (
    ensure_latest_eod_snapshot_cache as ensure_latest_eod_cache_for_startup,
    router as analyze_router,
    run_ai_snapshot_for_all_symbols,
    run_eod_ai_for_all_symbols,
)
from routers.checkpoints import (
    reconcile_missing_checkpoints,
    router as checkpoints_router,
    run_checkpoint_for_all_symbols,
)
from routers.career_pulse import router as career_pulse_router
from services.career_pulse import ensure_today_career_pulse_on_startup, generate_career_pulse
from services.market_data import is_nse_trading_day
from services.keepalive import ping_supabase_auth, ping_upstash_redis

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

AI_SNAPSHOT_SCHEDULE = [
    ("1000", 10, 0),
    ("1430", 14, 30),
]

CAREER_PULSE_SCHEDULE = [
    ("0800", 8, 0),
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


async def _run_scheduled_ai_snapshot(snapshot_id: str):
    """Generate saved intraday AI snapshots only at planned times."""
    today_ist = datetime.now(IST).date()
    if not is_nse_trading_day(today_ist):
        print(f"[AI-SNAPSHOT] skipped {snapshot_id} | non-trading day {today_ist}")
        return

    summary = await run_ai_snapshot_for_all_symbols(snapshot_id)
    print(
        f"[AI-SNAPSHOT] scheduler {snapshot_id} | "
        f"saved={summary.get('saved_symbols')} fallback={summary.get('fallback_symbols')}"
    )


for snapshot_id, hour, minute in AI_SNAPSHOT_SCHEDULE:
    scheduler.add_job(
        _run_scheduled_ai_snapshot,
        CronTrigger(day_of_week="mon-fri", hour=hour, minute=minute),
        args=[snapshot_id],
        id=f"ai_snapshot_{snapshot_id}",
        replace_existing=True,
    )


async def _run_scheduled_career_pulse(job_id: str):
    """Generate the daily Data & AI Pulse digest."""
    summary = await generate_career_pulse()
    print(
        f"[CAREER-PULSE] scheduler {job_id} | "
        f"status={summary.get('status')} date={summary.get('date')}"
    )


for job_id, hour, minute in CAREER_PULSE_SCHEDULE:
    scheduler.add_job(
        _run_scheduled_career_pulse,
        CronTrigger(hour=hour, minute=minute),
        args=[job_id],
        id=f"career_pulse_{job_id}",
        replace_existing=True,
    )


async def _trigger_eod_analysis():
    """Run saved end-of-day next-day outlook at market close for dashboard symbols."""
    today_ist = datetime.now(IST).date()
    if not is_nse_trading_day(today_ist):
        print(f"[EOD] skipped | non-trading day {today_ist}")
        return

    try:
        summary = await run_eod_ai_for_all_symbols()
        print(
            f"[EOD] ok | saved={summary.get('saved_symbols')} "
            f"fallback={summary.get('fallback_symbols')}"
        )
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


async def _run_startup_eod_backfill():
    """Fill latest EOD cache on startup if the scheduled 15:30 run was missed."""
    try:
        summary = await ensure_latest_eod_cache_for_startup()
        print(
            f"[EOD-BOOTSTRAP] date={summary.get('date')} "
            f"existing={len(summary.get('existing_symbols', []))} "
            f"saved={len(summary.get('saved_symbols', []))} "
            f"fallback={len(summary.get('fallback_symbols', []))}"
        )
    except Exception as exc:
        print(f"[EOD-BOOTSTRAP] failed: {exc}")


async def _run_startup_career_pulse_backfill():
    try:
        summary = await ensure_today_career_pulse_on_startup()
        print(f"[CAREER-PULSE-BOOTSTRAP] {summary}")
    except Exception as exc:
        print(f"[CAREER-PULSE-BOOTSTRAP] failed: {exc}")

@asynccontextmanager
async def lifespan(app: FastAPI):
    env_label = "DEV" if settings.is_dev else "PROD"
    print(f"\n{'=' * 55}")
    print(f"  Trade-Craft API  |  {env_label}  |  {settings.app_env.upper()}")
    print(f"{'=' * 55}\n")
    scheduler.start()
    print(f"[SCHEDULER] started with {len(CHECKPOINT_SCHEDULE)} checkpoint jobs (IST, Mon-Fri)")
    print(f"[SCHEDULER] started with {len(AI_SNAPSHOT_SCHEDULE)} saved AI snapshot jobs (IST, Mon-Fri)")
    print(f"[SCHEDULER] started with {len(CAREER_PULSE_SCHEDULE)} career pulse jobs (IST, daily)")
    print("[SCHEDULER] external checkpoint wake/capture endpoints ready for GitHub Actions")
    await _run_startup_eod_backfill()
    await _run_startup_career_pulse_backfill()
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
app.include_router(career_pulse_router)


def _require_cron_secret(x_checkpoint_cron_secret: str | None) -> None:
    expected = (settings.checkpoint_cron_secret or "").strip()
    provided = (x_checkpoint_cron_secret or "").strip()

    if not expected:
        raise HTTPException(status_code=503, detail="CHECKPOINT_CRON_SECRET is not configured.")
    if not provided or not hmac.compare_digest(provided, expected):
        raise HTTPException(status_code=401, detail="Invalid checkpoint cron secret.")


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


@app.get("/health/keepalive", tags=["system"])
async def health_keepalive(
    x_checkpoint_cron_secret: str | None = Header(default=None, alias="X-Checkpoint-Cron-Secret"),
):
    """
    Secure keepalive for GitHub Actions.

    Wakes Render, pings Supabase Auth, and touches Upstash Redis so free-tier
    services stay active during long breaks from manual app usage.
    """
    _require_cron_secret(x_checkpoint_cron_secret)

    supabase = await ping_supabase_auth()
    upstash = await ping_upstash_redis()
    checks = [supabase, upstash]
    required_checks = [item for item in checks if not item.get("skipped")]
    ok = all(item.get("ok") for item in required_checks) if required_checks else False

    return {
        "status": "ok" if ok else "degraded",
        "purpose": "free-tier keepalive",
        "server_time_ist": datetime.now(IST).isoformat(),
        "checks": {
            "supabase_auth": supabase,
            "upstash_redis": upstash,
        },
    }


@app.post("/api/v1/career-pulse/cron-generate", tags=["career-pulse"])
async def career_pulse_cron_generate(
    x_checkpoint_cron_secret: str | None = Header(default=None, alias="X-Checkpoint-Cron-Secret"),
    force: bool = Query(default=False),
):
    """Secure endpoint for GitHub Actions to generate the daily career pulse."""
    _require_cron_secret(x_checkpoint_cron_secret)
    return await generate_career_pulse(force=force)
