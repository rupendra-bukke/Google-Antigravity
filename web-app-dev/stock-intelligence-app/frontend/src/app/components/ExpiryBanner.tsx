"use client";

import { useEffect, useState } from "react";

interface IndexConfig {
    name: string;
    abbr: string;
    exchange: "NSE" | "BSE";
    expiryDay: number;
    color: string;
    bg: string;
    border: string;
    glow: string;
}

interface ExpiryCard extends IndexConfig {
    expiry: Date;
    days: number;
    monthly: boolean;
}

const INDICES: IndexConfig[] = [
    {
        name: "Nifty 50",
        abbr: "NIFTY",
        exchange: "NSE",
        expiryDay: 4,
        color: "#818cf8",
        bg: "rgba(99,102,241,0.07)",
        border: "rgba(99,102,241,0.18)",
        glow: "rgba(99,102,241,0.25)",
    },
    {
        name: "Bank Nifty",
        abbr: "BANKNIFTY",
        exchange: "NSE",
        expiryDay: 3,
        color: "#22d3ee",
        bg: "rgba(6,182,212,0.07)",
        border: "rgba(6,182,212,0.18)",
        glow: "rgba(6,182,212,0.25)",
    },
    {
        name: "Fin Nifty",
        abbr: "FINNIFTY",
        exchange: "NSE",
        expiryDay: 2,
        color: "#34d399",
        bg: "rgba(16,185,129,0.07)",
        border: "rgba(16,185,129,0.18)",
        glow: "rgba(16,185,129,0.25)",
    },
    {
        name: "Sensex",
        abbr: "SENSEX",
        exchange: "BSE",
        expiryDay: 5,
        color: "#fbbf24",
        bg: "rgba(245,158,11,0.07)",
        border: "rgba(245,158,11,0.18)",
        glow: "rgba(245,158,11,0.25)",
    },
];

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function getISTToday(): Date {
    const now = new Date();
    const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
    return new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()));
}

function getNextExpiry(expiryDay: number, from: Date): Date {
    const day = from.getUTCDay();
    const diff = (expiryDay - day + 7) % 7;
    const d = new Date(from);
    d.setUTCDate(d.getUTCDate() + diff);
    return d;
}

