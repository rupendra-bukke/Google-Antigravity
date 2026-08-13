"use client";

import { authedFetch } from "@/lib/authedFetch";
import dynamic from "next/dynamic";
import { useState, useEffect, useCallback } from "react";
import { useSymbol } from "./context/SymbolContext";
import { useSettings } from "./context/SettingsContext";
import StockHeader from "./components/StockHeader";
import IndexSelector from "./components/IndexSelector";
import BuildBadge from "./components/BuildBadge";
import PageHeader from "./components/PageHeader";
import IndicatorTable from "./components/IndicatorTable";

import AIDecision from "./components/AIDecision";
import ExpiryZeroHeroPanel from "./components/ExpiryZeroHeroPanel";
import MarketStatusBanner from "./components/MarketStatusBanner";
import CheckpointBoard from "./components/CheckpointBoard";
import DashboardSyncBar from "./components/DashboardSyncBar";
import DataAIPulsePanel from "./components/DataAIPulsePanel";
import ISTClock from "./components/ISTClock";
import ExpiryBanner from "./components/ExpiryBanner";
import TraderJourneyLine from "./components/TraderJourneyLine";
import { triggerDashboardRefresh } from "@/lib/dashboardRefresh";

const CandlestickChart = dynamic(() => import("./components/CandlestickChart"), {
    ssr: false,
    loading: () => (
        <div className="glass-card p-6 h-[400px] flex items-center justify-center text-sm text-gray-500">
            Loading chart module…
        </div>
    ),
});


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
    signals: {
        ema20: string;
        rsi14: string;
        vwap: string;
        bollinger: string;
        macd: string;
    };
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

// Use relative path — proxied to backend via next.config.mjs rewrites
const API_BASE = "/api";

/* ── Frontend NSE Market Status (does NOT need backend) ── */
function getNseMarketStatus(): { isOpen: boolean; message: string } {
    // IST = UTC+5:30
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const ist = new Date(now.getTime() + istOffset);
    const day = ist.getUTCDay(); // 0=Sun, 6=Sat
    const hh = ist.getUTCHours();
    const mm = ist.getUTCMinutes();
    const timeVal = hh * 100 + mm; // e.g. 0915

    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    // Format: DD-MM-YYYY  HH:MM AM/PM  (IST)
    const dd = String(ist.getUTCDate()).padStart(2, "0");
    const mo = String(ist.getUTCMonth() + 1).padStart(2, "0");
    const yyyy = ist.getUTCFullYear();
    const period = hh >= 12 ? "PM" : "AM";
    const h12 = hh % 12 || 12;
    const stamp = `${dd}-${mo}-${yyyy} ${String(h12).padStart(2, "0")}:${String(mm).padStart(2, "0")} ${period}`;

    // ── NSE Public Holidays 2026 (holiday-aware frontend check) ──────────────
    const NSE_HOLIDAYS_2026 = new Set([
        "2026-01-26", // Republic Day
        "2026-03-03", // Holi (Dhuleti)
        "2026-04-02", // Good Friday / Ram Navami
        "2026-04-14", // Dr Ambedkar Jayanti
        "2026-05-01", // Maharashtra Day
        "2026-08-15", // Independence Day
        "2026-10-02", // Gandhi Jayanti
        "2026-10-20", // Diwali Laxmi Pujan (approx)
        "2026-10-21", // Diwali Balipratipada (approx)
        "2026-11-18", // Guru Nanak Jayanti (approx)
    ]);
    const todayISO = `${yyyy}-${mo}-${dd}`;
    if (NSE_HOLIDAYS_2026.has(todayISO)) {
        return { isOpen: false, message: `Market is CLOSED — 🎉 NSE Holiday (${stamp})` };
    }

    if (day === 0 || day === 6) {
        return { isOpen: false, message: `Market is CLOSED — ${dayNames[day]}, ${stamp}` };
    }
    if (timeVal < 915) {
        return { isOpen: false, message: `Market Opens at 09:15 AM IST — ${stamp}` };
    }
    if (timeVal >= 1530) {
        return { isOpen: false, message: `Market Closed at 03:30 PM IST — ${stamp}` };
    }
    return { isOpen: true, message: "Market is OPEN" };
}

/* ── Dashboard ── */

