"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

interface ExpirySpec {
    abbr: string;
    name: string;
    exchange: "NSE" | "BSE";
    expiryDay: number;
    fallbackMode: "weekly" | "monthly_last";
}

interface ExpiryCalendarCard {
    abbr: string;
    next_expiry: string;
    days_to_next: number;
    expiry_today: boolean;
}

interface ExpiryCalendarResponse {
    cards?: ExpiryCalendarCard[];
}

interface ZeroHeroSetup {
    day_high: number | null;
    day_low: number | null;
    vwap: number | null;
    current_price: number | null;
    price_vs_vwap: string;
    breakout_trigger: string;
    breakout_candle: string;
    choppy_zone: string;
    timeframe_used: string;
}

interface ZeroHeroPlan {
    index: string;
    index_name: string;
    exchange: "NSE" | "BSE";
    symbol: string;
    expiry_today: boolean;
    next_expiry?: string;
    spot: number | null;
    trade_type: "CALL" | "PUT" | "NO TRADE" | string;
    reason: string;
    entry: string;
    stop_loss: string;
    target_1: string;
    target_2: string;
    risk_level: "LOW" | "MEDIUM" | "HIGH" | string;
    confidence_pct: number;
    strike: string;
    market_context: string;
    trap_check: string;
    position_sizing: string;
    setup: ZeroHeroSetup;
    source: "ai" | "fallback" | "info" | string;
    captured_at: string;
    snapshot_label?: string;
    active_checkpoint?: string | null;
    next_checkpoint?: string | null;
}

const EXPIRY_INDICES: ExpirySpec[] = [
    { abbr: "NIFTY", name: "Nifty 50", exchange: "NSE", expiryDay: 2, fallbackMode: "weekly" },
    { abbr: "BANKNIFTY", name: "Bank Nifty", exchange: "NSE", expiryDay: 2, fallbackMode: "monthly_last" },
    { abbr: "FINNIFTY", name: "Fin Nifty", exchange: "NSE", expiryDay: 2, fallbackMode: "monthly_last" },
    { abbr: "SENSEX", name: "Sensex", exchange: "BSE", expiryDay: 4, fallbackMode: "weekly" },
];

