"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

interface ExpirySpec {
    abbr: string;
    name: string;
    exchange: "NSE" | "BSE";
    expiryDay: number; // JS weekday: 0=Sun..6=Sat
}

interface OptionLeg {
    contract: string;
    entry: string;
    sl: string;
    target: string;
}

interface WindowPlan {
    window: string;
    status: "WAIT" | "ACTIVE" | "CLOSED" | string;
    confidence: "LOW" | "MEDIUM" | "HIGH" | string;
    ce: OptionLeg;
    pe: OptionLeg;
    note: string;
}

interface ZeroHeroPlan {
    index: string;
    index_name: string;
    exchange: "NSE" | "BSE";
    symbol: string;
    expiry_today: boolean;
    next_expiry?: string;
    spot: number | null;
    headline: string;
    overall_risk: "HIGH" | "VERY_HIGH" | "EXTREME" | string;
    market_phase: string;
    no_trade_filter: string;
    risk_note: string;
    windows: WindowPlan[];
    news_items?: string[];
    source: "ai" | "fallback" | "info" | string;
    captured_at: string;
    message?: string;
}

const EXPIRY_INDICES: ExpirySpec[] = [
    { abbr: "NIFTY", name: "Nifty 50", exchange: "NSE", expiryDay: 4 },
    { abbr: "BANKNIFTY", name: "Bank Nifty", exchange: "NSE", expiryDay: 3 },
    { abbr: "FINNIFTY", name: "Fin Nifty", exchange: "NSE", expiryDay: 2 },
    { abbr: "SENSEX", name: "Sensex", exchange: "BSE", expiryDay: 5 },
];

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function getIstShiftedNow(): Date {
    const now = new Date();
    return new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
}