export default function Dashboard() {
    const { selectedSymbol, setSelectedSymbol } = useSymbol();
    const { settings, updateSettings } = useSettings();
    const [data, setData] = useState<AnalyzeData | null>(null);
    const [chartCandles, setChartCandles] = useState<OhlcBar[]>([]);
    const [chartLoading, setChartLoading] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isSyncing, setIsSyncing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [lastRefresh, setLastRefresh] = useState<number>(0);

    const fetchData = useCallback(async (symbol: string, options?: { silent?: boolean }) => {
        const silent = options?.silent ?? false;
        try {
            if (silent) {
                setIsSyncing(true);
            } else {
                setIsLoading(true);
            }
            setError(null);

            const basicRes = await authedFetch(
                `${API_BASE}/v1/analyze?symbol=${encodeURIComponent(symbol)}&include_candles=false`
            );

            if (!basicRes.ok) {
                const errBody = await basicRes.json().catch(() => ({}));
                throw new Error(
                    errBody.detail || `API error: ${basicRes.status} ${basicRes.statusText}`
                );
            }

            const basicJson: AnalyzeData = await basicRes.json();
            setData(basicJson);

            setLastRefresh(Date.now());
        } catch (err: unknown) {
            const message =
                err instanceof Error ? err.message : "Failed to fetch data";
            setError(message);
        } finally {
            if (silent) {
                setIsSyncing(false);
            } else {
                setIsLoading(false);
            }
        }
    }, []);

    const fetchChartData = useCallback(async (symbol: string) => {
        setChartLoading(true);
        try {
            const res = await authedFetch(
                `${API_BASE}/v1/analyze?symbol=${encodeURIComponent(symbol)}&include_candles=true`
            );
            if (!res.ok) {
                setChartCandles([]);
                return;
            }
            const json: AnalyzeData = await res.json();
            setChartCandles(json.candles || []);
        } catch {
            setChartCandles([]);
        } finally {
            setChartLoading(false);
        }
    }, []);

    const handleSyncAll = useCallback(() => {
        void fetchData(selectedSymbol, { silent: true });
        if (settings.showCandlestickChart) {
            void fetchChartData(selectedSymbol);
        }
        triggerDashboardRefresh();
    }, [fetchData, fetchChartData, selectedSymbol, settings.showCandlestickChart]);

    useEffect(() => {
        const run = () => {
            if (typeof document !== "undefined" && document.hidden) return;
            fetchData(selectedSymbol);
        };
        run();
        const interval = setInterval(run, settings.dashboardRefreshSec * 1000);
        return () => clearInterval(interval);
    }, [selectedSymbol, fetchData, settings.dashboardRefreshSec]);

    useEffect(() => {
        if (!settings.showCandlestickChart) {
            setChartCandles([]);
            setChartLoading(false);
            return;
        }
        void fetchChartData(selectedSymbol);
    }, [selectedSymbol, settings.showCandlestickChart, fetchChartData]);

    const handleSymbolChange = (symbol: string) => {
        setData(null);
        setChartCandles([]);
        setSelectedSymbol(symbol);
    };

    const toggleChart = () => {
        updateSettings({ showCandlestickChart: !settings.showCandlestickChart });
    };

    const loading = isLoading && !data;

    return (
        <div className="page-shell">

            <PageHeader
                module="Dashboard"
                title="Market Dashboard"
                description="NSE indices · live signals · checkpoint timeline"
                actions={<ISTClock embedded />}
            />

            <div className="toolbar-card space-y-3">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                        <BuildBadge className="md:hidden" />
                        <button
                            type="button"
                            onClick={toggleChart}
                            className={
                                settings.showCandlestickChart
                                    ? "btn-primary text-[9px]"
                                    : "btn-ghost text-[9px]"
                            }
                        >
                            {settings.showCandlestickChart ? "Chart On" : "Chart Off"}
                        </button>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <IndexSelector
                            selected={selectedSymbol}
                            onSelect={handleSymbolChange}
                            disabled={isLoading}
                        />
                        {selectedSymbol === "^NSEBANK" && (
                            <TraderJourneyLine
                                trackId="bankNifty"
                                className="text-[9px] border border-terminal-border bg-terminal-bg px-2 py-1"
                            />
                        )}
                    </div>
                </div>

                <DashboardSyncBar
                    isSyncing={isSyncing}
                    lastRefresh={lastRefresh}
                    autoRefreshSec={settings.dashboardRefreshSec}
                    onSync={handleSyncAll}
                />
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

            {/* ── Market Status Banner — uses frontend clock so it works even when backend is down ── */}
            {(() => {
                const { isOpen, message } = getNseMarketStatus();
                return <MarketStatusBanner isOpen={isOpen} message={message} />;
            })()}

            {/* ── Option Expiry Banner ── */}
            <ExpiryBanner />


            {/* ── Stock Header ── */}
            <StockHeader
                symbol={data?.symbol ?? selectedSymbol}
                price={data?.price ?? 0}
                timestamp={data?.timestamp ?? ""}
                isLoading={loading}
            />

            {/* ── AI Price Action Decision ── */}
            <AIDecision symbol={selectedSymbol} />
            <ExpiryZeroHeroPanel />

            {settings.showCandlestickChart && (
                <CandlestickChart candles={chartCandles} isLoading={chartLoading} />
            )}

            <IndicatorTable signals={data?.indicators?.signals ?? null} />

            {/* ── Checkpoint Board ── */}
            <div className="border-t border-terminal-border pt-2">
                <CheckpointBoard symbol={selectedSymbol} />
            </div>

            {/* ── Data & AI Pulse (BI / analytics career brief) ── */}
            <DataAIPulsePanel />

            {/* ── Footer ── */}
            <div className="text-center pt-2">
                <p className="text-[9px] font-mono text-terminal-dim uppercase tracking-wider">
                    Market data · Not financial advice
                </p>
            </div>
        </div>
    );
}
