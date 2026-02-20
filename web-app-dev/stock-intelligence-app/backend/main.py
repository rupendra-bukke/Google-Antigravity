"""FastAPI application entry point for NIFTY 50 Stock Intelligence."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from routers.analyze import router as analyze_router

app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    description="Intraday NIFTY 50 analyzer — EMA20, RSI(14), VWAP with decision logic",
)

# --- CORS ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Routers ---
app.include_router(analyze_router)


@app.get("/health", tags=["system"])
async def health_check():
    return {"status": "ok", "app": settings.app_name}