const CHECKPOINT_CHIPS = [
    { id: "1500", label: "3PM AI", time: "15:00" },
    { id: "1507", label: "3:07 AI", time: "15:07" },
    { id: "1510", label: "LOCK", time: "15:10" },
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

function getLastExpiryOfMonth(expiryDay: number, year: number, month: number): Date {
    const d = new Date(Date.UTC(year, month + 1, 0));
    let back = d.getUTCDay() - expiryDay;
    if (back < 0) back += 7;
    d.setUTCDate(d.getUTCDate() - back);
    return d;
}

function getNextMonthlyExpiry(expiryDay: number, fromDate: Date): Date {
    const current = getLastExpiryOfMonth(expiryDay, fromDate.getUTCFullYear(), fromDate.getUTCMonth());
    if (current.getTime() >= fromDate.getTime()) return current;
    const nextMonth = new Date(Date.UTC(fromDate.getUTCFullYear(), fromDate.getUTCMonth() + 1, 1));
    return getLastExpiryOfMonth(expiryDay, nextMonth.getUTCFullYear(), nextMonth.getUTCMonth());
}

function parseIsoDate(value: string): Date | null {
    const parsed = new Date(`${value}T00:00:00Z`);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed;
}

function fmtNum(v: number): string {
    return v.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

function fmtTime(ts: string): string {
    if (!ts) return "--";
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return "--";
    return new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Kolkata",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    }).format(d);
}

function sourceBadge(source: string): { text: string; color: string; border: string } {
    if (source === "ai") {
        return { text: "AI SNAPSHOT", color: "#22c55e", border: "rgba(34,197,94,0.4)" };
    }
    if (source === "info") {
        return { text: "INFO", color: "#93c5fd", border: "rgba(59,130,246,0.4)" };
    }
    return { text: "RULE FALLBACK", color: "#f59e0b", border: "rgba(245,158,11,0.4)" };
}

function tradeColor(tradeType: string): string {
    if (tradeType === "CALL") return "#22c55e";
    if (tradeType === "PUT") return "#ef4444";
    return "#f59e0b";
}

function riskColor(risk: string): string {
    if (risk === "LOW") return "#22c55e";
    if (risk === "MEDIUM") return "#f59e0b";
    return "#ef4444";
}

function compactText(value: string | undefined, maxLen: number): string {
    const text = (value || "").trim();
    if (text.length <= maxLen) return text || "--";
    return `${text.slice(0, maxLen - 1)}...`;
}

function checkpointState(chipId: string, activeId: string | null | undefined, nextId: string | null | undefined, nowHhmm: number): "active" | "pending" | "done" | "idle" {
    if (activeId === chipId) return "active";
    if (nextId === chipId) return "pending";
    const chipNum = Number(chipId);
    if (Number.isFinite(chipNum) && nowHhmm >= chipNum) return "done";
    return "idle";
}

function checkpointTone(state: "active" | "pending" | "done" | "idle") {
    if (state === "active") return { fg: "#fbbf24", bg: "rgba(245,158,11,0.14)", border: "rgba(245,158,11,0.38)" };
    if (state === "pending") return { fg: "#93c5fd", bg: "rgba(59,130,246,0.12)", border: "rgba(59,130,246,0.28)" };
    if (state === "done") return { fg: "#cbd5e1", bg: "rgba(148,163,184,0.08)", border: "rgba(148,163,184,0.18)" };
    return { fg: "#64748b", bg: "rgba(15,23,42,0.25)", border: "rgba(71,85,105,0.18)" };
}

function normalizePlan(raw: any, idx: ExpirySpec): ZeroHeroPlan {
    const setupRaw = raw?.setup && typeof raw.setup === "object" ? raw.setup : {};
    return {
        index: raw?.index || idx.abbr,
        index_name: raw?.index_name || idx.name,
        exchange: raw?.exchange || idx.exchange,
        symbol: raw?.symbol || "",
        expiry_today: Boolean(raw?.expiry_today),
        next_expiry: raw?.next_expiry,
        spot: typeof raw?.spot === "number" ? raw.spot : null,
        trade_type: raw?.trade_type || "NO TRADE",
        reason: raw?.reason || "NO TRADE - No valid trigger.",
        entry: raw?.entry || "NO TRADE - Wait for valid trigger.",
        stop_loss: raw?.stop_loss || "Not applicable",
        target_1: raw?.target_1 || "Not applicable",
        target_2: raw?.target_2 || "Not applicable",
        risk_level: raw?.risk_level || "LOW",
        confidence_pct: Number.isFinite(raw?.confidence_pct) ? Number(raw.confidence_pct) : 35,
        strike: raw?.strike || "NO TRADE",
        market_context: raw?.market_context || "SIDEWAYS",
        trap_check: raw?.trap_check || "Avoid forced entries.",
        position_sizing: raw?.position_sizing || "Low risk only.",
        setup: {
            day_high: typeof setupRaw.day_high === "number" ? setupRaw.day_high : null,
            day_low: typeof setupRaw.day_low === "number" ? setupRaw.day_low : null,
            vwap: typeof setupRaw.vwap === "number" ? setupRaw.vwap : null,
            current_price: typeof setupRaw.current_price === "number" ? setupRaw.current_price : null,
            price_vs_vwap: setupRaw.price_vs_vwap || "UNKNOWN",
            breakout_trigger: setupRaw.breakout_trigger || "NONE",
            breakout_candle: setupRaw.breakout_candle || "UNKNOWN",
            choppy_zone: setupRaw.choppy_zone || "UNKNOWN",
            timeframe_used: setupRaw.timeframe_used || "5m",
        },
        source: raw?.source || "info",
        captured_at: raw?.captured_at || "",
        snapshot_label: raw?.snapshot_label,
        active_checkpoint: typeof raw?.active_checkpoint === "string" ? raw.active_checkpoint : null,
        next_checkpoint: typeof raw?.next_checkpoint === "string" ? raw.next_checkpoint : null,
    };
}

export default function ExpiryZeroHeroPanel() {
    const [istClock, setIstClock] = useState<IstClock>(getIstClock());
    const [plansByIndex, setPlansByIndex] = useState<Record<string, ZeroHeroPlan>>({});
    const [calendarByIndex, setCalendarByIndex] = useState<Record<string, ExpiryCalendarCard>>({});
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const inFlightRef = useRef(false);

    useEffect(() => {
        const timer = setInterval(() => setIstClock(getIstClock()), 60_000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        const fetchCalendar = async () => {
            try {
                const res = await fetch("/api/v1/expiry-calendar", { cache: "no-store" });
                if (!res.ok) return;
                const data: ExpiryCalendarResponse = await res.json();
                const cards = Array.isArray(data.cards) ? data.cards : [];
                const nextMap: Record<string, ExpiryCalendarCard> = {};
                for (const card of cards) {
                    if (!card || typeof card.abbr !== "string" || typeof card.next_expiry !== "string") continue;
                    nextMap[card.abbr.toUpperCase()] = card;
                }
                if (Object.keys(nextMap).length > 0) {
                    setCalendarByIndex(nextMap);
                }
            } catch {
                // Fallback to local weekday logic.
            }
        };

        void fetchCalendar();
        const timer = setInterval(() => void fetchCalendar(), 60 * 60 * 1000);
        return () => clearInterval(timer);
    }, []);

    const dayKey = `${istClock.year}-${istClock.month}-${istClock.day}`;

    const rows = useMemo(() => {
        const today = getIstDateOnly(istClock);
        return EXPIRY_INDICES.map((idx) => {
            const live = calendarByIndex[idx.abbr];
            if (live) {
                const parsed = parseIsoDate(live.next_expiry);
                if (parsed) {
                    const days = Number.isFinite(live.days_to_next) ? live.days_to_next : daysBetween(today, parsed);
                    return { ...idx, nextExpiry: parsed, days, isToday: Boolean(live.expiry_today) || days === 0 };
                }
            }

            const fallbackNext = idx.fallbackMode === "monthly_last"
                ? getNextMonthlyExpiry(idx.expiryDay, today)
                : getNextExpiry(idx.expiryDay, today);
            const days = daysBetween(today, fallbackNext);
            return { ...idx, nextExpiry: fallbackNext, days, isToday: days === 0 };
        }).sort((a, b) => a.days - b.days || a.abbr.localeCompare(b.abbr));
    }, [dayKey, calendarByIndex]);

    const todayExpiries = useMemo(() => rows.filter((r) => r.isToday), [rows]);
    const nearest = rows[0];
    const todayExpiryKey = useMemo(() => todayExpiries.map((x) => x.abbr).join("|"), [todayExpiries]);

    const fetchPlans = useCallback(async () => {
        if (inFlightRef.current) return;
        if (todayExpiries.length === 0) {
            setPlansByIndex({});
            setError(null);
            return;
        }

        try {
            inFlightRef.current = true;
            setIsLoading(true);
            setError(null);

            const results = await Promise.all(
                todayExpiries.map(async (idx) => {
                    const res = await fetch(`/api/v1/expiry-zero-hero?index=${encodeURIComponent(idx.abbr)}`, { cache: "no-store" });
                    const data = await res.json();
                    if (!res.ok) {
                        throw new Error(data?.detail || `Failed for ${idx.abbr}`);
                    }
                    const normalized = normalizePlan(data, idx);
                    return [idx.abbr, normalized] as const;
                })
            );

            const nextMap: Record<string, ZeroHeroPlan> = {};
            for (const [abbr, item] of results) {
                nextMap[abbr] = item;
            }
            setPlansByIndex(nextMap);
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : "Unable to load strict expiry plan");
        } finally {
            inFlightRef.current = false;
            setIsLoading(false);
        }
    }, [todayExpiries]);

    useEffect(() => {
        void fetchPlans();
    }, [fetchPlans, todayExpiryKey]);

    useEffect(() => {
        if (todayExpiries.length === 0) return;
        const timer = setInterval(() => {
            if (typeof document !== "undefined" && document.hidden) return;
            void fetchPlans();
        }, 60_000);
        return () => clearInterval(timer);
    }, [fetchPlans, todayExpiries.length]);

    const nowHhmm = istClock.hour * 100 + istClock.minute;
    const primaryPlan = todayExpiries.length > 0 ? plansByIndex[todayExpiries[0].abbr] : null;

    return (
        <div style={{ marginTop: "0.9rem", border: "1px solid rgba(251,146,60,0.25)", borderRadius: "14px", padding: "0.9rem", background: "rgba(251,146,60,0.05)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.6rem", flexWrap: "wrap", marginBottom: "0.7rem" }}>
                <div>
                    <div style={{ fontSize: "0.64rem", fontWeight: 900, color: "#fb923c", textTransform: "uppercase", letterSpacing: "0.14em" }}>
                        Expiry 3:00-3:10 VWAP Breakout (Strict)
                    </div>
                    <div style={{ marginTop: "0.18rem", fontSize: "0.72rem", color: "#e2e8f0", fontWeight: 700 }}>
                        {todayExpiries.length > 0
                            ? `Today's expiry: ${todayExpiries.map((x) => x.abbr).join(", ")}`
                            : `No expiry today | Next: ${nearest.abbr} on ${fmtDateShort(nearest.nextExpiry)}`}
                    </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "0.42rem", flexWrap: "wrap", justifyContent: "flex-end" }}>
                    {CHECKPOINT_CHIPS.map((chip) => {
                        const state = checkpointState(chip.id, primaryPlan?.active_checkpoint, primaryPlan?.next_checkpoint, nowHhmm);
                        const tone = checkpointTone(state);
                        return (
                            <div
                                key={chip.id}
                                style={{
                                    minWidth: "82px",
                                    padding: "0.30rem 0.44rem",
                                    borderRadius: "9px",
                                    background: tone.bg,
                                    border: `1px solid ${tone.border}`,
                                }}
                            >
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.28rem" }}>
                                    <span style={{ fontSize: "0.46rem", fontWeight: 800, color: tone.fg, letterSpacing: "0.09em" }}>{chip.label}</span>
                                    <span style={{ fontSize: "0.44rem", fontWeight: 800, color: tone.fg }}>{state === "active" ? "NOW" : state === "pending" ? "NEXT" : state === "done" ? "DONE" : "LATER"}</span>
                                </div>
                                <div style={{ marginTop: "0.16rem", fontSize: "0.74rem", fontWeight: 800, color: state === "idle" ? "#94a3b8" : "#f8fafc" }}>
                                    {chip.time}
                                </div>
                            </div>
                        );
                    })}

                    <button
                        onClick={() => void fetchPlans()}
                        disabled={isLoading}
                        style={{
                            fontSize: "0.62rem",
                            padding: "5px 10px",
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
                        This panel activates only on expiry day. It will show strict 3:00-3:10 PM VWAP breakout decision output.
                    </div>
                </div>
            ) : (
                <div style={{ display: "grid", gap: "0.7rem" }}>
                    {todayExpiries.map((expiryIdx) => {
                        const plan = plansByIndex[expiryIdx.abbr];
                        const badge = sourceBadge(plan?.source || "info");
                        const setup = plan?.setup;

                        return (
                            <div key={expiryIdx.abbr} style={{ borderRadius: "11px", border: "1px solid rgba(255,255,255,0.08)", background: "rgba(2,6,23,0.55)", padding: "0.72rem" }}>
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
                                    </div>
                                </div>

                                {!plan ? (
                                    <div style={{ borderRadius: "8px", border: "1px solid rgba(148,163,184,0.2)", background: "rgba(15,23,42,0.45)", padding: "0.65rem", fontSize: "0.62rem", color: "#94a3b8" }}>
                                        Loading strict setup...
                                    </div>
                                ) : (
                                    <div style={{ display: "grid", gap: "0.55rem" }}>
                                        <div style={{ borderRadius: "8px", border: "1px solid rgba(99,102,241,0.22)", background: "rgba(15,23,42,0.45)", padding: "0.55rem", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.4rem", flexWrap: "wrap" }}>
                                            <span style={{ fontSize: "0.56rem", color: "#93c5fd", fontWeight: 700 }}>
                                                {plan.snapshot_label || "Strict expiry checkpoint output"}
                                            </span>
                                            <span style={{ fontSize: "0.56rem", color: "#64748b", fontWeight: 700 }}>
                                                Updated: {fmtTime(plan.captured_at)} IST
                                            </span>
                                        </div>

                                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "0.45rem" }}>
                                            <Metric label="Day High" value={typeof setup?.day_high === "number" ? fmtNum(setup.day_high) : "--"} />
                                            <Metric label="Day Low" value={typeof setup?.day_low === "number" ? fmtNum(setup.day_low) : "--"} />
                                            <Metric label="VWAP" value={typeof setup?.vwap === "number" ? fmtNum(setup.vwap) : "--"} />
                                            <Metric label="Price vs VWAP" value={setup?.price_vs_vwap || "--"} />
                                            <Metric label="Strike" value={plan.strike || "--"} />
                                            <Metric label="Context" value={plan.market_context || "--"} />
                                        </div>

                                        <div style={{ borderRadius: "8px", border: `1px solid ${tradeColor(plan.trade_type)}55`, background: `${tradeColor(plan.trade_type)}12`, padding: "0.62rem" }}>
                                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.45rem", flexWrap: "wrap" }}>
                                                <div style={{ fontSize: "0.84rem", fontWeight: 900, color: tradeColor(plan.trade_type) }}>
                                                    Trade Type: {plan.trade_type}
                                                </div>
                                                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                                                    <span style={{ fontSize: "0.58rem", fontWeight: 800, color: riskColor(plan.risk_level) }}>
                                                        Risk: {plan.risk_level}
                                                    </span>
                                                    <span style={{ fontSize: "0.58rem", fontWeight: 800, color: "#e2e8f0" }}>
                                                        Confidence: {Math.max(0, Math.min(100, Math.round(plan.confidence_pct)))}%
                                                    </span>
                                                </div>
                                            </div>

                                            <div style={{ marginTop: "0.4rem", display: "grid", gap: "0.26rem" }}>
                                                <FieldRow label="Reason" value={plan.reason} />
                                                <FieldRow label="Entry" value={plan.entry} />
                                                <FieldRow label="Stop Loss" value={plan.stop_loss} />
                                                <FieldRow label="Target 1" value={plan.target_1} />
                                                <FieldRow label="Target 2" value={plan.target_2} />
                                            </div>
                                        </div>

                                        <div style={{ borderRadius: "8px", border: "1px solid rgba(148,163,184,0.2)", background: "rgba(15,23,42,0.4)", padding: "0.56rem", display: "grid", gap: "0.25rem" }}>
                                            <div style={{ fontSize: "0.58rem", color: "#fbbf24", fontWeight: 700 }}>
                                                Trap Check: {compactText(plan.trap_check, 155)}
                                            </div>
                                            <div style={{ fontSize: "0.58rem", color: "#cbd5e1", fontWeight: 600 }}>
                                                Position Sizing: {compactText(plan.position_sizing, 155)}
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

function Metric({ label, value }: { label: string; value: string }) {
    return (
        <div style={{ borderRadius: "8px", border: "1px solid rgba(148,163,184,0.2)", background: "rgba(15,23,42,0.35)", padding: "0.45rem" }}>
            <div style={{ fontSize: "0.52rem", color: "#64748b", fontWeight: 800, letterSpacing: "0.09em", textTransform: "uppercase" }}>{label}</div>
            <div style={{ marginTop: "0.16rem", fontSize: "0.68rem", color: "#e2e8f0", fontWeight: 800 }}>{compactText(value, 34)}</div>
        </div>
    );
}

function FieldRow({ label, value }: { label: string; value: string }) {
    return (
        <div style={{ fontSize: "0.6rem", color: "#cbd5e1", lineHeight: 1.42 }}>
            <span style={{ color: "#94a3b8", fontWeight: 700 }}>{label}: </span>
            {compactText(value, 230)}
        </div>
    );
}

