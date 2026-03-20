"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type AssetKind = "index" | "stock";
type Confidence = "HIGH" | "MEDIUM" | "LOW";

interface FocusOption {
    symbol: string;
    label: string;
    kind: AssetKind;
}

interface FocusOptionsResponse {
    items: FocusOption[];
    default_symbol: string;
    note: string;
}

interface FocusResponse {
    analysis_type: string;
    mode: "LIVE" | "EOD";
    market_open: boolean;
    label: string;
    symbol: string;
    price: number | null;
    session_date: string;
    today_trend: string;
    today_confidence: Confidence;
    today_signal: string;
    today_note: string;
    session_type: string;
    close_position: string;
    yesterday_session: string;
    yesterday_close_position: string;
    yesterday_move_pct: number | null;
    next_day_bias: string;
    next_day_confidence: Confidence;
    next_day_target: string | null;
    next_day_risk: string;
    next_day_note: string;
    next_week_bias: string;
    next_week_confidence: Confidence;
    next_week_target_zone: string | null;
    next_week_outlook: string;
    key_support: string[];
    key_resistance: string[];
    global_news_impact: string;
    global_news_items: string[];
    news_tomorrow: string[];
    captured_at: string;
    analysis_status: "full" | "fallback";
    free_tier_mode: boolean;
    source: string;
    asset_kind?: AssetKind;
}

const LIVE_REFRESH_MS = 600_000;
const EOD_REFRESH_MS = 3_600_000;

