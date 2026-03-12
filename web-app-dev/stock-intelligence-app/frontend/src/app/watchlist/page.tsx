"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSymbol } from "../context/SymbolContext";

type Signal = "BUY" | "SELL" | "HOLD" | "UNKNOWN";

interface AnalyzeApiResponse {
    symbol: string;
    price: number;
    decision: string;
    timestamp: string;
    candles?: Array<{ open: number }>;
}

interface WatchItem {
    symbol: string;
    label: string;
    exchange: "NSE" | "BSE";
}

interface WatchRow extends WatchItem {
    price: number | null;
    movePct: number | null;
    signal: Signal;
    updatedAt: string | null;
    status: "loading" | "ok" | "error";
    error?: string;
}

const WATCHLIST: WatchItem[] = [
    { symbol: "^NSEI", label: "NIFTY 50", exchange: "NSE" },
    { symbol: "^NSEBANK", label: "BANK NIFTY", exchange: "NSE" },
    { symbol: "^CNXFINSERVICE", label: "FINNIFTY", exchange: "NSE" },
    { symbol: "^BSESN", label: "SENSEX", exchange: "BSE" },
];

const API_BASE = "/api";

function signalColor(signal: Signal): string {
    if (signal === "BUY") return "#22c55e";
    if (signal === "SELL") return "#ef4444";
    if (signal === "HOLD") return "#f59e0b";
    return "#94a3b8";
}

function moveColor(v: number | null): string {
    if (v === null) return "#94a3b8";
    if (v > 0) return "#22c55e";
    if (v < 0) return "#ef4444";
    return "#94a3b8";
}

