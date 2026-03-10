"use client";

import { useEffect, useMemo, useState } from "react";

interface ExpirySpec {
    abbr: string;
    name: string;
    exchange: "NSE" | "BSE";
    expiryDay: number; // JS weekday: 0=Sun..6=Sat
    apiSymbol: string; // backend symbol for live spot fetch
    strikeStep: number;
}

const EXPIRY_INDICES: ExpirySpec[] = [
    { abbr: "NIFTY", name: "Nifty 50", exchange: "NSE", expiryDay: 4, apiSymbol: "^NSEI", strikeStep: 50 },
    { abbr: "BANKNIFTY", name: "Bank Nifty", exchange: "NSE", expiryDay: 3, apiSymbol: "^NSEBANK", strikeStep: 100 },
    { abbr: "FINNIFTY", name: "Fin Nifty", exchange: "NSE", expiryDay: 2, apiSymbol: "^CNXFINSERVICE", strikeStep: 50 },
    { abbr: "SENSEX", name: "Sensex", exchange: "BSE", expiryDay: 5, apiSymbol: "^BSESN", strikeStep: 100 },
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

function hhmmIst(istShifted: Date): number {
    return istShifted.getUTCHours() * 100 + istShifted.getUTCMinutes();
}

function fmtDateShort(d: Date): string {
    return `${DAYS[d.getUTCDay()]}, ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

function fmtNum(v: number): string {
    return v.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

function roundToStep(price: number, step: number): number {
    return Math.round(price / step) * step;
}

export default function ExpiryZeroHeroPanel() {
    const [istNow, setIstNow] = useState<Date>(getIstShiftedNow());
    const [spotByIndex, setSpotByIndex] = useState<Record<string, number | null>>({});

    useEffect(() => {
        const timer = setInterval(() => setIstNow(getIstShiftedNow()), 60_000);
        return () => clearInterval(timer);
    }, []);

    const today = getIstDateOnly(istNow);
    const nowHHMM = hhmmIst(istNow);

    const rows = useMemo(() => {
        return EXPIRY_INDICES.map((idx) => {
            const nextExpiry = getNextExpiry(idx.expiryDay, today);
            const days = daysBetween(today, nextExpiry);
            return { ...idx, nextExpiry, days, isToday: days === 0 };
        }).sort((a, b) => a.days - b.days || a.abbr.localeCompare(b.abbr));
    }, [today]);

    const todayExpiries = rows.filter((r) => r.isToday);
    const nearest = rows[0];
    const todayExpiryKey = todayExpiries.map((x) => x.abbr).join("|");

    useEffect(() => {
        let active = true;

        async function loadSpots() {
            if (todayExpiries.length === 0) {
                if (active) setSpotByIndex({});
                return;
            }

            const results = await Promise.all(
                todayExpiries.map(async (idx) => {
                    try {
                        const res = await fetch(`/api/v1/analyze?symbol=${encodeURIComponent(idx.apiSymbol)}`, { cache: "no-store" });
                        if (!res.ok) return [idx.abbr, null] as const;
                        const json = await res.json();
                        const price = typeof json?.price === "number" ? Number(json.price) : null;
                        return [idx.abbr, price] as const;
                    } catch {
                        return [idx.abbr, null] as const;
                    }
                })
            );

            if (!active) return;
            const nextMap: Record<string, number | null> = {};
            results.forEach(([abbr, price]) => {
                nextMap[abbr] = price;
            });
            setSpotByIndex(nextMap);
        }

        loadSpots();
        const timer = setInterval(loadSpots, 60_000);
        return () => {
            active = false;
            clearInterval(timer);
        };
    }, [todayExpiryKey, istNow.getUTCDate()]);

    const windows = [
        { label: "1 PM Window", start: 1300, end: 1400, offsetSteps: 0, confidence: "MEDIUM", risk: "High risk. Enter only after confirmed momentum candle." },
        { label: "2 PM Window", start: 1400, end: 1500, offsetSteps: 1, confidence: "MEDIUM-HIGH", risk: "Very high risk. Premium collapse and spike both fast." },
        { label: "3 PM Window", start: 1500, end: 1528, offsetSteps: 0, confidence: "SPECULATIVE", risk: "Ultra high risk. Strict stop and force exit by 3:28 PM." },
    ] as const;

    return (
        <div style={{ marginTop: "0.9rem", border: "1px solid rgba(251,146,60,0.25)", borderRadius: "14px", padding: "0.9rem", background: "rgba(251,146,60,0.05)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.6rem", flexWrap: "wrap", marginBottom: "0.7rem" }}>
                <div>
                    <div style={{ fontSize: "0.64rem", fontWeight: 900, color: "#fb923c", textTransform: "uppercase", letterSpacing: "0.14em" }}>
                        Expiry Zero-To-Hero (High Risk)
                    </div>
                    <div style={{ marginTop: "0.2rem", fontSize: "0.73rem", color: "#e2e8f0", fontWeight: 700 }}>
                        {todayExpiries.length > 0
                            ? `Today's expiry indices: ${todayExpiries.map((x) => x.abbr).join(", ")}`
                            : `No expiry today | Next: ${nearest.abbr} (${nearest.exchange}) on ${fmtDateShort(nearest.nextExpiry)}${nearest.days === 1 ? " (Tomorrow)" : ` (in ${nearest.days} days)`}`}
                    </div>
                    <div style={{ marginTop: "0.2rem", fontSize: "0.58rem", color: "#94a3b8" }}>
                        Global panel (independent of index filter) | Rule-based, separate from AI prompt output
                    </div>
                </div>
                <div style={{ fontSize: "0.58rem", color: "#94a3b8", fontWeight: 700 }}>
                    Time now: {String(istNow.getUTCHours()).padStart(2, "0")}:{String(istNow.getUTCMinutes()).padStart(2, "0")} IST
                </div>
            </div>

            {todayExpiries.length === 0 ? (
                <div style={{ borderRadius: "10px", border: "1px solid rgba(148,163,184,0.2)", background: "rgba(15,23,42,0.45)", padding: "0.75rem" }}>
                    <div style={{ fontSize: "0.66rem", color: "#cbd5e1", lineHeight: 1.55 }}>
                        No index expiry today. Focus on normal setups.
                    </div>
                    <div style={{ marginTop: "0.45rem", fontSize: "0.62rem", color: "#94a3b8", lineHeight: 1.5 }}>
                        Upcoming expiry: {nearest.name} ({nearest.abbr}) on {fmtDateShort(nearest.nextExpiry)}. Prepare exact CE/PE strike plan for 1 PM to 3 PM windows.
                    </div>
                </div>
            ) : (
                <div style={{ display: "grid", gap: "0.8rem" }}>
                    {todayExpiries.map((expiryIdx) => {
                        const spot = spotByIndex[expiryIdx.abbr] ?? null;
                        const atm = typeof spot === "number" && spot > 0 ? roundToStep(spot, expiryIdx.strikeStep) : null;
                        const triggerGap = expiryIdx.strikeStep * 0.25;

                        return (
                            <div key={expiryIdx.abbr} style={{ borderRadius: "12px", border: "1px solid rgba(255,255,255,0.08)", background: "rgba(2,6,23,0.55)", padding: "0.75rem" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.6rem", flexWrap: "wrap", marginBottom: "0.6rem" }}>
                                    <div style={{ fontSize: "0.72rem", fontWeight: 900, color: "#e2e8f0" }}>
                                        {expiryIdx.abbr} ({expiryIdx.exchange}) | Expiry Day Plan
                                    </div>
                                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                                        <span style={{ fontSize: "0.58rem", color: "#94a3b8", fontWeight: 700 }}>
                                            Spot: {typeof spot === "number" ? fmtNum(spot) : "Not available"}
                                        </span>
                                        <span style={{ fontSize: "0.56rem", fontWeight: 900, color: "#f87171", border: "1px solid rgba(239,68,68,0.45)", borderRadius: "999px", padding: "2px 8px" }}>
                                            EXPIRY TODAY
                                        </span>
                                    </div>
                                </div>

                                <div style={{ display: "grid", gap: "0.65rem" }}>
                                    {windows.map((w) => {
                                        const phase = nowHHMM < w.start ? "UPCOMING" : nowHHMM < w.end ? "LIVE" : "CLOSED";
                                        const badgeColor = phase === "LIVE" ? "#22c55e" : phase === "UPCOMING" ? "#f59e0b" : "#64748b";

                                        const ceStrike = atm !== null ? atm + w.offsetSteps * expiryIdx.strikeStep : null;
                                        const peStrike = atm !== null ? atm - w.offsetSteps * expiryIdx.strikeStep : null;
                                        const upTrigger = spot !== null ? spot + triggerGap : null;
                                        const downTrigger = spot !== null ? spot - triggerGap : null;

                                        return (
                                            <div key={`${expiryIdx.abbr}-${w.label}`} style={{ borderRadius: "10px", border: "1px solid rgba(255,255,255,0.08)", background: "rgba(15,23,42,0.5)", padding: "0.65rem" }}>
                                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.45rem" }}>
                                                    <div style={{ fontSize: "0.68rem", fontWeight: 800, color: "#e2e8f0" }}>
                                                        {w.label} | Recommended contracts
                                                    </div>
                                                    <div style={{ display: "flex", gap: "0.45rem", alignItems: "center" }}>
                                                        <span style={{ fontSize: "0.56rem", color: "#94a3b8", fontWeight: 800 }}>Confidence {w.confidence}</span>
                                                        <span style={{ fontSize: "0.56rem", fontWeight: 900, color: badgeColor, border: `1px solid ${badgeColor}55`, borderRadius: "999px", padding: "2px 7px" }}>{phase}</span>
                                                    </div>
                                                </div>

                                                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "0.6rem" }}>
                                                    <div style={{ borderRadius: "10px", border: "1px solid rgba(34,197,94,0.3)", background: "rgba(34,197,94,0.08)", padding: "0.65rem" }}>
                                                        <div style={{ fontSize: "0.62rem", fontWeight: 900, color: "#22c55e", letterSpacing: "0.1em", textTransform: "uppercase" }}>CE Buy Setup</div>
                                                        <div style={{ marginTop: "0.3rem", fontSize: "0.74rem", fontWeight: 900, color: "#e2e8f0" }}>
                                                            {ceStrike !== null ? `${expiryIdx.abbr} ${ceStrike} CE` : `${expiryIdx.abbr} CE`}
                                                        </div>
                                                        <div style={{ marginTop: "0.32rem", fontSize: "0.62rem", color: "#cbd5e1", lineHeight: 1.5 }}>
                                                            Entry: {upTrigger !== null ? `Take this CE only if spot breaks above ${fmtNum(upTrigger)}.` : "Take CE only on confirmed upside breakout."}
                                                        </div>
                                                        <div style={{ marginTop: "0.22rem", fontSize: "0.62rem", color: "#cbd5e1", lineHeight: 1.5 }}>
                                                            SL/Invalidation: Exit if spot falls back below breakout candle low.
                                                        </div>
                                                        <div style={{ marginTop: "0.22rem", fontSize: "0.62rem", color: "#cbd5e1", lineHeight: 1.5 }}>
                                                            Target/Exit: 40-80% premium burst, hard exit by 3:28 PM IST.
                                                        </div>
                                                    </div>

                                                    <div style={{ borderRadius: "10px", border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.08)", padding: "0.65rem" }}>
                                                        <div style={{ fontSize: "0.62rem", fontWeight: 900, color: "#ef4444", letterSpacing: "0.1em", textTransform: "uppercase" }}>PE Buy Setup</div>
                                                        <div style={{ marginTop: "0.3rem", fontSize: "0.74rem", fontWeight: 900, color: "#e2e8f0" }}>
                                                            {peStrike !== null ? `${expiryIdx.abbr} ${peStrike} PE` : `${expiryIdx.abbr} PE`}
                                                        </div>
                                                        <div style={{ marginTop: "0.32rem", fontSize: "0.62rem", color: "#cbd5e1", lineHeight: 1.5 }}>
                                                            Entry: {downTrigger !== null ? `Take this PE only if spot breaks below ${fmtNum(downTrigger)}.` : "Take PE only on confirmed downside breakdown."}
                                                        </div>
                                                        <div style={{ marginTop: "0.22rem", fontSize: "0.62rem", color: "#cbd5e1", lineHeight: 1.5 }}>
                                                            SL/Invalidation: Exit if spot recovers above breakdown candle high.
                                                        </div>
                                                        <div style={{ marginTop: "0.22rem", fontSize: "0.62rem", color: "#cbd5e1", lineHeight: 1.5 }}>
                                                            Target/Exit: 40-80% premium burst, hard exit by 3:28 PM IST.
                                                        </div>
                                                    </div>
                                                </div>

                                                <div style={{ marginTop: "0.45rem", fontSize: "0.6rem", color: "#fbbf24", fontWeight: 700, lineHeight: 1.5 }}>
                                                    Risk note: {w.risk}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
