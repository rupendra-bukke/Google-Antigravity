"use client";

import { useEffect, useState } from "react";

interface ExpirySpec {
    name: string;
    abbr: string;
    expiryDay: number; // JS weekday: 0=Sun..6=Sat
    strikeStep: number;
}

const EXPIRY_BY_SYMBOL: Record<string, ExpirySpec> = {
    "^NSEI": { name: "Nifty 50", abbr: "NIFTY", expiryDay: 4, strikeStep: 50 },
    "NIFTY": { name: "Nifty 50", abbr: "NIFTY", expiryDay: 4, strikeStep: 50 },
    "^NSEBANK": { name: "Bank Nifty", abbr: "BANKNIFTY", expiryDay: 3, strikeStep: 100 },
    "BANKNIFTY": { name: "Bank Nifty", abbr: "BANKNIFTY", expiryDay: 3, strikeStep: 100 },
    "FINNIFTY": { name: "Fin Nifty", abbr: "FINNIFTY", expiryDay: 2, strikeStep: 50 },
    "^BSESN": { name: "Sensex", abbr: "SENSEX", expiryDay: 5, strikeStep: 100 },
    "SENSEX": { name: "Sensex", abbr: "SENSEX", expiryDay: 5, strikeStep: 100 },
};

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

function resolveExpirySpec(symbol: string): ExpirySpec | null {
    const clean = (symbol || "").trim().toUpperCase();
    return EXPIRY_BY_SYMBOL[symbol] || EXPIRY_BY_SYMBOL[clean] || null;
}

