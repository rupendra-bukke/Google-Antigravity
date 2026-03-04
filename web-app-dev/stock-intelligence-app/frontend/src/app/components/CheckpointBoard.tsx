"use client";

import { useState, useEffect, useCallback } from "react";

// Use relative path — Next.js rewrites /api/* to the backend via next.config.mjs
const API_BASE = "/api";
const FIXED_SYMBOL = "^NSEI"; // Always track Nifty 50 only

interface CheckpointData {
    captured_at: string;
    spot_price: number;
    scalp_signal: string;
    three_min_confirm: string;
    htf_trend: string;
    trend_direction: string;
    execute: string;       // "Strong" | "Weak" | "NO TRADE"
    execute_reason: string;
    option_strike?: {
        strike: number;
        option_type: string;
        expiry: string;
        entry_price?: number;
        stop_loss?: number;
        target?: number;
    } | null;
    forecast?: {
        direction: string;   // "UP" | "DOWN" | "FLAT"
        arrow: string;       // emoji arrow
        confidence: number;  // 0-100
        reasons: string[];
    } | null;
}

interface Panel {
    id: string;
    label: string;
    time: string;
    data: CheckpointData | null;
}

/** Compute ONE unified directional signal from all V2 inputs.
 *  Priority:
 *    1. Strong execute scalp  → trust scalp_signal (BUY/SELL)
 *    2. Majority vote: trend + forecast + weak scalp
 *    3. Conflict → WAIT with lean
 */
function getNextMove(data: CheckpointData) {
    const scalp = data.scalp_signal || "";
    const execute = data.execute || "";
    const trend = data.trend_direction || "";
    const fc = data.forecast;

    const isBuyS = scalp.toLowerCase().includes("buy");
    const isSellS = scalp.toLowerCase().includes("sell");
    const strong = execute === "Strong";
    const fcUp = fc?.direction === "UP";
    const fcDown = fc?.direction === "DOWN";
    const fcConf = fc?.confidence ?? 50;
    const tUp = trend.includes("Bullish") || trend.toLowerCase().includes("→ 🟢");
    const tDown = trend.includes("Bearish") || trend.toLowerCase().includes("→ 🔴");

    // Strong confirmed scalp → definitive
    if (strong && isBuyS) return { arrow: "▲", label: "BUY / CE", sublabel: tUp ? "Trend BULLISH · Confirmed" : "Scalp BUY · Strong", color: "#4ade80", bg: "rgba(34,197,94,0.12)", border: "rgba(34,197,94,0.35)", conf: fcConf, confColor: "#4ade80" };
    if (strong && isSellS) return { arrow: "▼", label: "SELL / PE", sublabel: tDown ? "Trend BEARISH · Confirmed" : "Scalp SELL · Strong", color: "#f87171", bg: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.35)", conf: fcConf, confColor: "#f87171" };

    // Majority vote
    const bull = (tUp ? 1 : 0) + (fcUp ? 1 : 0) + (isBuyS ? 1 : 0);
    const bear = (tDown ? 1 : 0) + (fcDown ? 1 : 0) + (isSellS ? 1 : 0);

    if (bull > bear && bull >= 2) {
        const why = tUp && fcUp ? "Trend + Forecast aligned UP"
            : tUp ? `Trend BULLISH · Forecast ${fc?.direction ?? "?"}`
                : `Forecast UP · ${fcConf}% conf`;
        return { arrow: "▲", label: "BUY / CE", sublabel: why, color: "#4ade80", bg: "rgba(34,197,94,0.08)", border: "rgba(34,197,94,0.2)", conf: fcConf, confColor: "#4ade80" };
    }
    if (bear > bull && bear >= 2) {
        const why = tDown && fcDown ? "Trend + Forecast aligned DOWN"
            : tDown ? `Trend BEARISH · Forecast ${fc?.direction ?? "?"}`
                : `Forecast DOWN · ${fcConf}% conf`;
        return { arrow: "▼", label: "SELL / PE", sublabel: why, color: "#f87171", bg: "rgba(239,68,68,0.08)", border: "rgba(239,68,68,0.2)", conf: fcConf, confColor: "#f87171" };
    }

    // Conflicting
    const lean = fcUp ? "Lean UP" : fcDown ? "Lean DOWN" : "No clear direction";
    return { arrow: "◆", label: "WAIT", sublabel: `Mixed signals — ${lean}`, color: "#94a3b8", bg: "rgba(148,163,184,0.06)", border: "rgba(148,163,184,0.15)", conf: fcConf, confColor: "#94a3b8" };
}

