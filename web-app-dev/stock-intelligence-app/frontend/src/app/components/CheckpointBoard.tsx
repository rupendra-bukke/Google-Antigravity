"use client";

import { useState, useEffect, useCallback } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const FIXED_SYMBOL = "^NSEI"; // Always track Nifty 50 only

interface CheckpointData {
    captured_at: string;
    spot_price: number;
    scalp_signal: string;
    three_min_confirm: string;
    htf_trend: string;
    trend_direction: string;
    execute: boolean;
    execute_reason: string;
    option_strike?: {
        strike: number;
        option_type: string;
        expiry: string;
        entry_price?: number;
        stop_loss?: number;
        target?: number;
    } | null;
}

interface Panel {
    id: string;
    label: string;
    time: string;
    data: CheckpointData | null;
}

function SignalValue({ signal }: { signal: string }) {
    const isBuy = signal?.toLowerCase().includes("buy") || signal?.includes("🟢");
    const isSell = signal?.toLowerCase().includes("sell") || signal?.includes("🔴");
    const color = isBuy ? "#4ade80" : isSell ? "#f87171" : "#94a3b8";

    return (
        <div style={{
            fontSize: "1.2rem",
            fontWeight: 900,
            color,
            textShadow: isBuy ? "0 0 15px rgba(74,222,128,0.3)" : isSell ? "0 0 15px rgba(248,113,113,0.3)" : "none",
            letterSpacing: "0.02em"
        }}>
            {signal || "WAITING"}
        </div>
    );
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
    const dateObj = new Date();
    const [h, m] = panel.time.split(":").map(Number);
    const targetTime = new Date();
    targetTime.setHours(h, m, 0, 0);
    const isPending = !panel.data && new Date() < targetTime;
    const isMissed = !panel.data && new Date() >= targetTime;
    const isPopulated = !!panel.data;

    return (
        <div
            style={{
                background: !isPopulated
                    ? "rgba(15, 23, 42, 0.2)"
                    : panel.data!.scalp_signal.includes("BUY")
                        ? "rgba(34, 197, 94, 0.12)"
                        : panel.data!.scalp_signal.includes("SELL")
                            ? "rgba(239, 68, 68, 0.12)"
                            : "rgba(148, 163, 184, 0.12)",
                backdropFilter: "blur(16px)",
                WebkitBackdropFilter: "blur(16px)",
                border: isLatest
                    ? "1px solid rgba(212, 175, 55, 0.4)"
                    : !isPopulated
                        ? "1px dashed rgba(255, 255, 255, 0.05)"
                        : panel.data!.scalp_signal.includes("BUY")
                            ? "1px solid rgba(34, 197, 94, 0.3)"
                            : panel.data!.scalp_signal.includes("SELL")
                                ? "1px solid rgba(239, 68, 68, 0.3)"
                                : "1px solid rgba(148, 163, 184, 0.3)",
                borderRadius: "16px",
                padding: "1.2rem",
                minWidth: "220px",
                position: "relative",
                transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                boxShadow: isLatest ? "0 10px 30px -10px rgba(212, 175, 55, 0.15)" : "none",
                transform: isLatest ? "scale(1.02)" : "scale(1)",
                zIndex: isLatest ? 2 : 1
            }}
        >
            {/* Time Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
                <div>
                    <h4 style={{ color: isPopulated ? "#f8fafc" : "#475569", margin: 0, fontSize: "0.85rem", fontWeight: 700 }}>
                        {panel.label}
                    </h4>
                    <span style={{ fontSize: "0.7rem", color: "#64748b", fontWeight: 600 }}>
                        {panel.time} IST
                    </span>
                </div>
                {isLatest && (
                    <div style={{ background: "#d4af37", color: "#000", fontSize: "0.55rem", fontWeight: 900, padding: "2px 6px", borderRadius: "4px", textTransform: "uppercase" }}>
                        Latest
                    </div>
                )}
            </div>

            {isPopulated ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.8rem" }}>
                    <SignalValue signal={panel.data!.scalp_signal} />

                    <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: "0.6rem" }}>
                        <StatItem label="Price" value={`₹${panel.data!.spot_price.toLocaleString("en-IN")}`} color="#e2e8f0" />
                        <StatItem label="Trend" value={panel.data!.trend_direction} />
                        <StatItem label="Execute" value={panel.data!.execute ? "YES" : "NO"} color={panel.data!.execute ? "#4ade80" : "#f87171"} />
                    </div>

                    {panel.data!.option_strike && (
                        <div style={{
                            marginTop: "0.2rem",
                            background: "rgba(212, 175, 55, 0.05)",
                            padding: "6px 10px",
                            borderRadius: "8px",
                            fontSize: "0.68rem",
                            color: "#d4af37",
                            fontWeight: 600,
                            border: "1px solid rgba(212, 175, 55, 0.1)"
                        }}>
                            🎯 {panel.data!.option_strike.option_type} {panel.data!.option_strike.strike}
                        </div>
                    )}
                </div>
            ) : (
                <div style={{
                    height: "120px",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: 0.5
                }}>
                    <div style={{
                        fontSize: "1.5rem",
                        marginBottom: "0.5rem",
                        animation: isPending ? "pulse 2s infinite" : "none"
                    }}>
                        {isPending ? "⏳" : "📭"}
                    </div>
                    <p style={{ color: "#64748b", fontSize: "0.65rem", textAlign: "center", margin: 0, textTransform: "uppercase", fontWeight: 700 }}>
                        {isPending ? "Waiting..." : "No Data"}
                    </p>
                </div>
            )}
        </div>
    );
}

export default function CheckpointBoard() {
    const [panels, setPanels] = useState<Panel[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchPanels = useCallback(async () => {
        try {
            // Hardcoded to FIXED_SYMBOL (^NSEI) regardless of dashboard state
            const res = await fetch(`${API_URL}/api/v1/checkpoints?symbol=${encodeURIComponent(FIXED_SYMBOL)}`);
            if (!res.ok) return;
            const json = await res.json();
            setPanels(json.panels || []);
        } catch (err) {
            console.error("Failed to fetch checkpoints:", err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchPanels();
        const interval = setInterval(fetchPanels, 30000); // 30s refresh
        return () => clearInterval(interval);
    }, [fetchPanels]);

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
                <span style={{ fontSize: "0.6rem", color: "#475569", fontWeight: 700 }}>CAPTURING 7 STRATEGIC POINTS</span>
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
