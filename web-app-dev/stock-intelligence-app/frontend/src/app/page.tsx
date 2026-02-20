"use client";

import { useState, useEffect, useCallback } from "react";
import { useSymbol } from "./context/SymbolContext";
import StockHeader from "./components/StockHeader";
import IndexSelector from "./components/IndexSelector";
import CandlestickChart from "./components/CandlestickChart";
import IndicatorCard from "./components/IndicatorCard";
import DecisionBadge from "./components/DecisionBadge";
import AdvancedDecision from "./components/AdvancedDecision";
import MarketStatusBanner from "./components/MarketStatusBanner";

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

            {/* ── Header ── */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-xl font-black text-white tracking-tight italic">Trade-Craft Dashboard</h1>
                    <p className="text-[10px] text-gray-500 mt-1 font-medium tracking-wide">
                        Real-time intraday intelligence · Built for precision
                    </p>
                </div>
                <div className="flex items-center gap-2">
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
            </div >

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

            {/* ── Chart ── */}
            <div>
                <p className="section-label mb-3 ml-1">Price Action</p>
                <CandlestickChart
                    candles={data?.candles ?? []}
                    ema20={data?.indicators.ema20 ?? null}
                    isLoading={loading}
                />
            </div>

            {/* ── Core Indicators ── */}
            <div>
                <p className="section-label mb-3 ml-1">Technical Indicators</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <IndicatorCard
                        label="EMA 20"
                        value={data?.indicators.ema20 ?? null}
                        description="Exponential Moving Average (20). Price above = uptrend."
                        icon="📏"
                        color="indigo"
                        isLoading={loading}
                    />
                    <IndicatorCard
                        label="RSI (14)"
                        value={data?.indicators.rsi14 ?? null}
                        description="Relative Strength Index. <30 oversold, >70 overbought."
                        icon="⚡"
                        color="emerald"
                        isLoading={loading}
                    />
                    <IndicatorCard
                        label="VWAP"
                        value={data?.indicators.vwap ?? null}
                        description="Volume-Weighted Avg Price. Institutional fair-value benchmark."
                        icon="🎯"
                        color="cyan"
                        isLoading={loading}
                    />
                </div>
            </div>

            {/* ── Advanced Indicators ── */}
            <div>
                <p className="section-label mb-3 ml-1">Advanced</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <IndicatorCard
                        label="Bollinger Bands"
                        value={
                            data
                                ? `${data.indicators.bollinger.lower.toLocaleString("en-IN")} – ${data.indicators.bollinger.upper.toLocaleString("en-IN")}`
                                : null
                        }
                        description={`Mid: ${data?.indicators.bollinger.middle.toLocaleString("en-IN") ?? "—"} · SMA20 ± 2σ range`}
                        icon="📐"
                        color="amber"
                        isLoading={loading}
                    />
                    <IndicatorCard
                        label="MACD"
                        value={
                            data
                                ? `${data.indicators.macd.macd_line} / ${data.indicators.macd.signal_line}`
                                : null
                        }
                        description={`Hist: ${data?.indicators.macd.histogram ?? "—"} · MACD > Signal = bullish`}
                        icon="📊"
                        color="violet"
                        isLoading={loading}
                    />
                </div>
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
