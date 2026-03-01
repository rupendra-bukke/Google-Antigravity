"use client";

import { useState, useEffect, useCallback } from "react";

interface AIDecisionData {
    decision: "BULLISH" | "BEARISH" | "WAIT";
    bias_strength: "HIGH" | "MEDIUM" | "LOW";
    market_structure: string;
    sl_hunt_detected: boolean;
    sl_hunt_detail: string | null;
    breakout_type: "REAL" | "FAKE" | "NONE";
    breakout_detail: string | null;
    entry_zone: string | null;
    stop_loss: string | null;
    target: string | null;
    trade_quality: "HIGH" | "MEDIUM" | "RISKY";
    missing_confirmation: string;
    news_items: string[];
    news_impact: string;
    reasoning: string;
    captured_at: string;
    symbol: string;
}

const DECISION_CONFIG = {
    BULLISH: { emoji: "📈", label: "BULLISH", color: "#22c55e", bg: "rgba(34,197,94,0.10)", border: "rgba(34,197,94,0.3)" },
    BEARISH: { emoji: "📉", label: "BEARISH", color: "#ef4444", bg: "rgba(239,68,68,0.10)", border: "rgba(239,68,68,0.3)" },
    WAIT: { emoji: "⏳", label: "WAIT", color: "#f59e0b", bg: "rgba(245,158,11,0.10)", border: "rgba(245,158,11,0.3)" },
};

const QUALITY_CONFIG = {
    HIGH: { color: "#22c55e", pct: 90, label: "HIGH QUALITY" },
    MEDIUM: { color: "#f59e0b", pct: 55, label: "MEDIUM" },
    RISKY: { color: "#ef4444", pct: 25, label: "RISKY" },
};

const STRENGTH_COLORS: Record<string, string> = {
    HIGH: "#22c55e", MEDIUM: "#f59e0b", LOW: "#94a3b8",
};

