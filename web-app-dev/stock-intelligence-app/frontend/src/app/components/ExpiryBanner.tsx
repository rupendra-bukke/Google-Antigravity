"use client";

import { useState, useEffect } from "react";

/* ── NSE/BSE Weekly Expiry Schedule ──────────────────────────────────────────
 *  0=Sun  1=Mon  2=Tue  3=Wed  4=Thu  5=Fri  6=Sat
 *  MIDCAP SELECT → Mon | FIN NIFTY → Tue | BANK NIFTY → Wed
 *  NIFTY 50      → Thu | SENSEX    → Fri | BANKEX     → Mon
 * ──────────────────────────────────────────────────────────────────────────── */

interface IndexConfig {
    name: string;
    abbr: string;
    exchange: "NSE" | "BSE";
    expiryDay: number;         // day-of-week integer
    color: string;             // primary accent colour
    bg: string;                // card background tint
    border: string;            // card border
    glow: string;              // box-shadow glow
}

const INDICES: IndexConfig[] = [
    {
        name: "Nifty 50", abbr: "NIFTY", exchange: "NSE", expiryDay: 4,
        color: "#818cf8", bg: "rgba(99,102,241,0.07)", border: "rgba(99,102,241,0.18)", glow: "rgba(99,102,241,0.25)",
    },
    {
        name: "Bank Nifty", abbr: "BANKNIFTY", exchange: "NSE", expiryDay: 3,
        color: "#22d3ee", bg: "rgba(6,182,212,0.07)", border: "rgba(6,182,212,0.18)", glow: "rgba(6,182,212,0.25)",
    },
    {
        name: "Fin Nifty", abbr: "FINNIFTY", exchange: "NSE", expiryDay: 2,
        color: "#34d399", bg: "rgba(16,185,129,0.07)", border: "rgba(16,185,129,0.18)", glow: "rgba(16,185,129,0.25)",
    },
    {
        name: "Sensex", abbr: "SENSEX", exchange: "BSE", expiryDay: 5,
        color: "#fbbf24", bg: "rgba(245,158,11,0.07)", border: "rgba(245,158,11,0.18)", glow: "rgba(245,158,11,0.25)",
    },
];

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/* ── Helpers ────────────────────────────────────────────────────────────────── */

function getISTToday(): Date {
    const now = new Date();
    const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
    return new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()));
}

/** Returns next (or current) expiry date for a given weekday target */
function getNextExpiry(expiryDay: number, from: Date): Date {
    const day = from.getUTCDay();
    const diff = (expiryDay - day + 7) % 7;   // 0 = today is expiry
    const d = new Date(from);
    d.setUTCDate(d.getUTCDate() + diff);
    return d;
}

/** Returns the last occurrence of `expiryDay` in the month of `d` */
function getLastExpiryOfMonth(expiryDay: number, year: number, month: number): Date {
    const lastDay = new Date(Date.UTC(year, month + 1, 0));
    const diff = (expiryDay - lastDay.getUTCDay() + 7) % 7;
    const d = new Date(lastDay);
    d.setUTCDate(lastDay.getUTCDate() - (diff === 0 ? 0 : 7 - diff));
    // if diff > 0 we went backward, so recalc properly
    const d2 = new Date(Date.UTC(year, month + 1, 0));
    let back = d2.getUTCDay() - expiryDay;
    if (back < 0) back += 7;
    d2.setUTCDate(d2.getUTCDate() - back);
    return d2;
}

function isMonthlyExpiry(date: Date, expiryDay: number): boolean {
    const last = getLastExpiryOfMonth(expiryDay, date.getUTCFullYear(), date.getUTCMonth());
    return date.getUTCDate() === last.getUTCDate() && date.getUTCMonth() === last.getUTCMonth();
}

function daysBetween(a: Date, b: Date): number {
    return Math.round((b.getTime() - a.getTime()) / 86400000);
}