function StatItem({ label, value, color = "#94a3b8" }: { label: string, value: string | number, color?: string }) {
    return (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "0.65rem", color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>{label}</span>
            <span style={{ fontSize: "0.75rem", color, fontWeight: 600 }}>{value}</span>
        </div>
    );
}

function CheckpointCard({ panel, index, isLatest }: { panel: Panel; index: number; isLatest: boolean }) {
    const [h, m] = panel.time.split(":").map(Number);
    const targetTime = new Date(); targetTime.setHours(h, m, 0, 0);
    const isPending = !panel.data && new Date() < targetTime;
    const isMissed = !panel.data && new Date() >= targetTime;
    const isPopulated = !!panel.data;
    const move = isPopulated ? getNextMove(panel.data!) : null;

    return (
        <div style={{
            background: !isPopulated ? "rgba(15,23,42,0.2)" : move?.bg ?? "rgba(148,163,184,0.06)",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            border: isLatest ? "1px solid rgba(212,175,55,0.4)"
                : !isPopulated ? "1px dashed rgba(255,255,255,0.05)"
                    : `1px solid ${move?.border ?? "rgba(148,163,184,0.15)"}`,
            borderRadius: "16px",
            padding: "1.2rem",
            minWidth: "200px",
            position: "relative",
            transition: "all 0.3s cubic-bezier(0.4,0,0.2,1)",
            boxShadow: isLatest ? "0 10px 30px -10px rgba(212,175,55,0.15)" : "none",
            transform: isLatest ? "scale(1.02)" : "scale(1)",
            zIndex: isLatest ? 2 : 1
        }}>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.9rem" }}>
                <div>
                    <h4 style={{ color: isPopulated ? "#f8fafc" : "#475569", margin: 0, fontSize: "0.82rem", fontWeight: 700 }}>{panel.label}</h4>
                    <span style={{ fontSize: "0.68rem", color: "#64748b", fontWeight: 600 }}>{panel.time} IST</span>
                </div>
                {isLatest && (
                    <div style={{ background: "#d4af37", color: "#000", fontSize: "0.55rem", fontWeight: 900, padding: "2px 6px", borderRadius: "4px", textTransform: "uppercase" }}>Latest</div>
                )}
            </div>

            {isPopulated && move ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>

                    {/* ── HERO: ONE UNIFIED NEXT MOVE ── */}
                    <div style={{ background: move.bg, border: `1px solid ${move.border}`, borderRadius: "12px", padding: "10px 12px", display: "flex", flexDirection: "column", gap: "4px" }}>
                        <span style={{ fontSize: "0.5rem", color: "#64748b", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.12em" }}>Next Move →</span>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <span style={{ fontSize: "1.5rem", fontWeight: 900, color: move.color, textShadow: `0 0 18px ${move.color}55`, lineHeight: 1 }}>{move.arrow}</span>
                            <span style={{ fontSize: "1.05rem", fontWeight: 900, color: move.color, letterSpacing: "0.04em", lineHeight: 1 }}>{move.label}</span>
                        </div>
                        <span style={{ fontSize: "0.6rem", color: "#94a3b8", fontWeight: 500, lineHeight: 1.3 }}>{move.sublabel}</span>
                        <div style={{ height: "3px", background: "rgba(255,255,255,0.06)", borderRadius: "2px", marginTop: "4px" }}>
                            <div style={{ height: "100%", width: `${move.conf}%`, borderRadius: "2px", background: move.confColor, transition: "width 0.6s ease" }} />
                        </div>
                        <span style={{ fontSize: "0.55rem", color: "#475569", fontWeight: 600 }}>{move.conf}% confidence</span>
                    </div>

                    {/* Price + Option */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: "0.55rem" }}>
                        <StatItem label="Price" value={`₹${panel.data!.spot_price.toLocaleString("en-IN")}`} color="#e2e8f0" />
                        {panel.data!.option_strike?.strike && (
                            <div style={{ background: "rgba(212,175,55,0.05)", padding: "4px 8px", borderRadius: "6px", fontSize: "0.65rem", color: "#d4af37", fontWeight: 700, border: "1px solid rgba(212,175,55,0.12)", display: "flex", justifyContent: "space-between" }}>
                                <span>🎯 Option</span>
                                <span>{panel.data!.option_strike!.option_type} {panel.data!.option_strike!.strike}</span>
                            </div>
                        )}
                    </div>

                </div>
            ) : (
                <div style={{ height: "120px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", opacity: 0.6 }}>
                    <div style={{ fontSize: "1.5rem", marginBottom: "0.5rem", animation: (isPending || isMissed) ? "pulse 1.5s infinite" : "none" }}>
                        {isPending ? "⏳" : isMissed ? "🔄" : "📭"}
                    </div>
                    <p style={{ color: "#64748b", fontSize: "0.65rem", textAlign: "center", margin: 0, textTransform: "uppercase", fontWeight: 700 }}>
                        {isPending ? "Waiting..." : isMissed ? "Catching up..." : "No Data"}
                    </p>
                </div>
            )}
        </div>
    );
}