function fmtPrice(value: number | null | undefined): string {
    if (value === null || value === undefined || Number.isNaN(value)) return "--";
    return `Rs ${value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtPct(value: number | null | undefined): string {
    if (value === null || value === undefined || Number.isNaN(value)) return "--";
    const signed = value > 0 ? `+${value.toFixed(2)}` : value.toFixed(2);
    return `${signed}%`;
}

function fmtStamp(iso: string | null | undefined): string {
    if (!iso) return "--";
    try {
        return new Date(iso).toLocaleString("en-IN", {
            timeZone: "Asia/Kolkata",
            day: "2-digit",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
        });
    } catch {
        return "--";
    }
}

function toneForBias(bias: string) {
    const normalized = (bias || "").toUpperCase();
    if (normalized.includes("BULLISH") || normalized.includes("BUY")) {
        return {
            fg: "#22c55e",
            bg: "rgba(34,197,94,0.10)",
            border: "rgba(34,197,94,0.28)",
        };
    }
    if (normalized.includes("BEARISH") || normalized.includes("SELL")) {
        return {
            fg: "#ef4444",
            bg: "rgba(239,68,68,0.10)",
            border: "rgba(239,68,68,0.28)",
        };
    }
    return {
        fg: "#94a3b8",
        bg: "rgba(148,163,184,0.08)",
        border: "rgba(148,163,184,0.20)",
    };
}

function confidenceColor(confidence: Confidence): string {
    if (confidence === "HIGH") return "#22c55e";
    if (confidence === "MEDIUM") return "#f59e0b";
    return "#94a3b8";
}

export default function WatchlistPage() {
    const [options, setOptions] = useState<FocusOption[]>([]);
    const [selectedSymbol, setSelectedSymbol] = useState<string>("");
    const [note, setNote] = useState<string>("");
    const [data, setData] = useState<FocusResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const selectedOption = useMemo(
        () => options.find((item) => item.symbol === selectedSymbol) ?? null,
        [options, selectedSymbol]
    );

    const fetchOptions = useCallback(async () => {
        const res = await fetch("/api/v1/market-focus-options", { cache: "no-store" });
        if (!res.ok) {
            throw new Error(`Failed to load selector options (${res.status})`);
        }
        const json = (await res.json()) as FocusOptionsResponse;
        setOptions(json.items || []);
        setNote(json.note || "");
        setSelectedSymbol((current) => current || json.default_symbol || json.items?.[0]?.symbol || "^NSEI");
    }, []);

    const fetchFocus = useCallback(async (symbol: string, silent = false) => {
        if (!symbol) return;
        if (!silent) setLoading(true);
        setRefreshing(true);
        setError(null);

        try {
            const res = await fetch(`/api/v1/market-focus?symbol=${encodeURIComponent(symbol)}`, {
                cache: "no-store",
            });
            if (!res.ok) {
                const raw = await res.text();
                throw new Error(raw || `Failed to load market focus (${res.status})`);
            }
            const json = (await res.json()) as FocusResponse;
            setData(json);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to load market focus";
            setError(message);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        fetchOptions().catch((err: unknown) => {
            const message = err instanceof Error ? err.message : "Failed to load selector options";
            setError(message);
            setLoading(false);
        });
    }, [fetchOptions]);

    useEffect(() => {
        if (!selectedSymbol) return;
        fetchFocus(selectedSymbol);
    }, [selectedSymbol, fetchFocus]);

    useEffect(() => {
        if (!selectedSymbol) return;
        const refreshMs = data?.market_open ? LIVE_REFRESH_MS : EOD_REFRESH_MS;
        const timer = setInterval(() => {
            if (typeof document !== "undefined" && document.hidden) return;
            fetchFocus(selectedSymbol, true);
        }, refreshMs);
        return () => clearInterval(timer);
    }, [selectedSymbol, data?.market_open, fetchFocus]);

    const modeTone = toneForBias(data?.market_open ? "BULLISH" : "WAIT");
    const todayTone = toneForBias(data?.today_trend || "SIDEWAYS");
    const nextDayTone = toneForBias(data?.next_day_bias || "WAIT");
    const nextWeekTone = toneForBias(data?.next_week_bias || "NEUTRAL");

    return (
        <div className="max-w-6xl mx-auto px-4 md:px-6 pt-6 md:pt-10 pb-12 space-y-5 animate-fade-in">
            <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                    <p className="text-[0.72rem] font-extrabold text-brand-300 uppercase tracking-[0.18em]">Watchlist Focus</p>
                    <h2 className="text-2xl md:text-3xl font-black text-white mt-1">Today, Next Day, Next Week</h2>
                    <p className="text-xs text-gray-400 mt-1 max-w-2xl">
                        Selector-based focus view for headline indices plus Jaiprakash Power Ventures. Built to stay light on free-tier usage.
                    </p>
                </div>
                <button
                    onClick={() => selectedSymbol && fetchFocus(selectedSymbol, true)}
                    disabled={refreshing || !selectedSymbol}
                    className="px-3 py-1.5 rounded-lg border border-brand-500/30 bg-brand-500/10 text-brand-300 text-xs font-bold"
                >
                    {refreshing ? "Refreshing..." : "Refresh"}
                </button>
            </div>

            <div className="glass-card rounded-2xl p-4 border border-brand-500/20" style={{ background: "linear-gradient(135deg, rgba(15,23,42,0.86), rgba(15,23,42,0.72))" }}>
                <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                        <p className="text-[0.62rem] uppercase tracking-[0.18em] text-brand-300 font-extrabold">Selector</p>
                        <p className="text-sm text-gray-400 mt-1">Switch asset to view live structure, next-day bias, and weekly outlook.</p>
                    </div>
                    <div className="text-right">
                        <p className="text-[0.62rem] uppercase tracking-[0.18em] text-gray-500 font-extrabold">Free-Tier Mode</p>
                        <p className="text-xs text-emerald-300 mt-1">{note || "yfinance + public RSS, with cached refresh windows."}</p>
                    </div>
                </div>

                <div className="flex flex-wrap gap-2 mt-4">
                    {options.map((item) => {
                        const active = item.symbol === selectedSymbol;
                        return (
                            <button
                                key={item.symbol}
                                onClick={() => setSelectedSymbol(item.symbol)}
                                className="px-3 py-2 rounded-xl border text-sm font-bold transition-all"
                                style={{
                                    borderColor: active ? "rgba(99,102,241,0.45)" : "rgba(148,163,184,0.18)",
                                    background: active ? "rgba(99,102,241,0.12)" : "rgba(15,23,42,0.35)",
                                    color: active ? "#c7d2fe" : "#cbd5e1",
                                }}
                            >
                                {item.label}
                                <span style={{ marginLeft: "8px", fontSize: "0.62rem", color: active ? "#93c5fd" : "#64748b" }}>
                                    {item.kind === "stock" ? "STOCK" : "INDEX"}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {error && !data && (
                <div className="glass-card p-4 border border-rose-500/20 bg-rose-500/5">
                    <p className="text-sm font-semibold text-rose-400">Failed to load market focus</p>
                    <p className="text-xs text-gray-400 mt-1">{error}</p>
                </div>
            )}

            {loading && !data ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {Array(3).fill(0).map((_, idx) => (
                        <div key={idx} className="glass-card rounded-2xl border border-white/10" style={{ minHeight: "220px", background: "rgba(15,23,42,0.72)", animation: "pulse 1.8s infinite" }} />
                    ))}
                </div>
            ) : data ? (
                <>
                    <div className="glass-card rounded-2xl p-5 border border-white/10" style={{ background: "rgba(15,23,42,0.78)" }}>
                        <div className="flex items-start justify-between gap-4 flex-wrap">
                            <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                    <p className="text-2xl font-black text-white">{data.label}</p>
                                    <span
                                        style={{
                                            fontSize: "0.62rem",
                                            fontWeight: 800,
                                            color: modeTone.fg,
                                            background: modeTone.bg,
                                            border: `1px solid ${modeTone.border}`,
                                            borderRadius: "999px",
                                            padding: "3px 9px",
                                            letterSpacing: "0.08em",
                                        }}
                                    >
                                        {data.market_open ? "LIVE MARKET" : "POST-CLOSE"}
                                    </span>
                                    <span className="text-[11px] text-gray-500">{data.symbol}</span>
                                </div>
                                <p className="text-sm text-gray-400 mt-2 max-w-2xl">{data.today_note}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-[0.62rem] uppercase tracking-[0.18em] text-gray-500 font-extrabold">Last Price</p>
                                <p className="text-3xl font-black text-white mt-1">{fmtPrice(data.price)}</p>
                                <p className="text-[11px] text-gray-500 mt-2">Updated {fmtStamp(data.captured_at)} IST</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-5">
                            <MiniStat label="Today Signal" value={data.today_signal} color={todayTone.fg} />
                            <MiniStat label="Session Type" value={data.session_type} color="#cbd5e1" />
                            <MiniStat label="Yesterday Move" value={fmtPct(data.yesterday_move_pct)} color={data.yesterday_move_pct === null || data.yesterday_move_pct === undefined ? "#94a3b8" : data.yesterday_move_pct >= 0 ? "#22c55e" : "#ef4444"} />
                            <MiniStat label="Source" value={data.source} color="#93c5fd" />
                        </div>
                    </div>

                    {data.analysis_status === "fallback" && (
                        <div className="glass-card p-4 border border-amber-500/20" style={{ background: "rgba(245,158,11,0.06)" }}>
                            <p className="text-sm font-semibold text-amber-300">Using fallback output</p>
                            <p className="text-xs text-gray-400 mt-1">The page stayed stable, but the data provider or market feed did not return a full result.</p>
                        </div>
                    )}

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        <TrendCard
                            eyebrow="Today"
                            title={data.today_trend}
                            confidence={data.today_confidence}
                            note={data.today_note}
                            tone={todayTone}
                            detailLabel="Close Position"
                            detailValue={data.close_position}
                        />
                        <TrendCard
                            eyebrow="Next Trading Day"
                            title={data.next_day_bias}
                            confidence={data.next_day_confidence}
                            note={data.next_day_note}
                            tone={nextDayTone}
                            detailLabel="Target"
                            detailValue={data.next_day_target || "Wait for confirmation"}
                            footer={data.next_day_risk}
                        />
                        <TrendCard
                            eyebrow="Next Week"
                            title={data.next_week_bias}
                            confidence={data.next_week_confidence}
                            note={data.next_week_outlook}
                            tone={nextWeekTone}
                            detailLabel="Target Zone"
                            detailValue={data.next_week_target_zone || "Range-bound bias"}
                        />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.9fr] gap-4">
                        <div className="glass-card rounded-2xl p-5 border border-white/10" style={{ background: "rgba(15,23,42,0.78)" }}>
                            <p className="text-[0.65rem] uppercase tracking-[0.18em] text-brand-300 font-extrabold">Context</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                                <InfoBlock label="Previous Session" value={data.yesterday_session} />
                                <InfoBlock label="Previous Close Position" value={data.yesterday_close_position} />
                                <InfoBlock label="Current Session" value={data.session_type} />
                                <InfoBlock label="Market Mode" value={data.market_open ? "Live intraday structure" : "Closed-session outlook"} />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
                                <LevelBlock title="Support" levels={data.key_support} tone="#22c55e" />
                                <LevelBlock title="Resistance" levels={data.key_resistance} tone="#ef4444" />
                            </div>
                        </div>

                        <div className="glass-card rounded-2xl p-5 border border-white/10" style={{ background: "rgba(15,23,42,0.78)" }}>
                            <p className="text-[0.65rem] uppercase tracking-[0.18em] text-brand-300 font-extrabold">News Context</p>
                            <p className="text-base font-black mt-3" style={{ color: "#f8fafc" }}>{data.global_news_impact}</p>
                            <div className="mt-4 space-y-2">
                                {(data.global_news_items.length ? data.global_news_items : ["No major live headlines were ranked for this cycle."]).map((item, idx) => (
                                    <div key={idx} className="rounded-xl border border-white/8 px-3 py-2" style={{ background: "rgba(255,255,255,0.03)" }}>
                                        <p className="text-sm text-gray-200 leading-6">{item}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="glass-card rounded-2xl p-5 border border-white/10" style={{ background: "rgba(15,23,42,0.74)" }}>
                        <div className="flex items-start justify-between gap-4 flex-wrap">
                            <div>
                                <p className="text-[0.65rem] uppercase tracking-[0.18em] text-brand-300 font-extrabold">Delivery Note</p>
                                <p className="text-sm text-gray-300 mt-2 max-w-3xl">
                                    This page is intentionally rule-based and cached. It uses public RSS headlines plus market-price structure, so it gives a useful low-cost bias without adding live Gemini pressure to your free-tier setup.
                                </p>
                            </div>
                            <div className="text-right">
                                <p className="text-[11px] text-gray-500">Selected asset</p>
                                <p className="text-sm font-bold text-white mt-1">{selectedOption?.label || data.label}</p>
                            </div>
                        </div>
                    </div>
                </>
            ) : null}

            <style>{`
                @keyframes pulse {
                    0% { opacity: 0.5; }
                    50% { opacity: 1; }
                    100% { opacity: 0.5; }
                }
            `}</style>
        </div>
    );
}

function MiniStat({ label, value, color }: { label: string; value: string; color: string }) {
    return (
        <div className="rounded-xl border border-white/8 px-3 py-3" style={{ background: "rgba(255,255,255,0.03)" }}>
            <p className="text-[0.58rem] uppercase tracking-[0.16em] text-gray-500 font-extrabold">{label}</p>
            <p className="text-sm font-bold mt-2" style={{ color }}>{value}</p>
        </div>
    );
}

function TrendCard({
    eyebrow,
    title,
    confidence,
    note,
    tone,
    detailLabel,
    detailValue,
    footer,
}: {
    eyebrow: string;
    title: string;
    confidence: Confidence;
    note: string;
    tone: { fg: string; bg: string; border: string };
    detailLabel: string;
    detailValue: string;
    footer?: string;
}) {
    return (
        <div className="glass-card rounded-2xl p-5 border" style={{ background: tone.bg, borderColor: tone.border }}>
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="text-[0.62rem] uppercase tracking-[0.18em] font-extrabold" style={{ color: tone.fg }}>{eyebrow}</p>
                    <p className="text-2xl font-black mt-2" style={{ color: tone.fg }}>{title}</p>
                </div>
                <span style={{ fontSize: "0.62rem", fontWeight: 800, color: confidenceColor(confidence) }}>
                    {confidence}
                </span>
            </div>
            <p className="text-sm text-gray-200 mt-4 leading-6">{note}</p>
            <div className="mt-5 rounded-xl border border-white/10 px-3 py-3" style={{ background: "rgba(15,23,42,0.28)" }}>
                <p className="text-[0.56rem] uppercase tracking-[0.16em] text-gray-500 font-extrabold">{detailLabel}</p>
                <p className="text-base font-bold text-white mt-2">{detailValue}</p>
            </div>
            {footer && <p className="text-xs text-gray-400 mt-4 leading-5">{footer}</p>}
        </div>
    );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-xl border border-white/8 px-3 py-3" style={{ background: "rgba(255,255,255,0.03)" }}>
            <p className="text-[0.58rem] uppercase tracking-[0.16em] text-gray-500 font-extrabold">{label}</p>
            <p className="text-sm text-gray-200 font-bold mt-2">{value}</p>
        </div>
    );
}

function LevelBlock({ title, levels, tone }: { title: string; levels: string[]; tone: string }) {
    return (
        <div className="rounded-2xl border px-4 py-4" style={{ borderColor: `${tone}55`, background: `${tone}10` }}>
            <p className="text-[0.58rem] uppercase tracking-[0.16em] font-extrabold" style={{ color: tone }}>{title}</p>
            <div className="mt-3 space-y-2">
                {(levels.length ? levels : ["--"]).map((level, idx) => (
                    <p key={idx} className="text-base font-black" style={{ color: tone }}>{level}</p>
                ))}
            </div>
        </div>
    );
}