function getLastExpiryOfMonth(expiryDay: number, year: number, month: number): Date {
    const d = new Date(Date.UTC(year, month + 1, 0));
    let back = d.getUTCDay() - expiryDay;
    if (back < 0) back += 7;
    d.setUTCDate(d.getUTCDate() - back);
    return d;
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

function statusText(days: number): string {
    if (days === 0) return "EXPIRY TODAY";
    if (days === 1) return "EXPIRY TOMORROW";
    return `IN ${days} DAYS`;
}

function urgencyHint(days: number): string {
    if (days === 0) return "High volatility and premium decay expected.";
    if (days === 1) return "Prepare strike plan and risk limits.";
    if (days <= 3) return "Keep levels ready for expiry setup.";
    return "Routine monitoring.";
}

export default function ExpiryBanner() {
    const [today, setToday] = useState<Date>(getISTToday);

    useEffect(() => {
        const timer = setInterval(() => setToday(getISTToday()), 60_000);
        return () => clearInterval(timer);
    }, []);

    const cards: ExpiryCard[] = INDICES.map((idx) => {
        const expiry = getNextExpiry(idx.expiryDay, today);
        const days = daysBetween(today, expiry);
        const monthly = isMonthlyExpiry(expiry, idx.expiryDay);
        return { ...idx, expiry, days, monthly };
    });

    const sorted = [...cards].sort((a, b) => a.days - b.days || a.abbr.localeCompare(b.abbr));
    const nearest = sorted[0];
    const todayExpiries = sorted.filter((c) => c.days === 0);

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.7rem" }}>
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: "0.6rem",
                    padding: "0.6rem 0.9rem",
                    borderRadius: "12px",
                    background: todayExpiries.length > 0 ? "rgba(239,68,68,0.08)" : "rgba(99,102,241,0.06)",
                    border: todayExpiries.length > 0 ? "1px solid rgba(239,68,68,0.28)" : "1px solid rgba(99,102,241,0.2)",
                }}
            >
                <div style={{ display: "flex", flexDirection: "column", gap: "0.15rem" }}>
                    <span style={{ fontSize: "0.56rem", fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.16em" }}>
                        Options Expiry Tracker
                    </span>
                    <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "#e2e8f0" }}>
                        Next: {nearest.abbr} | {statusText(nearest.days)} | {formatDate(nearest.expiry)}
                    </span>
                </div>

                {todayExpiries.length > 0 ? (
                    <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", flexWrap: "wrap" }}>
                        <span style={{ fontSize: "0.58rem", fontWeight: 900, color: "#f87171", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                            Expiry Today
                        </span>
                        {todayExpiries.map((c) => (
                            <span
                                key={c.abbr}
                                style={{
                                    fontSize: "0.62rem",
                                    fontWeight: 800,
                                    padding: "2px 8px",
                                    borderRadius: "7px",
                                    border: "1px solid rgba(239,68,68,0.35)",
                                    background: "rgba(239,68,68,0.16)",
                                    color: "#fca5a5",
                                    animation: "expiryPulse 1.4s ease-in-out infinite",
                                }}
                            >
                                {c.abbr} {c.monthly ? "MONTHLY" : "WEEKLY"}
                            </span>
                        ))}
                    </div>
                ) : (
                    <span style={{ fontSize: "0.62rem", color: "#94a3b8", fontWeight: 600 }}>
                        No index expiry today
                    </span>
                )}
            </div>

            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(185px, 1fr))",
                    gap: "0.65rem",
                }}
            >
                {sorted.map((c) => {
                    const isToday = c.days === 0;
                    const isTomorrow = c.days === 1;

                    const cardBg = isToday ? "rgba(239,68,68,0.12)" : isTomorrow ? "rgba(245,158,11,0.09)" : c.bg;
                    const cardBorder = isToday ? "rgba(239,68,68,0.4)" : isTomorrow ? "rgba(245,158,11,0.32)" : c.border;
                    const statusColor = isToday ? "#f87171" : isTomorrow ? "#fbbf24" : c.color;

                    return (
                        <div
                            key={c.abbr}
                            style={{
                                position: "relative",
                                overflow: "hidden",
                                borderRadius: "14px",
                                padding: "0.75rem 0.85rem",
                                border: `1px solid ${cardBorder}`,
                                background: cardBg,
                                boxShadow: isToday ? "0 0 24px rgba(239,68,68,0.22)" : `0 0 10px ${c.glow}`,
                                transform: isToday ? "translateY(-1px) scale(1.01)" : "none",
                                transition: "all 0.25s ease",
                            }}
                        >
                            <div
                                style={{
                                    position: "absolute",
                                    top: 0,
                                    left: 0,
                                    right: 0,
                                    height: "2px",
                                    background: isToday ? "linear-gradient(90deg, #ef4444, #f87171, #ef4444)" : `linear-gradient(90deg, ${statusColor}, transparent)`,
                                }}
                            />

                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <span style={{ fontSize: "0.72rem", fontWeight: 900, color: statusColor, letterSpacing: "0.04em" }}>{c.abbr}</span>
                                <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                                    {isToday && (
                                        <span
                                            style={{
                                                fontSize: "0.44rem",
                                                fontWeight: 900,
                                                padding: "1px 5px",
                                                borderRadius: "4px",
                                                background: "rgba(239,68,68,0.22)",
                                                border: "1px solid rgba(239,68,68,0.4)",
                                                color: "#fca5a5",
                                                letterSpacing: "0.1em",
                                                animation: "expiryPulse 1.4s ease-in-out infinite",
                                            }}
                                        >
                                            TODAY
                                        </span>
                                    )}
                                    <span
                                        style={{
                                            fontSize: "0.46rem",
                                            fontWeight: 800,
                                            padding: "1px 6px",
                                            borderRadius: "4px",
                                            background: c.exchange === "NSE" ? "rgba(99,102,241,0.15)" : "rgba(245,158,11,0.15)",
                                            color: c.exchange === "NSE" ? "#a5b4fc" : "#fcd34d",
                                            letterSpacing: "0.09em",
                                        }}
                                    >
                                        {c.exchange}
                                    </span>
                                </div>
                            </div>

                            <div style={{ marginTop: "0.35rem", fontSize: "0.63rem", fontWeight: 900, color: statusColor, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                                {statusText(c.days)}
                            </div>

                            <div style={{ marginTop: "0.22rem", fontSize: "0.84rem", fontWeight: 700, color: "#e2e8f0" }}>{formatDate(c.expiry)}</div>

                            <div style={{ marginTop: "0.32rem", fontSize: "0.58rem", color: "#94a3b8", lineHeight: 1.45 }}>{urgencyHint(c.days)}</div>

                            <div style={{ marginTop: "0.45rem", display: "flex", alignItems: "center", gap: "0.45rem" }}>
                                <span
                                    style={{
                                        fontSize: "0.48rem",
                                        fontWeight: 800,
                                        padding: "1px 6px",
                                        borderRadius: "4px",
                                        background: c.monthly ? "rgba(212,175,55,0.13)" : "rgba(148,163,184,0.1)",
                                        color: c.monthly ? "#d4af37" : "#94a3b8",
                                        textTransform: "uppercase",
                                        letterSpacing: "0.09em",
                                    }}
                                >
                                    {c.monthly ? "Monthly" : "Weekly"}
                                </span>
                                <div style={{ flex: 1, height: "4px", background: "rgba(255,255,255,0.08)", borderRadius: "3px", overflow: "hidden" }}>
                                    <div
                                        style={{
                                            height: "100%",
                                            width: `${Math.max(5, 100 - (c.days / 7) * 100)}%`,
                                            background: isToday ? "#ef4444" : isTomorrow ? "#f59e0b" : statusColor,
                                        }}
                                    />
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            <style>{`
                @keyframes expiryPulse {
                    0%, 100% { opacity: 1; transform: scale(1); }
                    50% { opacity: 0.62; transform: scale(1.02); }
                }
            `}</style>
        </div>
    );
}