export default function CheckpointBoard() {
    const [panels, setPanels] = useState<Panel[]>([]);
    const [loading, setLoading] = useState(true);
    const [catchingUp, setCatchingUp] = useState(false);

    const fetchPanels = useCallback(async () => {
        try {
            const res = await fetch(`${API_BASE}/v1/checkpoints?symbol=${encodeURIComponent(FIXED_SYMBOL)}`);
            if (!res.ok) return;
            const json = await res.json();
            setPanels(json.panels || []);
            // If backend triggered a historical catch-up, show feedback and refresh faster
            setCatchingUp(json.catchup_triggered === true);
        } catch (err) {
            console.error("Failed to fetch checkpoints:", err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchPanels();
        // Fast refresh (10s) while catching up; slow (30s) once stable
        const interval = setInterval(fetchPanels, catchingUp ? 10000 : 30000);
        return () => clearInterval(interval);
    }, [fetchPanels, catchingUp]);

    // Find the index of the most recent populated panel
    const latestIndex = panels.length - 1 - [...panels].reverse().findIndex(p => p.data);
    const effectiveLatestIndex = latestIndex >= 0 ? latestIndex : -1;

    return (
        <div style={{ margin: "2.5rem 0" }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "1.5rem" }}>
                <div style={{ width: "3px", height: "18px", background: "#d4af37", borderRadius: "2px" }} />
                <h2 style={{
                    fontSize: "0.75rem",
                    fontWeight: 900,
                    color: "#94a3b8",
                    textTransform: "uppercase",
                    letterSpacing: "0.2em",
                    margin: 0
                }}>
                    Nifty 50 Market Timeline
                </h2>
                <div style={{ flex: 1, height: "1px", background: "linear-gradient(to right, rgba(148,163,184,0.1), transparent)" }} />
                {catchingUp ? (
                    <span style={{ fontSize: "0.6rem", color: "#f59e0b", fontWeight: 700, animation: "pulse 1.5s infinite" }}>
                        🔄 CATCHING UP HISTORICAL DATA...
                    </span>
                ) : (
                    <span style={{ fontSize: "0.6rem", color: "#475569", fontWeight: 700 }}>CAPTURING 7 STRATEGIC POINTS</span>
                )}
            </div>

            {/* Grid Container */}
            <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                gap: "1rem",
                perspective: "1000px"
            }}>
                {loading && panels.length === 0 ? (
                    Array(7).fill(0).map((_, i) => (
                        <div key={i} style={{ height: "200px", background: "rgba(255,255,255,0.02)", borderRadius: "16px", animation: "pulse 2s shadow infinite" }} />
                    ))
                ) : (
                    panels.map((panel, i) => (
                        <CheckpointCard
                            key={panel.id}
                            panel={panel}
                            index={i}
                            isLatest={i === effectiveLatestIndex}
                        />
                    ))
                )}
            </div>

            <style>{`
        @keyframes pulse {
          0% { transform: scale(1); opacity: 0.5; }
          50% { transform: scale(1.05); opacity: 1; }
          100% { transform: scale(1); opacity: 0.5; }
        }
      `}</style>
        </div>
    );
}