export default function ExpiryZeroHeroPanel({ symbol, spotPrice }: { symbol: string; spotPrice: number | null }) {
    const [istNow, setIstNow] = useState<Date>(getIstShiftedNow());

    useEffect(() => {
        const timer = setInterval(() => setIstNow(getIstShiftedNow()), 60_000);
        return () => clearInterval(timer);
    }, []);

    const spec = resolveExpirySpec(symbol);
    if (!spec) return null;

    const today = getIstDateOnly(istNow);
    const nextExpiry = getNextExpiry(spec.expiryDay, today);
    const days = daysBetween(today, nextExpiry);
    const isExpiryToday = days === 0;
    const nowHHMM = hhmmIst(istNow);

    const atm = typeof spotPrice === "number" && Number.isFinite(spotPrice) && spotPrice > 0
        ? roundToStep(spotPrice, spec.strikeStep)
        : null;

    const ceOtm = atm !== null ? atm + spec.strikeStep : null;
    const peOtm = atm !== null ? atm - spec.strikeStep : null;

    const ceTrigger = atm !== null ? atm + spec.strikeStep * 0.25 : null;
    const peTrigger = atm !== null ? atm - spec.strikeStep * 0.25 : null;

    const windows = [
        { label: "1 PM Window", start: 1300, end: 1400, mode: "ATM", confidence: "MEDIUM", risk: "High risk. Enter only on breakout candle confirmation." },
        { label: "2 PM Window", start: 1400, end: 1500, mode: "NEAR OTM", confidence: "MEDIUM-HIGH", risk: "Very high risk. Premium decay and spikes both fast." },
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
                        {spec.abbr} | {isExpiryToday ? "Expiry Today" : `Next expiry: ${fmtDateShort(nextExpiry)} (${days === 1 ? "Tomorrow" : `in ${days} days`})`}
                    </div>
                    <div style={{ marginTop: "0.2rem", fontSize: "0.58rem", color: "#94a3b8" }}>
                        Rule-based panel (separate from AI prompt output)
                    </div>
                </div>
                <div style={{ fontSize: "0.58rem", color: "#94a3b8", fontWeight: 700 }}>
                    Time now: {String(istNow.getUTCHours()).padStart(2, "0")}:{String(istNow.getUTCMinutes()).padStart(2, "0")} IST
                </div>
            </div>

            {!isExpiryToday ? (
                <div style={{ borderRadius: "10px", border: "1px solid rgba(148,163,184,0.2)", background: "rgba(15,23,42,0.45)", padding: "0.75rem" }}>
                    <div style={{ fontSize: "0.66rem", color: "#cbd5e1", lineHeight: 1.55 }}>
                        Today is not {spec.abbr} expiry. This section activates on expiry day after 1 PM.
                    </div>
                    <div style={{ marginTop: "0.45rem", fontSize: "0.62rem", color: "#94a3b8", lineHeight: 1.5 }}>
                        Upcoming plan: track trend till 1 PM, then use fast-move CE/PE breakout setups with strict SL and fixed exit discipline.
                    </div>
                </div>
            ) : (
                <div style={{ display: "grid", gap: "0.65rem" }}>
                    {windows.map((w) => {
                        const phase = nowHHMM < w.start ? "UPCOMING" : nowHHMM < w.end ? "LIVE" : "CLOSED";
                        const badgeColor = phase === "LIVE" ? "#22c55e" : phase === "UPCOMING" ? "#f59e0b" : "#64748b";
                        const useAtm = w.mode === "ATM";
                        const ceStrike = useAtm ? atm : ceOtm;
                        const peStrike = useAtm ? atm : peOtm;

                        return (
                            <div key={w.label} style={{ borderRadius: "12px", border: "1px solid rgba(255,255,255,0.08)", background: "rgba(2,6,23,0.55)", padding: "0.75rem" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.6rem", flexWrap: "wrap", marginBottom: "0.55rem" }}>
                                    <div style={{ fontSize: "0.72rem", fontWeight: 800, color: "#e2e8f0" }}>
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
                                            {ceStrike ? `${spec.abbr} ${ceStrike} CE ${useAtm ? "(ATM)" : "(near OTM)"}` : `${spec.abbr} CE (${w.mode})`}
                                        </div>
                                        <div style={{ marginTop: "0.32rem", fontSize: "0.62rem", color: "#cbd5e1", lineHeight: 1.5 }}>
                                            Entry: {ceTrigger ? `Buy only above spot ${fmtNum(ceTrigger)} with 5m confirmation.` : "Buy only on upside breakout confirmation."}
                                        </div>
                                        <div style={{ marginTop: "0.22rem", fontSize: "0.62rem", color: "#cbd5e1", lineHeight: 1.5 }}>
                                            SL/Invalidation: If breakout fails and price closes back below trigger candle low.
                                        </div>
                                        <div style={{ marginTop: "0.22rem", fontSize: "0.62rem", color: "#cbd5e1", lineHeight: 1.5 }}>
                                            Target/Exit: Scale out on 40-80% premium burst, hard exit by 3:28 PM IST.
                                        </div>
                                    </div>

                                    <div style={{ borderRadius: "10px", border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.08)", padding: "0.65rem" }}>
                                        <div style={{ fontSize: "0.62rem", fontWeight: 900, color: "#ef4444", letterSpacing: "0.1em", textTransform: "uppercase" }}>PE Buy Setup</div>
                                        <div style={{ marginTop: "0.3rem", fontSize: "0.72rem", fontWeight: 800, color: "#e2e8f0" }}>
                                            {peStrike ? `${spec.abbr} ${peStrike} PE ${useAtm ? "(ATM)" : "(near OTM)"}` : `${spec.abbr} PE (${w.mode})`}
                                        </div>
                                        <div style={{ marginTop: "0.32rem", fontSize: "0.62rem", color: "#cbd5e1", lineHeight: 1.5 }}>
                                            Entry: {peTrigger ? `Buy only below spot ${fmtNum(peTrigger)} with 5m confirmation.` : "Buy only on downside breakdown confirmation."}
                                        </div>
                                        <div style={{ marginTop: "0.22rem", fontSize: "0.62rem", color: "#cbd5e1", lineHeight: 1.5 }}>
                                            SL/Invalidation: If breakdown fails and price closes back above trigger candle high.
                                        </div>
                                        <div style={{ marginTop: "0.22rem", fontSize: "0.62rem", color: "#cbd5e1", lineHeight: 1.5 }}>
                                            Target/Exit: Scale out on 40-80% premium burst, hard exit by 3:28 PM IST.
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
            )}
        </div>
    );
}