function formatDate(d: Date): string {
    return `${DAYS[d.getUTCDay()]}, ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

/* ── Component ───────────────────────────────────────────────────────────────── */

export default function ExpiryBanner() {
    const [now, setNow] = useState<Date>(getISTToday);

    // Recalculate every 60 seconds (so midnight rollover is captured)
    useEffect(() => {
        const t = setInterval(() => setNow(getISTToday()), 60_000);
        return () => clearInterval(t);
    }, []);

    const cards = INDICES.map((idx) => {
        const expiry  = getNextExpiry(idx.expiryDay, now);
        const days    = daysBetween(now, expiry);
        const monthly = isMonthlyExpiry(expiry, idx.expiryDay);
        return { ...idx, expiry, days, monthly };
    });

    // Any TODAY expiry?
    const todayExpiries = cards.filter(c => c.days === 0);
    const tomorrowExpiries = cards.filter(c => c.days === 1);

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>

            {/* ── Alert row — only if expiry today or tomorrow ── */}
            {(todayExpiries.length > 0 || tomorrowExpiries.length > 0) && (
                <div style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "0.5rem",
                    alignItems: "center",
                    padding: "0.45rem 0.9rem",
                    borderRadius: "10px",
                    background: todayExpiries.length > 0
                        ? "rgba(239,68,68,0.07)"
                        : "rgba(245,158,11,0.06)",
                    border: todayExpiries.length > 0
                        ? "1px solid rgba(239,68,68,0.25)"
                        : "1px solid rgba(245,158,11,0.2)",
                }}>
                    <span style={{ fontSize: "0.65rem", fontWeight: 900, color: todayExpiries.length > 0 ? "#f87171" : "#fbbf24", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                        {todayExpiries.length > 0 ? "🔴 Expiry Today" : "🟡 Expiry Tomorrow"}
                    </span>
                    {todayExpiries.map(c => (
                        <span key={c.abbr} style={{
                            fontSize: "0.6rem", fontWeight: 800, padding: "2px 8px",
                            borderRadius: "6px", background: "rgba(239,68,68,0.15)",
                            border: "1px solid rgba(239,68,68,0.3)", color: "#fca5a5",
                            animation: "expiryPulse 1.5s ease-in-out infinite"
                        }}>
                            {c.abbr} {c.monthly ? "★ MONTHLY" : "WEEKLY"}
                        </span>
                    ))}
                    {tomorrowExpiries.map(c => (
                        <span key={c.abbr} style={{
                            fontSize: "0.6rem", fontWeight: 800, padding: "2px 8px",
                            borderRadius: "6px", background: "rgba(245,158,11,0.12)",
                            border: "1px solid rgba(245,158,11,0.25)", color: "#fcd34d",
                        }}>
                            {c.abbr} tomorrow
                        </span>
                    ))}
                </div>
            )}

            {/* ── Main expiry cards ── */}
            <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
                gap: "0.6rem",
            }}>
                {cards.map((c) => {
                    const isToday    = c.days === 0;
                    const isTomorrow = c.days === 1;

                    const cardBg     = isToday ? "rgba(239,68,68,0.1)"    : isTomorrow ? "rgba(245,158,11,0.08)" : c.bg;
                    const cardBorder = isToday ? "rgba(239,68,68,0.35)"   : isTomorrow ? "rgba(245,158,11,0.3)"  : c.border;
                    const cardGlow   = isToday ? "rgba(239,68,68,0.2)"    : isTomorrow ? "rgba(245,158,11,0.15)" : c.glow;
                    const labelColor = isToday ? "#f87171"                : isTomorrow ? "#fbbf24"               : c.color;

                    return (
                        <div key={c.abbr} style={{
                            background: cardBg,
                            border: `1px solid ${cardBorder}`,
                            borderRadius: "12px",
                            padding: "0.7rem 0.85rem",
                            display: "flex",
                            flexDirection: "column",
                            gap: "0.25rem",
                            boxShadow: isToday ? `0 0 16px ${cardGlow}` : `0 0 8px ${cardGlow}`,
                            transition: "all 0.3s ease",
                            position: "relative",
                            overflow: "hidden",
                        }}>
                            {/* Subtle gradient shine */}
                            <div style={{
                                position: "absolute", top: 0, right: 0,
                                width: "60px", height: "60px",
                                background: `radial-gradient(circle, ${cardGlow} 0%, transparent 70%)`,
                                pointerEvents: "none",
                            }} />

                            {/* Header row */}
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <span style={{
                                    fontSize: "0.7rem", fontWeight: 900, color: labelColor,
                                    letterSpacing: "0.04em",
                                    animation: isToday ? "expiryPulse 1.5s ease-in-out infinite" : "none",
                                }}>
                                    {c.abbr}
                                </span>
                                <span style={{
                                    fontSize: "0.48rem", fontWeight: 700,
                                    padding: "1px 5px", borderRadius: "4px",
                                    background: c.exchange === "NSE" ? "rgba(99,102,241,0.15)" : "rgba(245,158,11,0.15)",
                                    color: c.exchange === "NSE" ? "#a5b4fc" : "#fcd34d",
                                    letterSpacing: "0.08em",
                                }}>
                                    {c.exchange}
                                </span>
                            </div>

                            {/* Status badge */}
                            <div style={{
                                display: "inline-flex", alignItems: "center", gap: "4px",
                                marginTop: "2px",
                            }}>
                                <span style={{ fontSize: "0.55rem", fontWeight: 900, color: labelColor, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                                    {isToday ? "🔴 Expires Today" : isTomorrow ? "🟡 Tomorrow" : `In ${c.days} days`}
                                </span>
                            </div>

                            {/* Date */}
                            <span style={{ fontSize: "0.68rem", fontWeight: 700, color: "#e2e8f0", marginTop: "1px" }}>
                                {formatDate(c.expiry)}
                            </span>

                            {/* Monthly / Weekly tag + progress bar */}
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "4px" }}>
                                <span style={{
                                    fontSize: "0.48rem", fontWeight: 800,
                                    padding: "1px 6px", borderRadius: "4px",
                                    background: c.monthly ? "rgba(212,175,55,0.12)" : "rgba(148,163,184,0.08)",
                                    color: c.monthly ? "#d4af37" : "#64748b",
                                    letterSpacing: "0.1em", textTransform: "uppercase",
                                }}>
                                    {c.monthly ? "★ Monthly" : "Weekly"}
                                </span>
                                {/* Urgency bar — fills as expiry approaches within 7 days */}
                                <div style={{ flex: 1, marginLeft: "8px", height: "3px", background: "rgba(255,255,255,0.06)", borderRadius: "2px" }}>
                                    <div style={{
                                        height: "100%",
                                        width: `${Math.max(5, 100 - (c.days / 7) * 100)}%`,
                                        background: isToday ? "#ef4444" : isTomorrow ? "#f59e0b" : labelColor,
                                        borderRadius: "2px",
                                        transition: "width 0.5s ease",
                                        opacity: 0.8,
                                    }} />
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Keyframes */}
            <style>{`
                @keyframes expiryPulse {
                    0%, 100% { opacity: 1; }
                    50%       { opacity: 0.55; }
                }
            `}</style>
        </div>
    );
}
