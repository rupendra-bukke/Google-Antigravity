"use client";

import { useState, useEffect, useCallback } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

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

interface CheckpointBoardProps {
    symbol?: string;
}

function SignalBadge({ signal }: { signal: string }) {
    const isBuy = signal?.toLowerCase().includes("buy") || signal?.includes("🟢");
    const isSell = signal?.toLowerCase().includes("sell") || signal?.includes("🔴");
    const bg = isBuy
        ? "rgba(34,197,94,0.15)"
        : isSell
            ? "rgba(239,68,68,0.15)"
            : "rgba(148,163,184,0.1)";
    const color = isBuy ? "#22c55e" : isSell ? "#ef4444" : "#94a3b8";
    const border = isBuy
        ? "1px solid rgba(34,197,94,0.3)"
        : isSell
            ? "1px solid rgba(239,68,68,0.3)"
            : "1px solid rgba(148,163,184,0.2)";

    return (
        <span
            style={{
                background: bg,
                color,
                border,
                borderRadius: "6px",
                padding: "3px 10px",
                fontSize: "0.75rem",
                fontWeight: 700,
                letterSpacing: "0.04em",
                display: "inline-block",
            }}
        >
            {signal || "—"}
        </span>
    );
}

function ExecuteBadge({ execute }: { execute: boolean }) {
    return (
        <span
            style={{
                background: execute ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.12)",
                color: execute ? "#22c55e" : "#ef4444",
                border: execute
                    ? "1px solid rgba(34,197,94,0.35)"
                    : "1px solid rgba(239,68,68,0.3)",
                borderRadius: "6px",
                padding: "2px 10px",
                fontSize: "0.72rem",
                fontWeight: 700,
                display: "inline-block",
            }}
        >
            {execute ? "✅ EXECUTE" : "⛔ NO TRADE"}
        </span>
    );
}

function WaitingPanel({ panel }: { panel: Panel }) {
    const now = new Date();
    const [h, m] = panel.time.split(":").map(Number);
    const target = new Date();
    target.setHours(h, m, 0, 0);
    const isPast = now > target;

    return (
        <div style={{ textAlign: "center", padding: "1.5rem 0.5rem" }}>
            <div
                style={{
                    fontSize: "1.8rem",
                    marginBottom: "0.5rem",
                    opacity: 0.4,
                    animation: isPast ? "none" : "pulse 2s infinite",
                }}
            >
                {isPast ? "📭" : "⏳"}
            </div>
            <p
                style={{
                    color: "#64748b",
                    fontSize: "0.78rem",
                    fontStyle: "italic",
                    margin: 0,
                }}
            >
                {isPast ? "No data captured" : `Waiting for ${panel.time}…`}
            </p>
        </div>
    );
}