function getIstDateOnly(d: Date): Date {
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function getNextExpiry(expiryDay: number, fromDate: Date): Date {
    const day = fromDate.getUTCDay();
    const diff = (expiryDay - day + 7) % 7;
    const out = new Date(fromDate);
    out.setUTCDate(out.getUTCDate() + diff);
    return out;
}

function daysBetween(a: Date, b: Date): number {
    return Math.round((b.getTime() - a.getTime()) / 86400000);
}

function fmtDateShort(d: Date): string {
    return `${DAYS[d.getUTCDay()]}, ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

function fmtNum(v: number): string {
    return v.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

function fmtTime(ts: string): string {
    if (!ts) return "--";
    const d = new Date(ts);
    const hh = d.getUTCHours().toString().padStart(2, "0");
    const mm = d.getUTCMinutes().toString().padStart(2, "0");
    return `${hh}:${mm}`;
}

function statusColor(status: string): string {
    if (status === "ACTIVE") return "#22c55e";
    if (status === "WAIT") return "#f59e0b";
    return "#64748b";
}

function riskColor(risk: string): string {
    if (risk === "EXTREME") return "#ef4444";
    if (risk === "VERY_HIGH") return "#f97316";
    return "#f59e0b";
}

function confidenceColor(conf: string): string {
    if (conf === "HIGH") return "#22c55e";
    if (conf === "MEDIUM") return "#f59e0b";
    return "#94a3b8";
}

export default function ExpiryZeroHeroPanel() {
    const [istNow, setIstNow] = useState<Date>(getIstShiftedNow());
    const [plansByIndex, setPlansByIndex] = useState<Record<string, ZeroHeroPlan>>({});
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [countdown, setCountdown] = useState(300);

    useEffect(() => {
        const timer = setInterval(() => setIstNow(getIstShiftedNow()), 60_000);
        return () => clearInterval(timer);
    }, []);

    const today = getIstDateOnly(istNow);

    const rows = useMemo(() => {
        return EXPIRY_INDICES.map((idx) => {
            const nextExpiry = getNextExpiry(idx.expiryDay, today);
            const days = daysBetween(today, nextExpiry);
            return { ...idx, nextExpiry, days, isToday: days === 0 };
        }).sort((a, b) => a.days - b.days || a.abbr.localeCompare(b.abbr));
    }, [today]);

    const todayExpiries = useMemo(() => rows.filter((r) => r.isToday), [rows]);
    const nearest = rows[0];
    const todayExpiryKey = useMemo(() => todayExpiries.map((x) => x.abbr).join("|"), [todayExpiries]);

    const fetchPlans = useCallback(async () => {
        if (todayExpiries.length === 0) {
            setPlansByIndex({});
            setError(null);
            return;
        }

        try {
            setIsLoading(true);
            setError(null);

            const results = await Promise.all(
                todayExpiries.map(async (idx) => {
                    const res = await fetch(`/api/v1/expiry-zero-hero?index=${encodeURIComponent(idx.abbr)}`, { cache: "no-store" });
                    const data = await res.json();
                    if (!res.ok) {
                        throw new Error(data?.detail || `Failed for ${idx.abbr}`);
                    }
                    const normalized: ZeroHeroPlan = {
                        index: data.index || idx.abbr,
                        index_name: data.index_name || idx.name,
                        exchange: data.exchange || idx.exchange,
                        symbol: data.symbol || "",
                        expiry_today: Boolean(data.expiry_today),
                        next_expiry: data.next_expiry,
                        spot: typeof data.spot === "number" ? data.spot : null,
                        headline: data.headline || "Expiry setup",
                        overall_risk: data.overall_risk || "HIGH",
                        market_phase: data.market_phase || "PRE_1PM",
                        no_trade_filter: data.no_trade_filter || "Skip unclear setups.",
                        risk_note: data.risk_note || "High risk section.",
                        windows: Array.isArray(data.windows) ? data.windows : [],
                        news_items: Array.isArray(data.news_items) ? data.news_items : [],
                        source: data.source || "info",
                        captured_at: data.captured_at || "",
                        message: data.message || undefined,
                    };
                    return [idx.abbr, normalized] as const;
                })
            );

            const nextMap: Record<string, ZeroHeroPlan> = {};
            for (const [abbr, item] of results) {
                nextMap[abbr] = item;
            }
            setPlansByIndex(nextMap);
            setCountdown(300);
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : "Unable to load expiry AI plan");
        } finally {
            setIsLoading(false);
        }
    }, [todayExpiries]);

    useEffect(() => {
        fetchPlans();
    }, [fetchPlans, todayExpiryKey]);

    useEffect(() => {
        if (todayExpiries.length === 0) return;
        const tick = setInterval(() => {
            setCountdown((c) => {
                if (c <= 1) {
                    fetchPlans();
                    return 300;
                }
                return c - 1;
            });
        }, 1000);
        return () => clearInterval(tick);
    }, [fetchPlans, todayExpiries.length]);

    const mins = Math.floor(countdown / 60);
    const secs = String(countdown % 60).padStart(2, "0");

    return (
        <div style={{ marginTop: "0.9rem", border: "1px solid rgba(251,146,60,0.25)", borderRadius: "14px", padding: "0.9rem", background: "rgba(251,146,60,0.05)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.6rem", flexWrap: "wrap", marginBottom: "0.7rem" }}>
                <div>
                    <div style={{ fontSize: "0.64rem", fontWeight: 900, color: "#fb923c", textTransform: "uppercase", letterSpacing: "0.14em" }}>
                        Expiry Zero-To-Hero (AI Plan)
                    </div>
                    <div style={{ marginTop: "0.2rem", fontSize: "0.73rem", color: "#e2e8f0", fontWeight: 700 }}>
                        {todayExpiries.length > 0
                            ? `Today's expiry indices: ${todayExpiries.map((x) => x.abbr).join(", ")}`
                            : `No expiry today | Next: ${nearest.abbr} (${nearest.exchange}) on ${fmtDateShort(nearest.nextExpiry)}${nearest.days === 1 ? " (Tomorrow)" : ` (in ${nearest.days} days)`}`}
                    </div>
                    <div style={{ marginTop: "0.2rem", fontSize: "0.58rem", color: "#94a3b8" }}>
                        Separate AI prompt panel. Exact CE/PE contracts with entry, SL, and target.
                    </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "0.55rem" }}>
                    {todayExpiries.length > 0 && (
                        <span style={{ fontSize: "0.58rem", color: "#64748b", fontWeight: 700 }}>
                            Next refresh: {mins}:{secs}
                        </span>
                    )}
                    <button
                        onClick={fetchPlans}
                        disabled={isLoading}
                        style={{
                            fontSize: "0.62rem",
                            padding: "5px 11px",
                            borderRadius: "8px",
                            background: "rgba(99,102,241,0.12)",
                            border: "1px solid rgba(99,102,241,0.24)",
                            color: "#818cf8",
                            cursor: "pointer",
                            fontWeight: 700,
                        }}
                    >
                        {isLoading ? "Loading..." : "Refresh"}
                    </button>
                    <span style={{ fontSize: "0.58rem", color: "#94a3b8", fontWeight: 700 }}>
                        Time now: {String(istNow.getUTCHours()).padStart(2, "0")}:{String(istNow.getUTCMinutes()).padStart(2, "0")} IST
                    </span>
                </div>
            </div>

            {error && (
                <div style={{ borderRadius: "10px", border: "1px solid rgba(239,68,68,0.35)", background: "rgba(239,68,68,0.08)", padding: "0.7rem", marginBottom: "0.7rem", color: "#fca5a5", fontSize: "0.64rem", fontWeight: 700 }}>
                    {error}
                </div>
            )}

            {todayExpiries.length === 0 ? (
                <div style={{ borderRadius: "10px", border: "1px solid rgba(148,163,184,0.2)", background: "rgba(15,23,42,0.45)", padding: "0.75rem" }}>
                    <div style={{ fontSize: "0.66rem", color: "#cbd5e1", lineHeight: 1.55 }}>
                        No index expiry today. This AI panel activates only on expiry day.
                    </div>
                    <div style={{ marginTop: "0.45rem", fontSize: "0.62rem", color: "#94a3b8", lineHeight: 1.5 }}>
                        Upcoming expiry: {nearest.name} ({nearest.abbr}) on {fmtDateShort(nearest.nextExpiry)}. On expiry day, this panel will show exact CE/PE contracts for 1 PM, 2 PM, and 3 PM windows.
                    </div>
                </div>
            ) : (
                <div style={{ display: "grid", gap: "0.8rem" }}>
                    {todayExpiries.map((expiryIdx) => {
                        const plan = plansByIndex[expiryIdx.abbr];
                        return (
                            <div key={expiryIdx.abbr} style={{ borderRadius: "12px", border: "1px solid rgba(255,255,255,0.08)", background: "rgba(2,6,23,0.55)", padding: "0.75rem" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.6rem", flexWrap: "wrap", marginBottom: "0.55rem" }}>
                                    <div style={{ fontSize: "0.72rem", fontWeight: 900, color: "#e2e8f0" }}>
                                        {expiryIdx.abbr} ({expiryIdx.exchange}) | AI Expiry Plan
                                    </div>
                                    <div style={{ display: "flex", alignItems: "center", gap: "0.48rem", flexWrap: "wrap" }}>
                                        <span style={{ fontSize: "0.58rem", color: "#94a3b8", fontWeight: 700 }}>
                                            Spot: {typeof plan?.spot === "number" ? fmtNum(plan.spot) : "Not available"}
                                        </span>
                                        <span style={{ fontSize: "0.56rem", fontWeight: 900, color: "#f87171", border: "1px solid rgba(239,68,68,0.45)", borderRadius: "999px", padding: "2px 8px" }}>
                                            EXPIRY TODAY
                                        </span>
                                        <span style={{ fontSize: "0.56rem", fontWeight: 900, color: plan?.source === "ai" ? "#22c55e" : "#f59e0b", border: `1px solid ${plan?.source === "ai" ? "rgba(34,197,94,0.4)" : "rgba(245,158,11,0.4)"}`, borderRadius: "999px", padding: "2px 8px" }}>
                                            {plan?.source === "ai" ? "AI LIVE" : "FALLBACK"}
                                        </span>
                                    </div>
                                </div>

                                {!plan ? (
                                    <div style={{ borderRadius: "10px", border: "1px solid rgba(148,163,184,0.2)", background: "rgba(15,23,42,0.45)", padding: "0.75rem", fontSize: "0.64rem", color: "#94a3b8" }}>
                                        Loading AI setup...
                                    </div>
                                ) : (
                                    <div style={{ display: "grid", gap: "0.62rem" }}>
                                        <div style={{ borderRadius: "10px", border: "1px solid rgba(251,146,60,0.24)", background: "rgba(251,146,60,0.08)", padding: "0.65rem" }}>
                                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                                                <div style={{ fontSize: "0.68rem", fontWeight: 800, color: "#fcd34d" }}>{plan.headline}</div>
                                                <div style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}>
                                                    <span style={{ fontSize: "0.56rem", color: riskColor(plan.overall_risk), fontWeight: 800 }}>Risk {plan.overall_risk}</span>
                                                    <span style={{ fontSize: "0.56rem", color: "#94a3b8", fontWeight: 700 }}>{plan.market_phase}</span>
                                                </div>
                                            </div>
                                            <div style={{ marginTop: "0.35rem", fontSize: "0.62rem", color: "#cbd5e1", lineHeight: 1.5 }}>
                                                No-trade filter: {plan.no_trade_filter}
                                            </div>
                                        </div>

                                        {plan.windows.map((w) => (
                                            <div key={`${plan.index}-${w.window}`} style={{ borderRadius: "10px", border: "1px solid rgba(255,255,255,0.08)", background: "rgba(15,23,42,0.5)", padding: "0.65rem" }}>
                                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.45rem" }}>
                                                    <div style={{ fontSize: "0.68rem", fontWeight: 800, color: "#e2e8f0" }}>
                                                        {w.window} Window | AI contracts
                                                    </div>
                                                    <div style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}>
                                                        <span style={{ fontSize: "0.56rem", color: confidenceColor(w.confidence), fontWeight: 800 }}>Confidence {w.confidence}</span>
                                                        <span style={{ fontSize: "0.56rem", fontWeight: 900, color: statusColor(w.status), border: `1px solid ${statusColor(w.status)}55`, borderRadius: "999px", padding: "2px 7px" }}>
                                                            {w.status}
                                                        </span>
                                                    </div>
                                                </div>

                                                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "0.6rem" }}>
                                                    <div style={{ borderRadius: "10px", border: "1px solid rgba(34,197,94,0.3)", background: "rgba(34,197,94,0.08)", padding: "0.65rem" }}>
                                                        <div style={{ fontSize: "0.62rem", fontWeight: 900, color: "#22c55e", letterSpacing: "0.1em", textTransform: "uppercase" }}>CE Buy Setup</div>
                                                        <div style={{ marginTop: "0.3rem", fontSize: "0.74rem", fontWeight: 900, color: "#e2e8f0" }}>{w.ce?.contract || `${plan.index} CE`}</div>
                                                        <div style={{ marginTop: "0.32rem", fontSize: "0.62rem", color: "#cbd5e1", lineHeight: 1.5 }}>Entry: {w.ce?.entry || "--"}</div>
                                                        <div style={{ marginTop: "0.22rem", fontSize: "0.62rem", color: "#cbd5e1", lineHeight: 1.5 }}>SL/Invalidation: {w.ce?.sl || "--"}</div>
                                                        <div style={{ marginTop: "0.22rem", fontSize: "0.62rem", color: "#cbd5e1", lineHeight: 1.5 }}>Target/Exit: {w.ce?.target || "--"}</div>
                                                    </div>

                                                    <div style={{ borderRadius: "10px", border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.08)", padding: "0.65rem" }}>
                                                        <div style={{ fontSize: "0.62rem", fontWeight: 900, color: "#ef4444", letterSpacing: "0.1em", textTransform: "uppercase" }}>PE Buy Setup</div>
                                                        <div style={{ marginTop: "0.3rem", fontSize: "0.74rem", fontWeight: 900, color: "#e2e8f0" }}>{w.pe?.contract || `${plan.index} PE`}</div>
                                                        <div style={{ marginTop: "0.32rem", fontSize: "0.62rem", color: "#cbd5e1", lineHeight: 1.5 }}>Entry: {w.pe?.entry || "--"}</div>
                                                        <div style={{ marginTop: "0.22rem", fontSize: "0.62rem", color: "#cbd5e1", lineHeight: 1.5 }}>SL/Invalidation: {w.pe?.sl || "--"}</div>
                                                        <div style={{ marginTop: "0.22rem", fontSize: "0.62rem", color: "#cbd5e1", lineHeight: 1.5 }}>Target/Exit: {w.pe?.target || "--"}</div>
                                                    </div>
                                                </div>

                                                <div style={{ marginTop: "0.45rem", fontSize: "0.6rem", color: "#fbbf24", fontWeight: 700, lineHeight: 1.5 }}>
                                                    Note: {w.note || "Use strict risk and fast execution."}
                                                </div>
                                            </div>
                                        ))}

                                        <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem", flexWrap: "wrap" }}>
                                            <div style={{ fontSize: "0.6rem", color: "#fbbf24", fontWeight: 700 }}>
                                                Risk note: {plan.risk_note}
                                            </div>
                                            <div style={{ fontSize: "0.58rem", color: "#64748b", fontWeight: 700 }}>
                                                Updated: {fmtTime(plan.captured_at)} IST
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
