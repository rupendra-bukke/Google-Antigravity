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
    source: "ai" | "fallback" | "info" | string;
    captured_at: string;
}

const EXPIRY_INDICES: ExpirySpec[] = [
    { abbr: "NIFTY", name: "Nifty 50", exchange: "NSE", expiryDay: 4 },
    { abbr: "BANKNIFTY", name: "Bank Nifty", exchange: "NSE", expiryDay: 3 },
    { abbr: "FINNIFTY", name: "Fin Nifty", exchange: "NSE", expiryDay: 2 },
    { abbr: "SENSEX", name: "Sensex", exchange: "BSE", expiryDay: 5 },
];

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAY_TO_INDEX: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
};

interface IstClock {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    weekdayIndex: number;
}

function getIstClock(now: Date = new Date()): IstClock {
    const parts = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Kolkata",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        weekday: "short",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    }).formatToParts(now);

    const pick = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value || "";
    const weekday = pick("weekday");

    return {
        year: Number(pick("year")),
        month: Number(pick("month")),
        day: Number(pick("day")),
        hour: Number(pick("hour")),
        minute: Number(pick("minute")),
        weekdayIndex: WEEKDAY_TO_INDEX[weekday] ?? 0,
    };
}

function getIstDateOnly(clock: IstClock): Date {
    return new Date(Date.UTC(clock.year, clock.month - 1, clock.day));
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

function phaseToWindow(phase: string): string {
    if (phase === "1PM_2PM" || phase === "PRE_1PM") return "1PM";
    if (phase === "2PM_3PM") return "2PM";
    return "3PM";
}

function sourceBadge(source: string): { text: string; color: string; border: string } {
    if (source === "ai") {
        return { text: "AI LIVE", color: "#22c55e", border: "rgba(34,197,94,0.4)" };
    }
    if (source === "info") {
        return { text: "INFO", color: "#93c5fd", border: "rgba(59,130,246,0.4)" };
    }
    return { text: "FALLBACK", color: "#f59e0b", border: "rgba(245,158,11,0.4)" };
}

function pickPrimaryWindow(plan: ZeroHeroPlan): WindowPlan | null {
    if (!plan.windows || plan.windows.length === 0) return null;
    const active = plan.windows.find((w) => (w.status || "").toUpperCase() === "ACTIVE");
    if (active) return active;
    const phaseMatch = plan.windows.find((w) => (w.window || "").toUpperCase().startsWith(phaseToWindow(plan.market_phase)));
    return phaseMatch || plan.windows[0];
}

function compactText(value: string | undefined, maxLen: number): string {
    const text = (value || "").trim();
    if (text.length <= maxLen) return text || "--";
    return `${text.slice(0, maxLen - 1)}...`;
}

export default function ExpiryZeroHeroPanel() {
    const [istClock, setIstClock] = useState<IstClock>(getIstClock());
    const [plansByIndex, setPlansByIndex] = useState<Record<string, ZeroHeroPlan>>({});
    const [expandedByIndex, setExpandedByIndex] = useState<Record<string, boolean>>({});
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [countdown, setCountdown] = useState(300);

    useEffect(() => {
        const timer = setInterval(() => setIstClock(getIstClock()), 60_000);
        return () => clearInterval(timer);
    }, []);

    const today = getIstDateOnly(istClock);

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
                        source: data.source || "info",
                        captured_at: data.captured_at || "",
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
                    <div style={{ marginTop: "0.18rem", fontSize: "0.72rem", color: "#e2e8f0", fontWeight: 700 }}>
                        {todayExpiries.length > 0
                            ? `Today's expiry: ${todayExpiries.map((x) => x.abbr).join(", ")}`
                            : `No expiry today | Next: ${nearest.abbr} on ${fmtDateShort(nearest.nextExpiry)}`}
                    </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                    {todayExpiries.length > 0 && <span style={{ fontSize: "0.58rem", color: "#64748b", fontWeight: 700 }}>Next refresh: {mins}:{secs}</span>}
                    <button
                        onClick={fetchPlans}
                        disabled={isLoading}
                        style={{
                            fontSize: "0.62rem",
                            padding: "4px 10px",
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
                        {String(istClock.hour).padStart(2, "0")}:{String(istClock.minute).padStart(2, "0")} IST
                    </span>
                </div>
            </div>

            {error && (
                <div style={{ borderRadius: "10px", border: "1px solid rgba(239,68,68,0.35)", background: "rgba(239,68,68,0.08)", padding: "0.65rem", marginBottom: "0.65rem", color: "#fca5a5", fontSize: "0.64rem", fontWeight: 700 }}>
                    {error}
                </div>
            )}

            {todayExpiries.length === 0 ? (
                <div style={{ borderRadius: "10px", border: "1px solid rgba(148,163,184,0.2)", background: "rgba(15,23,42,0.45)", padding: "0.7rem" }}>
                    <div style={{ fontSize: "0.64rem", color: "#cbd5e1", lineHeight: 1.5 }}>
                        This panel activates on expiry day only. It will show exact CE/PE contracts with entry, SL, and target.
                    </div>
                </div>
            ) : (
                <div style={{ display: "grid", gap: "0.7rem" }}>
                    {todayExpiries.map((expiryIdx) => {
                        const plan = plansByIndex[expiryIdx.abbr];
                        const primary = plan ? pickPrimaryWindow(plan) : null;
                        const showAll = Boolean(expandedByIndex[expiryIdx.abbr]);
                        const otherWindows = plan?.windows?.filter((w) => w !== primary) || [];
                        const badge = sourceBadge(plan?.source || "info");

                        return (
                            <div key={expiryIdx.abbr} style={{ borderRadius: "11px", border: "1px solid rgba(255,255,255,0.08)", background: "rgba(2,6,23,0.55)", padding: "0.7rem" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.55rem" }}>
                                    <div style={{ fontSize: "0.7rem", fontWeight: 900, color: "#e2e8f0" }}>
                                        {expiryIdx.abbr} ({expiryIdx.exchange})
                                    </div>
                                    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap" }}>
                                        <span style={{ fontSize: "0.56rem", color: "#94a3b8", fontWeight: 700 }}>
                                            Spot: {typeof plan?.spot === "number" ? fmtNum(plan.spot) : "--"}
                                        </span>
                                        <span style={{ fontSize: "0.54rem", fontWeight: 900, color: badge.color, border: `1px solid ${badge.border}`, borderRadius: "999px", padding: "2px 7px" }}>
                                            {badge.text}
                                        </span>
                                        <span style={{ fontSize: "0.54rem", fontWeight: 800, color: plan ? riskColor(plan.overall_risk) : "#94a3b8" }}>
                                            {plan ? `RISK ${plan.overall_risk}` : ""}
                                        </span>
                                    </div>
                                </div>

                                {!plan ? (
                                    <div style={{ borderRadius: "8px", border: "1px solid rgba(148,163,184,0.2)", background: "rgba(15,23,42,0.45)", padding: "0.65rem", fontSize: "0.62rem", color: "#94a3b8" }}>
                                        Loading setup...
                                    </div>
                                ) : !primary ? (
                                    <div style={{ borderRadius: "8px", border: "1px solid rgba(59,130,246,0.3)", background: "rgba(59,130,246,0.08)", padding: "0.65rem", fontSize: "0.62rem", color: "#bfdbfe", lineHeight: 1.45 }}>
                                        Back-end says this index is not in active expiry mode right now. Next expiry: {plan.next_expiry || "--"}.
                                    </div>
                                ) : (
                                    <div style={{ display: "grid", gap: "0.55rem" }}>
                                        <div style={{ borderRadius: "8px", border: "1px solid rgba(251,146,60,0.24)", background: "rgba(251,146,60,0.08)", padding: "0.58rem" }}>
                                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.4rem", flexWrap: "wrap" }}>
                                                <div style={{ fontSize: "0.64rem", fontWeight: 800, color: "#fcd34d" }}>
                                                    {compactText(plan.headline, 62)}
                                                </div>
                                                <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                                                    <span style={{ fontSize: "0.56rem", color: statusColor(primary.status), fontWeight: 800 }}>{primary.window} {primary.status}</span>
                                                    <span style={{ fontSize: "0.56rem", color: "#94a3b8", fontWeight: 700 }}>{plan.market_phase}</span>
                                                </div>
                                            </div>
                                            <div style={{ marginTop: "0.28rem", fontSize: "0.58rem", color: "#cbd5e1", lineHeight: 1.4 }}>
                                                Filter: {compactText(plan.no_trade_filter, 95)}
                                            </div>
                                        </div>

                                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "0.5rem" }}>
                                            <CompactLeg title="CE" color="#22c55e" leg={primary.ce} />
                                            <CompactLeg title="PE" color="#ef4444" leg={primary.pe} />
                                        </div>

                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.45rem", flexWrap: "wrap" }}>
                                            <div style={{ fontSize: "0.58rem", color: "#fbbf24", fontWeight: 700 }}>
                                                {primary.window} note: {compactText(primary.note, 70)}
                                            </div>
                                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                                                <span style={{ fontSize: "0.56rem", color: "#64748b", fontWeight: 700 }}>
                                                    Updated: {fmtTime(plan.captured_at)} IST
                                                </span>
                                                <button
                                                    onClick={() => setExpandedByIndex((p) => ({ ...p, [expiryIdx.abbr]: !showAll }))}
                                                    style={{
                                                        fontSize: "0.56rem",
                                                        padding: "3px 8px",
                                                        borderRadius: "7px",
                                                        background: "rgba(148,163,184,0.1)",
                                                        border: "1px solid rgba(148,163,184,0.25)",
                                                        color: "#cbd5e1",
                                                        cursor: "pointer",
                                                        fontWeight: 700,
                                                    }}
                                                >
                                                    {showAll ? "Hide extra windows" : "Show all windows"}
                                                </button>
                                            </div>
                                        </div>

                                        {showAll && otherWindows.length > 0 && (
                                            <div style={{ borderRadius: "8px", border: "1px solid rgba(148,163,184,0.2)", background: "rgba(15,23,42,0.4)", padding: "0.55rem", display: "grid", gap: "0.4rem" }}>
                                                {otherWindows.map((w) => (
                                                    <div key={`${plan.index}-${w.window}`} style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: "0.4rem", alignItems: "center" }}>
                                                        <span style={{ fontSize: "0.58rem", color: "#cbd5e1", fontWeight: 700 }}>
                                                            {w.window}: {w.ce?.contract || "--"} | {w.pe?.contract || "--"}
                                                        </span>
                                                        <span style={{ fontSize: "0.54rem", color: "#94a3b8", fontWeight: 700 }}>{w.confidence}</span>
                                                        <span style={{ fontSize: "0.54rem", color: statusColor(w.status), fontWeight: 800 }}>{w.status}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
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

function CompactLeg({ title, leg, color }: { title: "CE" | "PE"; leg: OptionLeg; color: string }) {
    return (
        <div style={{ borderRadius: "9px", border: `1px solid ${color}55`, background: `${color}12`, padding: "0.56rem" }}>
            <div style={{ fontSize: "0.56rem", fontWeight: 900, color, letterSpacing: "0.08em" }}>{title} BUY</div>
            <div style={{ marginTop: "0.18rem", fontSize: "0.76rem", fontWeight: 900, color: "#e2e8f0" }}>{compactText(leg?.contract, 28)}</div>
            <div style={{ marginTop: "0.22rem", fontSize: "0.58rem", color: "#cbd5e1", lineHeight: 1.4 }}>
                Entry: {compactText(leg?.entry, 78)}
            </div>
            <div style={{ marginTop: "0.12rem", fontSize: "0.58rem", color: "#cbd5e1", lineHeight: 1.4 }}>
                SL: {compactText(leg?.sl, 72)}
            </div>
            <div style={{ marginTop: "0.12rem", fontSize: "0.58rem", color: "#cbd5e1", lineHeight: 1.4 }}>
                Target: {compactText(leg?.target, 72)}
            </div>
        </div>
    );
}