function PanelCard({ panel, index }: { panel: Panel; index: number }) {
    const isPopulated = !!panel.data;
    const d = panel.data;

    // Gradient accent per panel
    const accents = [
        "linear-gradient(135deg,#d4af37,#a07a20)",
        "linear-gradient(135deg,#3b82f6,#1d4ed8)",
        "linear-gradient(135deg,#10b981,#065f46)",
        "linear-gradient(135deg,#8b5cf6,#5b21b6)",
        "linear-gradient(135deg,#f59e0b,#b45309)",
        "linear-gradient(135deg,#ef4444,#991b1b)",
        "linear-gradient(135deg,#06b6d4,#0e7490)",
    ];

    return (
        <div
            style={{
                background: "rgba(15,23,42,0.6)",
                border: isPopulated
                    ? "1px solid rgba(212,175,55,0.25)"
                    : "1px solid rgba(255,255,255,0.06)",
                borderRadius: "14px",
                overflow: "hidden",
                backdropFilter: "blur(12px)",
                transition: "border-color 0.3s, transform 0.2s",
                minHeight: "220px",
                display: "flex",
                flexDirection: "column",
            }}
            onMouseEnter={(e) =>
                (e.currentTarget.style.transform = "translateY(-2px)")
            }
            onMouseLeave={(e) => (e.currentTarget.style.transform = "translateY(0)")}
        >
            {/* Header stripe */}
            <div
                style={{
                    background: accents[index % accents.length],
                    padding: "0.6rem 1rem",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                }}
            >
                <div>
                    <div style={{ color: "#fff", fontWeight: 700, fontSize: "0.82rem" }}>
                        {panel.label}
                    </div>
                    <div style={{ color: "rgba(255,255,255,0.7)", fontSize: "0.72rem" }}>
                        {panel.time} IST
                    </div>
                </div>
                <div
                    style={{
                        background: "rgba(0,0,0,0.25)",
                        borderRadius: "8px",
                        padding: "2px 8px",
                        color: "#fff",
                        fontSize: "0.68rem",
                        fontWeight: 600,
                        letterSpacing: "0.05em",
                    }}
                >
                    CP {index + 1}
                </div>
            </div>

            {/* Body */}
            <div style={{ padding: "0.8rem 1rem", flex: 1 }}>
                {!isPopulated ? (
                    <WaitingPanel panel={panel} />
                ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                        {/* Price + Execute */}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ color: "#d4af37", fontWeight: 700, fontSize: "1rem" }}>
                                ₹{d!.spot_price?.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                            </span>
                            <ExecuteBadge execute={d!.execute} />
                        </div>

                        {/* Scalp Signal */}
                        <div style={{ display: "flex", gap: "0.4rem", alignItems: "center", flexWrap: "wrap" }}>
                            <span style={{ color: "#64748b", fontSize: "0.7rem" }}>Signal:</span>
                            <SignalBadge signal={d!.scalp_signal} />
                        </div>

                        {/* HTF Trend */}
                        <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
                            <span style={{ color: "#64748b", fontSize: "0.7rem" }}>Trend:</span>
                            <span style={{ color: "#94a3b8", fontSize: "0.75rem" }}>{d!.trend_direction}</span>
                        </div>

                        {/* 3-min confirm */}
                        <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
                            <span style={{ color: "#64748b", fontSize: "0.7rem" }}>3-Min:</span>
                            <span style={{ color: "#94a3b8", fontSize: "0.75rem" }}>
                                {d!.three_min_confirm?.slice(0, 40) ?? "—"}
                            </span>
                        </div>

                        {/* Option Strike (compact) */}
                        {d!.option_strike && (
                            <div
                                style={{
                                    background: "rgba(212,175,55,0.08)",
                                    border: "1px solid rgba(212,175,55,0.15)",
                                    borderRadius: "6px",
                                    padding: "0.35rem 0.6rem",
                                    fontSize: "0.72rem",
                                    color: "#d4af37",
                                }}
                            >
                                {d!.option_strike.option_type} {d!.option_strike.strike} @ ₹{d!.option_strike.entry_price ?? "—"}
                            </div>
                        )}

                        {/* Execute Reason (truncated) */}
                        <p
                            style={{
                                color: "#475569",
                                fontSize: "0.68rem",
                                margin: 0,
                                lineHeight: 1.4,
                                borderTop: "1px solid rgba(255,255,255,0.05)",
                                paddingTop: "0.4rem",
                            }}
                        >
                            {d!.execute_reason?.slice(0, 80)}
                            {(d!.execute_reason?.length ?? 0) > 80 ? "…" : ""}
                        </p>

                        {/* Captured at timestamp */}
                        <p style={{ color: "#334155", fontSize: "0.62rem", margin: 0, textAlign: "right" }}>
                            {new Date(d!.captured_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })} IST
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}

export default function CheckpointBoard({ symbol = "^NSEI" }: CheckpointBoardProps) {
    const [panels, setPanels] = useState<Panel[]>([]);
    const [loading, setLoading] = useState(true);
    const [lastFetch, setLastFetch] = useState<string>("");
    const [symbolTab, setSymbolTab] = useState<"^NSEI" | "^NSEBANK">("^NSEI");

    const fetchPanels = useCallback(async (sym: string) => {
        try {
            const res = await fetch(`${API_URL}/api/v1/checkpoints?symbol=${encodeURIComponent(sym)}`);
            if (!res.ok) return;
            const json = await res.json();
            setPanels(json.panels || []);
            setLastFetch(new Date().toLocaleTimeString("en-IN"));
        } catch {
            // silently fail — doesn't block main app
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchPanels(symbolTab);
        const interval = setInterval(() => fetchPanels(symbolTab), 60_000);
        return () => clearInterval(interval);
    }, [symbolTab, fetchPanels]);

    const populatedCount = panels.filter((p) => p.data).length;

    return (
        <div style={{ marginTop: "2rem" }}>
            {/* Section Header */}
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "1.2rem",
                    flexWrap: "wrap",
                    gap: "0.75rem",
                }}
            >
                <div>
                    <h2
                        style={{
                            color: "#d4af37",
                            fontFamily: "'Playfair Display', serif",
                            fontSize: "1.4rem",
                            margin: 0,
                            fontWeight: 700,
                        }}
                    >
                        📊 Daily Checkpoint Board
                    </h2>
                    <p style={{ color: "#475569", fontSize: "0.75rem", margin: "0.15rem 0 0" }}>
                        {populatedCount} / 7 checkpoints captured today · resets at 21:00 IST
                        {lastFetch && ` · updated ${lastFetch}`}
                    </p>
                </div>

                {/* Symbol tabs */}
                <div style={{ display: "flex", gap: "0.5rem" }}>
                    {(["^NSEI", "^NSEBANK"] as const).map((sym) => (
                        <button
                            key={sym}
                            onClick={() => { setSymbolTab(sym); setLoading(true); }}
                            style={{
                                background:
                                    symbolTab === sym
                                        ? "linear-gradient(135deg,#d4af37,#a07a20)"
                                        : "rgba(255,255,255,0.05)",
                                color: symbolTab === sym ? "#0f172a" : "#94a3b8",
                                border:
                                    symbolTab === sym
                                        ? "1px solid #d4af37"
                                        : "1px solid rgba(255,255,255,0.1)",
                                borderRadius: "8px",
                                padding: "0.35rem 0.9rem",
                                fontSize: "0.75rem",
                                fontWeight: 700,
                                cursor: "pointer",
                                transition: "all 0.2s",
                            }}
                        >
                            {sym === "^NSEI" ? "Nifty 50" : "Bank Nifty"}
                        </button>
                    ))}
                    <button
                        onClick={() => fetchPanels(symbolTab)}
                        title="Refresh"
                        style={{
                            background: "rgba(255,255,255,0.05)",
                            color: "#64748b",
                            border: "1px solid rgba(255,255,255,0.1)",
                            borderRadius: "8px",
                            padding: "0.35rem 0.75rem",
                            fontSize: "0.8rem",
                            cursor: "pointer",
                        }}
                    >
                        ↻
                    </button>
                </div>
            </div>

            {/* 7 Panel Grid */}
            {loading ? (
                <div
                    style={{
                        textAlign: "center",
                        color: "#475569",
                        padding: "3rem",
                        fontSize: "0.85rem",
                    }}
                >
                    Loading checkpoint data…
                </div>
            ) : (
                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
                        gap: "1rem",
                    }}
                >
                    {panels.map((panel, i) => (
                        <PanelCard key={panel.id} panel={panel} index={i} />
                    ))}
                </div>
            )}

            <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.9; }
        }
      `}</style>
        </div>
    );
}
