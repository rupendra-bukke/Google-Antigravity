"use client";

import { useState, useEffect, useCallback } from "react";
import { useSymbol } from "./context/SymbolContext";
import StockHeader from "./components/StockHeader";
import IndexSelector from "./components/IndexSelector";
import CandlestickChart from "./components/CandlestickChart";

import DecisionBadge from "./components/DecisionBadge";
import AdvancedDecision from "./components/AdvancedDecision";
import MarketStatusBanner from "./components/MarketStatusBanner";
import CheckpointBoard from "./components/CheckpointBoard";

/* ── Types ── */

interface BollingerData {
    upper: number;
    middle: number;
    lower: number;
}

interface MacdData {
    macd_line: number;
    signal_line: number;
    histogram: number;
}

interface IndicatorData {
    ema20: number;
    rsi14: number;
    vwap: number;
    bollinger: BollingerData;
    macd: MacdData;
}

interface OhlcBar {
    time: string;
    open: number;
    high: number;
    low: number;
    close: number;
}

interface AnalyzeData {
    symbol: string;
    price: number;
    indicators: IndicatorData;
    decision: string;
    reasoning: string[];
    timestamp: string;
    candles: OhlcBar[];
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/* ── Dashboard ── */

export default function Dashboard() {
    const { selectedSymbol, setSelectedSymbol } = useSymbol();
    const [data, setData] = useState<AnalyzeData | null>(null);
    const [advancedData, setAdvancedData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [lastRefresh, setLastRefresh] = useState<number>(0);

    const fetchData = useCallback(async (symbol: string) => {
        try {
            setIsLoading(true);
            setError(null);

            // Fetch both endpoints in parallel
            const [basicRes, advRes] = await Promise.all([
                fetch(`${API_URL}/api/v1/analyze?symbol=${encodeURIComponent(symbol)}`),
                fetch(`${API_URL}/api/v1/advanced-analyze?symbol=${encodeURIComponent(symbol)}`),
            ]);

            if (!basicRes.ok) {
                const errBody = await basicRes.json().catch(() => ({}));
                throw new Error(
                    errBody.detail || `API error: ${basicRes.status} ${basicRes.statusText}`
                );
            }

            const basicJson: AnalyzeData = await basicRes.json();
            setData(basicJson);

            if (advRes.ok) {
                const advJson = await advRes.json();
                setAdvancedData(advJson);
            }

            setLastRefresh(Date.now());
        } catch (err: unknown) {
            const message =
                err instanceof Error ? err.message : "Failed to fetch data";
            setError(message);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData(selectedSymbol);
        const interval = setInterval(() => fetchData(selectedSymbol), 60_000);
        return () => clearInterval(interval);
    }, [selectedSymbol, fetchData]);

    const handleSymbolChange = (symbol: string) => {
        setData(null);
        setAdvancedData(null);
        setSelectedSymbol(symbol);
    };

    const loading = isLoading && !data;

    return (
        <div className="max-w-6xl mx-auto space-y-6 pb-12 relative">
            {/* ── Background Watermark ── */}
            <div className="fixed inset-0 pointer-events-none flex items-center justify-center -z-10 overflow-hidden">
                <img
                    src="/rb-logo.png"
                    alt="Watermark"
                    className="w-[500px] h-[500px] md:w-[800px] md:h-[800px] object-contain opacity-[0.08] grayscale brightness-200"
                />
            </div>

            {/* ── Hero Header ── */}
            <div className="text-center py-6 relative">
                {/* Gradient glow behind title */}
                <div className="absolute inset-x-0 top-0 flex justify-center pointer-events-none">
                    <div className="w-96 h-24 bg-gradient-to-b from-brand-500/10 via-emerald-500/5 to-transparent blur-2xl rounded-full" />
                </div>

                {/* Brand chip */}
                <div className="inline-flex items-center gap-1.5 px-3 py-1 mb-4 rounded-full bg-brand-500/10 border border-brand-500/20 text-[10px] font-black text-brand-400 uppercase tracking-[0.2em]">
                    <span className="relative flex h-1.5 w-1.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                    </span>
                    Live Intelligence
                </div>

                {/* Main title with gradient */}
                <h1
                    className="text-4xl md:text-5xl font-black tracking-tight leading-none"
                    style={{
                        background: "linear-gradient(135deg, #fff 0%, #a5b4fc 40%, #34d399 80%, #6ee7b7 100%)",
                        WebkitBackgroundClip: "text",
                        WebkitTextFillColor: "transparent",
                        backgroundClip: "text",
                        letterSpacing: "-0.03em"
                    }}
                >
                    Trade-Craft
                </h1>

                {/* Subtitle */}
                <p className="text-[11px] text-gray-500 mt-2 font-medium tracking-[0.15em] uppercase">
                    Real-time intraday intelligence
                </p>

                {/* Divider line */}
                <div className="flex items-center justify-center mt-5 gap-3">
                    <div className="h-px w-16 bg-gradient-to-r from-transparent to-gray-700/60" />
                    <div className="h-px w-2 bg-brand-500/40 rounded-full" />
                    <div className="h-px w-16 bg-gradient-to-l from-transparent to-gray-700/60" />
                </div>
            </div>

            {/* ── Controls Row ── */}
            <div className="flex items-center justify-end gap-2">
                <IndexSelector
                    selected={selectedSymbol}
                    onSelect={handleSymbolChange}
                    disabled={isLoading}
                />
                <button
                    onClick={() => fetchData(selectedSymbol)}
                    disabled={isLoading}
                    className="p-2.5 rounded-xl text-sm
                       bg-brand-500/10 text-brand-400 border border-brand-500/20
                       hover:bg-brand-500/20 transition-all duration-200
                       disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                    title="Refresh"
                >
                    <svg
                        className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                        />
                    </svg>
                </button>
            </div>

            {/* ── Error ── */}
            {
                error && (
                    <div className="glass-card p-4 border border-rose-500/20 bg-rose-500/5 animate-fade-in">
                        <div className="flex items-start gap-3">
                            <span className="text-rose-400 text-base mt-0.5">⚠</span>
                            <div>
                                <p className="text-sm font-semibold text-rose-400">
                                    Failed to load data
                                </p>
                                <p className="text-xs text-gray-400 mt-1">{error}</p>
                                <p className="text-xs text-gray-600 mt-2">
                                    Backend:{" "}
                                    <code className="text-brand-400/80 text-[10px]">
                                        uvicorn main:app --reload --port 8000
                                    </code>
                                </p>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* ── Market Status Banner ── */}
            <MarketStatusBanner
                isOpen={advancedData?.is_market_open ?? true}
                message={advancedData?.market_message ?? ""}
            />

            {/* ── Stock Header ── */}
            <StockHeader
                symbol={data?.symbol ?? selectedSymbol}
                price={data?.price ?? 0}
                timestamp={data?.timestamp ?? ""}
                isLoading={loading}
            />

            {/* ── Advanced Analysis ── */}
            <AdvancedDecision
                data={advancedData}
                isLoading={loading}
            />

            {/* ── Checkpoint Board — PRIME POSITION ── */}
            <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "1rem" }}>
                <CheckpointBoard />
            </div>

            {/* ── Compact Indicators Strip ── */}
            <div>
                <p className="section-label mb-2 ml-1" style={{ fontSize: "0.65rem" }}>Indicators</p>
                <div style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "0.4rem",
                }}>
                    {/* EMA 20 */}
                    <div style={{
                        background: "rgba(99,102,241,0.08)",
                        border: "1px solid rgba(99,102,241,0.2)",
                        borderRadius: "8px",
                        padding: "0.3rem 0.7rem",
                        display: "flex", alignItems: "center", gap: "0.4rem",
                    }}>
                        <span style={{ fontSize: "0.65rem", color: "#6366f1", fontWeight: 700 }}>EMA20</span>
                        <span style={{ fontSize: "0.72rem", color: "#e2e8f0", fontWeight: 600 }}>
                            {data ? data.indicators.ema20.toLocaleString("en-IN", { maximumFractionDigits: 2 }) : "—"}
                        </span>
                    </div>
                    {/* RSI */}
                    <div style={{
                        background: "rgba(16,185,129,0.08)",
                        border: "1px solid rgba(16,185,129,0.2)",
                        borderRadius: "8px",
                        padding: "0.3rem 0.7rem",
                        display: "flex", alignItems: "center", gap: "0.4rem",
                    }}>
                        <span style={{ fontSize: "0.65rem", color: "#10b981", fontWeight: 700 }}>RSI(14)</span>
                        <span style={{ fontSize: "0.72rem", color: "#e2e8f0", fontWeight: 600 }}>
                            {data ? data.indicators.rsi14.toFixed(2) : "—"}
                        </span>
                    </div>
                    {/* VWAP */}
                    <div style={{
                        background: "rgba(6,182,212,0.08)",
                        border: "1px solid rgba(6,182,212,0.2)",
                        borderRadius: "8px",
                        padding: "0.3rem 0.7rem",
                        display: "flex", alignItems: "center", gap: "0.4rem",
                    }}>
                        <span style={{ fontSize: "0.65rem", color: "#06b6d4", fontWeight: 700 }}>VWAP</span>
                        <span style={{ fontSize: "0.72rem", color: "#e2e8f0", fontWeight: 600 }}>
                            {data ? data.indicators.vwap.toLocaleString("en-IN", { maximumFractionDigits: 2 }) : "—"}
                        </span>
                    </div>
                    {/* BB */}
                    <div style={{
                        background: "rgba(245,158,11,0.08)",
                        border: "1px solid rgba(245,158,11,0.2)",
                        borderRadius: "8px",
                        padding: "0.3rem 0.7rem",
                        display: "flex", alignItems: "center", gap: "0.4rem",
                    }}>
                        <span style={{ fontSize: "0.65rem", color: "#f59e0b", fontWeight: 700 }}>BB</span>
                        <span style={{ fontSize: "0.72rem", color: "#e2e8f0", fontWeight: 600 }}>
                            {data
                                ? `${data.indicators.bollinger.lower.toLocaleString("en-IN")} – ${data.indicators.bollinger.upper.toLocaleString("en-IN")}`
                                : "—"}
                        </span>
                    </div>
                    {/* MACD */}
                    <div style={{
                        background: "rgba(139,92,246,0.08)",
                        border: "1px solid rgba(139,92,246,0.2)",
                        borderRadius: "8px",
                        padding: "0.3rem 0.7rem",
                        display: "flex", alignItems: "center", gap: "0.4rem",
                    }}>
                        <span style={{ fontSize: "0.65rem", color: "#8b5cf6", fontWeight: 700 }}>MACD</span>
                        <span style={{ fontSize: "0.72rem", color: "#e2e8f0", fontWeight: 600 }}>
                            {data
                                ? `${data.indicators.macd.macd_line} / ${data.indicators.macd.signal_line}`
                                : "—"}
                        </span>
                        {data && (
                            <span style={{
                                fontSize: "0.62rem",
                                color: data.indicators.macd.histogram > 0 ? "#22c55e" : "#ef4444",
                                fontWeight: 600,
                            }}>
                                H:{data.indicators.macd.histogram}
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Chart ── */}
            <div>
                <p className="section-label mb-3 ml-1">Price Action</p>
                <CandlestickChart
                    candles={data?.candles ?? []}
                    ema20={data?.indicators.ema20 ?? null}
                    isLoading={loading}
                />
            </div>

            {/* ── Decision Badge ── */}
            <DecisionBadge
                decision={data?.decision ?? null}
                reasoning={data?.reasoning ?? []}
                isLoading={loading}
            />

            {/* ── Footer ── */}
            <div className="text-center pt-2">
                <p className="text-[10px] text-gray-600 font-medium">
                    {lastRefresh > 0
                        ? `Last refreshed ${new Date(lastRefresh).toLocaleTimeString("en-IN", {
                            timeZone: "Asia/Kolkata",
                        })} IST`
                        : "Connecting…"}{" "}
                    · Data via yfinance · Not financial advice
                </p>
            </div>
        </div >
    );
}


