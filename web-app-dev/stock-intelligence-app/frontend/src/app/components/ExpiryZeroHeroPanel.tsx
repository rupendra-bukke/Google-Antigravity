"use client";

import { useEffect, useState } from "react";

interface ExpirySpec {
    abbr: string;
    name: string;
    exchange: "NSE" | "BSE";
    expiryDay: number; // JS weekday: 0=Sun..6=Sat
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

function hhmmIst(istShifted: Date): number {
    return istShifted.getUTCHours() * 100 + istShifted.getUTCMinutes();
}

function fmtDateShort(d: Date): string {
    return `${DAYS[d.getUTCDay()]}, ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

export default function ExpiryZeroHeroPanel() {
    const [istNow, setIstNow] = useState<Date>(getIstShiftedNow());

    useEffect(() => {
        const timer = setInterval(() => setIstNow(getIstShiftedNow()), 60_000);
        return () => clearInterval(timer);
    }, []);

    const today = getIstDateOnly(istNow);
    const nowHHMM = hhmmIst(istNow);

    const rows = EXPIRY_INDICES.map((idx) => {
        const nextExpiry = getNextExpiry(idx.expiryDay, today);
        const days = daysBetween(today, nextExpiry);
        return { ...idx, nextExpiry, days, isToday: days === 0 };
    }).sort((a, b) => a.days - b.days || a.abbr.localeCompare(b.abbr));

    const todayExpiries = rows.filter((r) => r.isToday);
    const nearest = rows[0];

    const windows = [
        { label: "1 PM Window", start: 1300, end: 1400, mode: "ATM", confidence: "MEDIUM", risk: "High risk. Enter only after confirmed momentum candle." },
        { label: "2 PM Window", start: 1400, end: 1500, mode: "NEAR OTM", confidence: "MEDIUM-HIGH", risk: "Very high risk. Premium collapse and spike both fast." },
        { label: "3 PM Window", start: 1500, end: 1528, mode: "ATM", confidence: "SPECULATIVE", risk: "Ultra high risk. Strict stop and force exit by 3:28 PM." },
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
                        Upcoming expiry: {nearest.name} ({nearest.abbr}) on {fmtDateShort(nearest.nextExpiry)}. Prepare CE/PE zero-to-hero plan for 1 PM to 3 PM expiry windows.
                    </div>
                </div>
            ) : (
                <div style={{ display: "grid", gap: "0.8rem" }}>
                    {todayExpiries.map((expiryIdx) => (
                        <div key={expiryIdx.abbr} style={{ borderRadius: "12px", border: "1px solid rgba(255,255,255,0.08)", background: "rgba(2,6,23,0.55)", padding: "0.75rem" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.6rem", flexWrap: "wrap", marginBottom: "0.6rem" }}>
                                <div style={{ fontSize: "0.72rem", fontWeight: 900, color: "#e2e8f0" }}>
                                    {expiryIdx.abbr} ({expiryIdx.exchange}) | Expiry Day Plan
                                </div>
                                <span style={{ fontSize: "0.56rem", fontWeight: 900, color: "#f87171", border: "1px solid rgba(239,68,68,0.45)", borderRadius: "999px", padding: "2px 8px" }}>
                                    EXPIRY TODAY
                                </span>
                            </div>

                            <div style={{ display: "grid", gap: "0.65rem" }}>
                                {windows.map((w) => {
                                    const phase = nowHHMM < w.start ? "UPCOMING" : nowHHMM < w.end ? "LIVE" : "CLOSED";
                                    const badgeColor = phase === "LIVE" ? "#22c55e" : phase === "UPCOMING" ? "#f59e0b" : "#64748b";

                                    return (
                                        <div key={`${expiryIdx.abbr}-${w.label}`} style={{ borderRadius: "10px", border: "1px solid rgba(255,255,255,0.08)", background: "rgba(15,23,42,0.5)", padding: "0.65rem" }}>
                                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.45rem" }}>
                                                <div style={{ fontSize: "0.68rem", fontWeight: 800, color: "#e2e8f0" }}>
                                                    {w.label} | Strike Type: {w.mode}
                                                </div>
                                                <div style={{ display: "flex", gap: "0.45rem", alignItems: "center" }}>
                                                    <span style={{ fontSize: "0.56rem", color: "#94a3b8", fontWeight: 800 }}>Confidence {w.confidence}</span>
                                                    <span style={{ fontSize: "0.56rem", fontWeight: 900, color: badgeColor, border: `1px solid ${badgeColor}55`, borderRadius: "999px", padding: "2px 7px" }}>{phase}</span>
                                                </div>
                                            </div>

                                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "0.6rem" }}>
                                                <div style={{ borderRadius: "10px", border: "1px solid rgba(34,197,94,0.3)", background: "rgba(34,197,94,0.08)", padding: "0.65rem" }}>
                                                    <div style={{ fontSize: "0.62rem", fontWeight: 900, color: "#22c55e", letterSpacing: "0.1em", textTransform: "uppercase" }}>CE Buy Setup</div>
                                                    <div style={{ marginTop: "0.3rem", fontSize: "0.72rem", fontWeight: 800, color: "#e2e8f0" }}>
                                                        {expiryIdx.abbr} CE ({w.mode === "ATM" ? "ATM" : "near OTM"})
                                                    </div>
                                                    <div style={{ marginTop: "0.32rem", fontSize: "0.62rem", color: "#cbd5e1", lineHeight: 1.5 }}>
                                                        Entry: Buy CE only on upside breakout with 5m candle confirmation.
                                                    </div>
                                                    <div style={{ marginTop: "0.22rem", fontSize: "0.62rem", color: "#cbd5e1", lineHeight: 1.5 }}>
                                                        SL/Invalidation: Breakdown below breakout trigger candle low.
                                                    </div>
                                                    <div style={{ marginTop: "0.22rem", fontSize: "0.62rem", color: "#cbd5e1", lineHeight: 1.5 }}>
                                                        Target/Exit: Book partial on 40-80% burst; hard exit by 3:28 PM IST.
                                                    </div>
                                                </div>

                                                <div style={{ borderRadius: "10px", border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.08)", padding: "0.65rem" }}>
                                                    <div style={{ fontSize: "0.62rem", fontWeight: 900, color: "#ef4444", letterSpacing: "0.1em", textTransform: "uppercase" }}>PE Buy Setup</div>
                                                    <div style={{ marginTop: "0.3rem", fontSize: "0.72rem", fontWeight: 800, color: "#e2e8f0" }}>
                                                        {expiryIdx.abbr} PE ({w.mode === "ATM" ? "ATM" : "near OTM"})
                                                    </div>
                                                    <div style={{ marginTop: "0.32rem", fontSize: "0.62rem", color: "#cbd5e1", lineHeight: 1.5 }}>
                                                        Entry: Buy PE only on downside breakdown with 5m candle confirmation.
                                                    </div>
                                                    <div style={{ marginTop: "0.22rem", fontSize: "0.62rem", color: "#cbd5e1", lineHeight: 1.5 }}>
                                                        SL/Invalidation: Recovery above breakdown trigger candle high.
                                                    </div>
                                                    <div style={{ marginTop: "0.22rem", fontSize: "0.62rem", color: "#cbd5e1", lineHeight: 1.5 }}>
                                                        Target/Exit: Book partial on 40-80% burst; hard exit by 3:28 PM IST.
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
                    ))}
                </div>
            )}
        </div>
    );
}