export default function AIDecision({ symbol }: { symbol: string }) {
    const [data, setData] = useState<AIDecisionData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showReasoning, setShowReasoning] = useState(false);
    const [countdown, setCountdown] = useState(300);

    const fetchDecision = useCallback(async () => {
        try {
            setIsLoading(true);
            setError(null);
            const res = await fetch(`/api/v1/ai-decision?symbol=${encodeURIComponent(symbol)}`);
            if (!res.ok) throw new Error(`API error ${res.status}`);
            const json: AIDecisionData = await res.json();
            setData(json);
            setCountdown(300);
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : "Failed to load AI analysis");
        } finally {
            setIsLoading(false);
        }
    }, [symbol]);

    useEffect(() => { fetchDecision(); }, [fetchDecision]);

    // 5-min auto-refresh countdown
    useEffect(() => {
        const tick = setInterval(() => {
            setCountdown(c => {
                if (c <= 1) { fetchDecision(); return 300; }
                return c - 1;
            });
        }, 1000);
        return () => clearInterval(tick);
    }, [fetchDecision]);

    const cfg = data ? DECISION_CONFIG[data.decision] : DECISION_CONFIG.WAIT;
    const qCfg = data ? QUALITY_CONFIG[data.trade_quality] : QUALITY_CONFIG.RISKY;
    const mins = Math.floor(countdown / 60);
    const secs = String(countdown % 60).padStart(2, "0");

    return (
        <div style={{
            background: "rgba(15,23,42,0.8)",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: "20px",
            padding: "1.5rem",
            backdropFilter: "blur(12px)",
        }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.2rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                    <span style={{
                        fontSize: "0.6rem", fontWeight: 800, color: "rgba(99,102,241,0.7)",
                        textTransform: "uppercase", letterSpacing: "0.2em"
                    }}>
                        🤖 AI Price Action Analysis
                    </span>
                    <span style={{
                        fontSize: "0.5rem", padding: "2px 7px", borderRadius: "6px",
                        background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)",
                        color: "#818cf8", fontWeight: 700, letterSpacing: "0.1em"
                    }}>
                        Gemini · Google Search
                    </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.8rem" }}>
                    <span style={{ fontSize: "0.5rem", color: "#475569", fontWeight: 600 }}>
                        Next refresh: {mins}:{secs}
                    </span>
                    <button onClick={fetchDecision} disabled={isLoading}
                        style={{
                            fontSize: "0.6rem", padding: "4px 10px", borderRadius: "8px",
                            background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)",
                            color: "#818cf8", cursor: "pointer", fontWeight: 700
                        }}>
                        {isLoading ? "⟳ Loading…" : "↻ Refresh"}
                    </button>
                </div>
            </div>

            {/* Loading */}
            {isLoading && !data && (
                <div style={{ textAlign: "center", padding: "2rem", color: "#475569" }}>
                    <div style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>🤖</div>
                    <p style={{ fontSize: "0.75rem", fontWeight: 600 }}>Analyzing price action + live news…</p>
                </div>
            )}

            {/* Error */}
            {error && !data && (
                <div style={{
                    padding: "1rem", borderRadius: "12px", background: "rgba(239,68,68,0.05)",
                    border: "1px solid rgba(239,68,68,0.2)", color: "#ef4444", fontSize: "0.7rem"
                }}>
                    ⚠️ {error}
                </div>
            )}

            {data && (
                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>

                    {/* Row 1: Decision badge + Structure */}
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem", alignItems: "flex-start" }}>
                        {/* Decision Badge */}
                        <div style={{
                            padding: "1rem 1.4rem", borderRadius: "16px",
                            background: cfg.bg, border: `2px solid ${cfg.border}`,
                            textAlign: "center", minWidth: "130px",
                            boxShadow: `0 0 24px ${cfg.bg}`,
                        }}>
                            <div style={{ fontSize: "2rem", lineHeight: 1 }}>{cfg.emoji}</div>
                            <div style={{
                                fontSize: "1.1rem", fontWeight: 900, color: cfg.color,
                                letterSpacing: "0.05em", marginTop: "0.3rem"
                            }}>
                                {cfg.label}
                            </div>
                            <div style={{
                                fontSize: "0.55rem", fontWeight: 800, marginTop: "0.2rem",
                                color: STRENGTH_COLORS[data.bias_strength], letterSpacing: "0.15em"
                            }}>
                                {data.bias_strength} CONFIDENCE
                            </div>
                        </div>

                        {/* Structure + SL Hunt + Breakout */}
                        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "0.5rem", minWidth: "180px" }}>
                            <InfoRow label="Market Structure" value={data.market_structure} />
                            <InfoRow
                                label="Stop-Loss Hunt"
                                value={data.sl_hunt_detected ? `✅ Detected — ${data.sl_hunt_detail || ""}` : "❌ Not detected"}
                                valueColor={data.sl_hunt_detected ? "#f59e0b" : "#64748b"}
                            />
                            <InfoRow
                                label="Breakout"
                                value={`${data.breakout_type}${data.breakout_detail ? ` — ${data.breakout_detail}` : ""}`}
                                valueColor={data.breakout_type === "REAL" ? "#22c55e" : data.breakout_type === "FAKE" ? "#ef4444" : "#64748b"}
                            />
                        </div>
                    </div>

                    {/* Row 2: Entry / SL / Target */}
                    {(data.entry_zone || data.stop_loss || data.target) && (
                        <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
                            <PriceBox label="ENTRY ZONE" value={data.entry_zone} color="#22c55e" />
                            <PriceBox label="STOP LOSS" value={data.stop_loss} color="#ef4444" />
                            <PriceBox label="TARGET" value={data.target} color="#6366f1" />
                        </div>
                    )}

                    {/* Row 3: News Impact */}
                    {(data.news_items?.length > 0 || data.news_impact) && (
                        <div style={{
                            padding: "0.9rem 1rem", borderRadius: "12px",
                            background: "rgba(245,158,11,0.05)",
                            border: "1px solid rgba(245,158,11,0.15)",
                        }}>
                            <p style={{
                                fontSize: "0.55rem", fontWeight: 800, color: "#f59e0b",
                                textTransform: "uppercase", letterSpacing: "0.2em", marginBottom: "0.5rem"
                            }}>
                                📰 Live Market News & Impact
                            </p>
                            {data.news_items.map((item, i) => (
                                <p key={i} style={{
                                    fontSize: "0.7rem", color: "#cbd5e1",
                                    marginBottom: "0.25rem", paddingLeft: "0.6rem",
                                    borderLeft: "2px solid rgba(245,158,11,0.3)"
                                }}>
                                    • {item}
                                </p>
                            ))}
                            {data.news_impact && (
                                <p style={{
                                    fontSize: "0.65rem", color: "#94a3b8", marginTop: "0.5rem",
                                    fontStyle: "italic"
                                }}>
                                    → {data.news_impact}
                                </p>
                            )}
                        </div>
                    )}

                    {/* Row 4: Missing Confirmation */}
                    <div style={{
                        padding: "0.8rem 1rem", borderRadius: "12px",
                        background: "rgba(99,102,241,0.05)",
                        border: "1px solid rgba(99,102,241,0.15)",
                        display: "flex", alignItems: "flex-start", gap: "0.6rem",
                    }}>
                        <span style={{ fontSize: "0.9rem" }}>⚠️</span>
                        <div>
                            <p style={{
                                fontSize: "0.52rem", fontWeight: 800, color: "#818cf8",
                                textTransform: "uppercase", letterSpacing: "0.2em", marginBottom: "0.2rem"
                            }}>
                                Missing Confirmation
                            </p>
                            <p style={{ fontSize: "0.7rem", color: "#cbd5e1" }}>{data.missing_confirmation}</p>
                        </div>
                    </div>

                    {/* Row 5: Reasoning (expandable) */}
                    <div style={{
                        borderRadius: "12px", border: "1px solid rgba(255,255,255,0.06)",
                        overflow: "hidden"
                    }}>
                        <button
                            onClick={() => setShowReasoning(r => !r)}
                            style={{
                                width: "100%", padding: "0.7rem 1rem", background: "rgba(255,255,255,0.02)",
                                border: "none", display: "flex", alignItems: "center", justifyContent: "space-between",
                                cursor: "pointer", color: "#94a3b8"
                            }}>
                            <span style={{
                                fontSize: "0.55rem", fontWeight: 800, textTransform: "uppercase",
                                letterSpacing: "0.2em"
                            }}>
                                🔍 Full Price Action Reasoning
                            </span>
                            <span style={{
                                fontSize: "0.7rem", transition: "transform 0.2s",
                                transform: showReasoning ? "rotate(180deg)" : "none"
                            }}>▾</span>
                        </button>
                        {showReasoning && (
                            <div style={{ padding: "0.8rem 1rem", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                                <p style={{ fontSize: "0.72rem", color: "#cbd5e1", lineHeight: 1.7 }}>
                                    {data.reasoning}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Row 6: Trade Quality bar + timestamp */}
                    <div style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        flexWrap: "wrap", gap: "0.5rem"
                    }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                            <span style={{
                                fontSize: "0.52rem", color: "#475569", fontWeight: 700,
                                textTransform: "uppercase", letterSpacing: "0.15em"
                            }}>Trade Quality</span>
                            <div style={{
                                width: "80px", height: "6px", borderRadius: "4px",
                                background: "rgba(255,255,255,0.08)", overflow: "hidden"
                            }}>
                                <div style={{
                                    width: `${qCfg.pct}%`, height: "100%",
                                    background: qCfg.color, borderRadius: "4px",
                                    boxShadow: `0 0 6px ${qCfg.color}`
                                }} />
                            </div>
                            <span style={{
                                fontSize: "0.55rem", fontWeight: 800, color: qCfg.color,
                                letterSpacing: "0.1em"
                            }}>{qCfg.label}</span>
                        </div>
                        <span style={{ fontSize: "0.5rem", color: "#334155" }}>
                            Updated: {data.captured_at ? new Date(data.captured_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "—"} IST · Powered by Gemini
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
}

// ── Sub-components ────────────────────────────────────────────────────────

function InfoRow({ label, value, valueColor = "#e2e8f0" }: {
    label: string; value: string; valueColor?: string;
}) {
    return (
        <div style={{
            display: "flex", flexDirection: "column", gap: "1px",
            padding: "0.4rem 0.6rem", borderRadius: "8px", background: "rgba(255,255,255,0.02)"
        }}>
            <span style={{
                fontSize: "0.5rem", fontWeight: 700, color: "#475569",
                textTransform: "uppercase", letterSpacing: "0.15em"
            }}>{label}</span>
            <span style={{ fontSize: "0.68rem", fontWeight: 600, color: valueColor }}>{value}</span>
        </div>
    );
}

function PriceBox({ label, value, color }: { label: string; value: string | null; color: string }) {
    if (!value) return null;
    return (
        <div style={{
            flex: 1, minWidth: "100px", padding: "0.6rem 0.8rem", borderRadius: "12px",
            background: `${color}0d`, border: `1px solid ${color}33`, textAlign: "center"
        }}>
            <p style={{
                fontSize: "0.5rem", fontWeight: 800, color: `${color}cc`,
                textTransform: "uppercase", letterSpacing: "0.2em", marginBottom: "0.3rem"
            }}>{label}</p>
            <p style={{ fontSize: "0.85rem", fontWeight: 900, color, fontFamily: "monospace" }}>
                ₹{value}
            </p>
        </div>
    );
}