function fmtPrice(v: number | null): string {
    if (v === null) return "--";
    return v.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtMove(v: number | null): string {
    if (v === null) return "--";
    const signed = v > 0 ? `+${v.toFixed(2)}` : v.toFixed(2);
    return `${signed}%`;
}

function fmtTime(ts: string | null): string {
    if (!ts) return "--";
    try {
        return new Date(ts).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" });
    } catch {
        return "--";
    }
}

export default function WatchlistPage() {
    const router = useRouter();
    const { setSelectedSymbol } = useSymbol();
    const [rows, setRows] = useState<WatchRow[]>(
        WATCHLIST.map((w) => ({
            ...w,
            price: null,
            movePct: null,
            signal: "UNKNOWN",
            updatedAt: null,
            status: "loading",
        }))
    );
    const [refreshing, setRefreshing] = useState(false);
    const [lastRefresh, setLastRefresh] = useState<number>(0);

    const fetchWatchlist = useCallback(async () => {
        setRefreshing(true);

        const results = await Promise.all(
            WATCHLIST.map(async (item) => {
                try {
                    const res = await fetch(`${API_BASE}/v1/analyze?symbol=${encodeURIComponent(item.symbol)}`, { cache: "no-store" });
                    if (!res.ok) {
                        const raw = await res.text();
                        throw new Error(raw || `HTTP ${res.status}`);
                    }
                    const json = (await res.json()) as AnalyzeApiResponse;

                    const open = typeof json?.candles?.[0]?.open === "number" && json.candles[0].open > 0
                        ? json.candles[0].open
                        : json.price;
                    const movePct = open > 0 ? ((json.price - open) / open) * 100 : null;
                    const signal = (["BUY", "SELL", "HOLD"].includes(json.decision) ? json.decision : "UNKNOWN") as Signal;

                    return {
                        ...item,
                        price: typeof json.price === "number" ? json.price : null,
                        movePct,
                        signal,
                        updatedAt: json.timestamp || new Date().toISOString(),
                        status: "ok" as const,
                    };
                } catch (err: unknown) {
                    const message = err instanceof Error ? err.message : "Failed to fetch";
                    return {
                        ...item,
                        price: null,
                        movePct: null,
                        signal: "UNKNOWN" as Signal,
                        updatedAt: null,
                        status: "error" as const,
                        error: message,
                    };
                }
            })
        );

        setRows(results);
        setLastRefresh(Date.now());
        setRefreshing(false);
    }, []);

    useEffect(() => {
        fetchWatchlist();
        const timer = setInterval(fetchWatchlist, 60_000);
        return () => clearInterval(timer);
    }, [fetchWatchlist]);

    const summary = useMemo(() => {
        const buy = rows.filter((r) => r.signal === "BUY").length;
        const sell = rows.filter((r) => r.signal === "SELL").length;
        const hold = rows.filter((r) => r.signal === "HOLD").length;
        return { buy, sell, hold };
    }, [rows]);

    return (
        <div className="max-w-6xl mx-auto px-4 md:px-6 pt-6 md:pt-10 pb-12 space-y-5 animate-fade-in">
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                    <p className="text-[0.7rem] font-extrabold text-brand-300 uppercase tracking-[0.16em]">Watchlist</p>
                    <h2 className="text-2xl md:text-3xl font-black text-white mt-1">Live Index Tracker</h2>
                    <p className="text-xs text-gray-400 mt-1">Quick view: price, intraday move, and rule-based signal.</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={fetchWatchlist}
                        disabled={refreshing}
                        className="px-3 py-1.5 rounded-lg border border-brand-500/30 bg-brand-500/10 text-brand-300 text-xs font-bold"
                    >
                        {refreshing ? "Refreshing..." : "Refresh"}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <SummaryCard label="BUY" value={summary.buy} color="#22c55e" />
                <SummaryCard label="SELL" value={summary.sell} color="#ef4444" />
                <SummaryCard label="HOLD" value={summary.hold} color="#f59e0b" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {rows.map((row) => (
                    <div
                        key={row.symbol}
                        className="glass-card p-4 border border-white/10 rounded-2xl"
                        style={{ background: "rgba(15,23,42,0.75)" }}
                    >
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <p className="text-base font-black text-white">{row.label}</p>
                                <p className="text-[11px] text-gray-500">{row.exchange} • {row.symbol}</p>
                            </div>
                            <span
                                style={{
                                    fontSize: "0.62rem",
                                    fontWeight: 800,
                                    color: signalColor(row.signal),
                                    border: `1px solid ${signalColor(row.signal)}55`,
                                    borderRadius: "999px",
                                    padding: "3px 8px",
                                    letterSpacing: "0.06em",
                                }}
                            >
                                {row.signal}
                            </span>
                        </div>

                        <div className="mt-4 flex items-end justify-between gap-3">
                            <div>
                                <p className="text-[10px] uppercase tracking-[0.12em] text-gray-500">LTP</p>
                                <p className="text-2xl font-black text-white">₹{fmtPrice(row.price)}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] uppercase tracking-[0.12em] text-gray-500">Move (vs open)</p>
                                <p className="text-base font-black" style={{ color: moveColor(row.movePct) }}>{fmtMove(row.movePct)}</p>
                            </div>
                        </div>

                        <div className="mt-4 flex items-center justify-between gap-3">
                            <p className="text-[11px] text-gray-500">
                                {row.status === "error" ? "Data unavailable" : `Updated ${fmtTime(row.updatedAt)} IST`}
                            </p>
                            <button
                                onClick={() => {
                                    setSelectedSymbol(row.symbol);
                                    router.push("/");
                                }}
                                className="px-2.5 py-1.5 text-[11px] rounded-lg border border-indigo-400/40 bg-indigo-500/10 text-indigo-300 font-bold"
                            >
                                Open Dashboard
                            </button>
                        </div>

                        {row.status === "error" && (
                            <div className="mt-2 text-[11px] text-rose-400">{row.error || "Failed to load data"}</div>
                        )}
                    </div>
                ))}
            </div>

            <div className="text-center">
                <p className="text-[10px] text-gray-600 font-medium">
                    {lastRefresh > 0
                        ? `Last refreshed ${new Date(lastRefresh).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" })} IST`
                        : "Connecting..."}{" "}
                    · Watchlist MVP
                </p>
            </div>
        </div>
    );
}

function SummaryCard({ label, value, color }: { label: string; value: number; color: string }) {
    return (
        <div
            className="glass-card rounded-xl p-3 border"
            style={{
                background: `${color}10`,
                borderColor: `${color}55`,
            }}
        >
            <p className="text-[10px] uppercase tracking-[0.12em] font-bold" style={{ color }}>{label} Signals</p>
            <p className="text-2xl font-black text-white mt-1">{value}</p>
        </div>
    );
}
