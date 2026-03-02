"use client";

import { useState, useEffect, useCallback } from "react";

// ── Types ──────────────────────────────────────────────────────────────────

interface IntradayData {
    analysis_type?: undefined | "INTRADAY";
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

interface EODData {
    analysis_type: "EOD";
    session_type: string;
    close_position: string;
    next_day_bias: "BULLISH" | "BEARISH" | "WAIT";
    bias_strength: "HIGH" | "MEDIUM" | "LOW";
    key_resistance: string[];
    key_support: string[];
    sl_hunt_risk: string;
    next_day_entry_zone: string | null;
    next_day_stop_loss: string | null;
    next_day_target: string | null;
    alert_levels: string[];
    news_tomorrow: string[];
    reasoning: string;
    captured_at: string;
    session_date: string;
    symbol: string;
}

type AIData = IntradayData | EODData;

// ── Config ────────────────────────────────────────────────────────────────

const BIAS_CONFIG = {
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

// ── Main Component ────────────────────────────────────────────────────────

export default function AIDecision({ symbol }: { symbol: string }) {
    const [data, setData] = useState<AIData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showReasoning, setShowReasoning] = useState(false);
    const [countdown, setCountdown] = useState(2700);

    const fetchDecision = useCallback(async () => {
        try {
            setIsLoading(true);
            setError(null);
            const res = await fetch(`/api/v1/ai-decision?symbol=${encodeURIComponent(symbol)}`);
            if (!res.ok) throw new Error(`API error ${res.status}`);
            const json: AIData = await res.json();
            setData(json);
            setCountdown(300);
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : "Failed to load AI analysis");
        } finally {
            setIsLoading(false);
        }
    }, [symbol]);

    useEffect(() => { fetchDecision(); }, [fetchDecision]);

    // 5-min auto-refresh
    useEffect(() => {
        const tick = setInterval(() => {
            setCountdown(c => {
                if (c <= 1) { fetchDecision(); return 2700; }
                return c - 1;
            });
        }, 1000);
        return () => clearInterval(tick);
    }, [fetchDecision]);

    const mins = Math.floor(countdown / 60);
    const secs = String(countdown % 60).padStart(2, "0");
    const isEOD = data?.analysis_type === "EOD";

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
                        fontSize: "0.6rem", fontWeight: 800,
                        color: isEOD ? "rgba(251,146,60,0.9)" : "rgba(99,102,241,0.7)",
                        textTransform: "uppercase", letterSpacing: "0.2em"
                    }}>
                        {isEOD ? "🌙 Next Day Outlook" : "🤖 AI Price Action Analysis"}
                    </span>
                    <span style={{
                        fontSize: "0.5rem", padding: "2px 7px", borderRadius: "6px",
                        background: isEOD ? "rgba(251,146,60,0.1)" : "rgba(99,102,241,0.1)",
                        border: `1px solid ${isEOD ? "rgba(251,146,60,0.2)" : "rgba(99,102,241,0.2)"}`,
                        color: isEOD ? "#fb923c" : "#818cf8", fontWeight: 700, letterSpacing: "0.1em"
                    }}>
                        {isEOD ? `Based on ${(data as EODData)?.session_date || "last session"}` : "Gemini · Google Search"}
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
                    <p style={{ fontSize: "0.75rem", fontWeight: 600 }}>
                        {isEOD ? "Building next-day outlook…" : "Analyzing price action + live news…"}
                    </p>
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

            {/* ── Intraday Mode ── */}
            {data && !isEOD && <IntradayView data={data as IntradayData} showReasoning={showReasoning} onToggleReasoning={() => setShowReasoning(r => !r)} />}

            {/* ── EOD Mode ── */}
            {data && isEOD && <EODView data={data as EODData} showReasoning={showReasoning} onToggleReasoning={() => setShowReasoning(r => !r)} />}
        </div>
    );
}

// ── Intraday View ──────────────────────────────────────────────────────────

function IntradayView({ data, showReasoning, onToggleReasoning }: {
    data: IntradayData; showReasoning: boolean; onToggleReasoning: () => void;
}) {
    const cfg = BIAS_CONFIG[data.decision] ?? BIAS_CONFIG.WAIT;
    const qCfg = QUALITY_CONFIG[data.trade_quality] ?? QUALITY_CONFIG.RISKY;

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {/* Badge + Structure */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem", alignItems: "flex-start" }}>
                <DecisionBadge emoji={cfg.emoji} label={cfg.label} color={cfg.color} bg={cfg.bg} border={cfg.border}
                    strength={data.bias_strength} />
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "0.5rem", minWidth: "180px" }}>
                    <InfoRow label="Market Structure" value={data.market_structure} />
                    <InfoRow label="Stop-Loss Hunt"
                        value={data.sl_hunt_detected ? `✅ Detected — ${data.sl_hunt_detail || ""}` : "❌ Not detected"}
                        valueColor={data.sl_hunt_detected ? "#f59e0b" : "#64748b"} />
                    <InfoRow label="Breakout"
                        value={`${data.breakout_type}${data.breakout_detail ? ` — ${data.breakout_detail}` : ""}`}
                        valueColor={data.breakout_type === "REAL" ? "#22c55e" : data.breakout_type === "FAKE" ? "#ef4444" : "#64748b"} />
                </div>
            </div>

            {/* Entry / SL / Target */}
            {(data.entry_zone || data.stop_loss || data.target) && (
                <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
                    <PriceBox label="ENTRY ZONE" value={data.entry_zone} color="#22c55e" />
                    <PriceBox label="STOP LOSS" value={data.stop_loss} color="#ef4444" />
                    <PriceBox label="TARGET" value={data.target} color="#6366f1" />
                </div>
            )}

            {/* News */}
            {(data.news_items?.length > 0 || data.news_impact) && (
                <NewsBlock title="📰 Live Market News & Impact" items={data.news_items} impact={data.news_impact} />
            )}

            {/* Missing Confirmation */}
            <div style={{
                padding: "0.8rem 1rem", borderRadius: "12px",
                background: "rgba(99,102,241,0.05)", border: "1px solid rgba(99,102,241,0.15)",
                display: "flex", alignItems: "flex-start", gap: "0.6rem",
            }}>
                <span style={{ fontSize: "0.9rem" }}>⚠️</span>
                <div>
                    <p style={{ fontSize: "0.52rem", fontWeight: 800, color: "#818cf8", textTransform: "uppercase", letterSpacing: "0.2em", marginBottom: "0.2rem" }}>
                        Missing Confirmation
                    </p>
                    <p style={{ fontSize: "0.7rem", color: "#cbd5e1" }}>{data.missing_confirmation}</p>
                </div>
            </div>

            <ReasoningBlock label="🔍 Full Price Action Reasoning" text={data.reasoning} show={showReasoning} onToggle={onToggleReasoning} />

            {/* Footer */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
                <QualityBar cfg={qCfg} />
                <span style={{ fontSize: "0.5rem", color: "#334155" }}>
                    Updated: {fmtTime(data.captured_at)} IST · Powered by Gemini
                </span>
            </div>
        </div>
    );
}

// ── EOD View ───────────────────────────────────────────────────────────────

function EODView({ data, showReasoning, onToggleReasoning }: {
    data: EODData; showReasoning: boolean; onToggleReasoning: () => void;
}) {
    const cfg = BIAS_CONFIG[data.next_day_bias] ?? BIAS_CONFIG.WAIT;

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {/* Badge + Session Summary */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem", alignItems: "flex-start" }}>
                <DecisionBadge emoji={cfg.emoji} label={`${cfg.label} TOMORROW`} color={cfg.color} bg={cfg.bg}
                    border={cfg.border} strength={data.bias_strength} subLabel="NEXT DAY BIAS" />
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "0.5rem", minWidth: "180px" }}>
                    <InfoRow label="Today's Session" value={data.session_type} />
                    <InfoRow label="Close Position" value={data.close_position}
                        valueColor={data.close_position.includes("Top") ? "#22c55e" : data.close_position.includes("Bottom") ? "#ef4444" : "#f59e0b"} />
                    <InfoRow label="SL Hunt Risk Tomorrow" value={data.sl_hunt_risk} valueColor="#f59e0b" />
                </div>
            </div>

            {/* Key Levels */}
            {(data.key_resistance.length > 0 || data.key_support.length > 0) && (
                <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
                    <LevelBox label="🔴 Resistance Tomorrow" levels={data.key_resistance} color="#ef4444" />
                    <LevelBox label="🟢 Support Tomorrow" levels={data.key_support} color="#22c55e" />
                </div>
            )}

            {/* Tomorrow Trade Plan */}
            {(data.next_day_entry_zone || data.next_day_stop_loss || data.next_day_target) && (
                <div>
                    <p style={{ fontSize: "0.52rem", fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: "0.5rem" }}>
                        📋 Tomorrow&apos;s Trade Plan
                    </p>
                    <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
                        <PriceBox label="ENTRY ZONE" value={data.next_day_entry_zone} color="#22c55e" />
                        <PriceBox label="STOP LOSS" value={data.next_day_stop_loss} color="#ef4444" />
                        <PriceBox label="TARGET" value={data.next_day_target} color="#6366f1" />
                    </div>
                </div>
            )}

            {/* Alert Levels */}
            {data.alert_levels.length > 0 && (
                <div style={{
                    padding: "0.9rem 1rem", borderRadius: "12px",
                    background: "rgba(251,146,60,0.05)", border: "1px solid rgba(251,146,60,0.15)",
                }}>
                    <p style={{ fontSize: "0.55rem", fontWeight: 800, color: "#fb923c", textTransform: "uppercase", letterSpacing: "0.2em", marginBottom: "0.5rem" }}>
                        🔔 Pre-Market Alert Levels
                    </p>
                    {data.alert_levels.map((a, i) => (
                        <p key={i} style={{ fontSize: "0.7rem", color: "#cbd5e1", marginBottom: "0.2rem", paddingLeft: "0.6rem", borderLeft: "2px solid rgba(251,146,60,0.3)" }}>
                            → {a}
                        </p>
                    ))}
                </div>
            )}

            {/* News Tomorrow */}
            {data.news_tomorrow.length > 0 && (
                <NewsBlock title="📅 Events & News Tomorrow" items={data.news_tomorrow} impact={null} accentColor="#818cf8" />
            )}

            <ReasoningBlock label="🔍 Full EOD Reasoning" text={data.reasoning} show={showReasoning} onToggle={onToggleReasoning} />

            {/* Footer */}
            <span style={{ fontSize: "0.5rem", color: "#334155", textAlign: "right" }}>
                EOD Analysis based on {data.session_date} · Updated: {fmtTime(data.captured_at)} IST · Powered by Gemini
            </span>
        </div>
    );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function DecisionBadge({ emoji, label, color, bg, border, strength, subLabel = "CONFIDENCE" }: {
    emoji: string; label: string; color: string; bg: string; border: string;
    strength: string; subLabel?: string;
}) {
    return (
        <div style={{
            padding: "1rem 1.4rem", borderRadius: "16px", background: bg, border: `2px solid ${border}`,
            textAlign: "center", minWidth: "130px", boxShadow: `0 0 24px ${bg}`,
        }}>
            <div style={{ fontSize: "2rem", lineHeight: 1 }}>{emoji}</div>
            <div style={{ fontSize: "0.9rem", fontWeight: 900, color, letterSpacing: "0.05em", marginTop: "0.3rem" }}>
                {label}
            </div>
            <div style={{ fontSize: "0.5rem", fontWeight: 800, marginTop: "0.2rem", color: STRENGTH_COLORS[strength], letterSpacing: "0.15em" }}>
                {strength} {subLabel}
            </div>
        </div>
    );
}

function InfoRow({ label, value, valueColor = "#e2e8f0" }: { label: string; value: string; valueColor?: string; }) {
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "1px", padding: "0.4rem 0.6rem", borderRadius: "8px", background: "rgba(255,255,255,0.02)" }}>
            <span style={{ fontSize: "0.5rem", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.15em" }}>{label}</span>
            <span style={{ fontSize: "0.68rem", fontWeight: 600, color: valueColor }}>{value}</span>
        </div>
    );
}

function PriceBox({ label, value, color }: { label: string; value: string | null; color: string }) {
    if (!value) return null;
    return (
        <div style={{ flex: 1, minWidth: "100px", padding: "0.6rem 0.8rem", borderRadius: "12px", background: `${color}0d`, border: `1px solid ${color}33`, textAlign: "center" }}>
            <p style={{ fontSize: "0.5rem", fontWeight: 800, color: `${color}cc`, textTransform: "uppercase", letterSpacing: "0.2em", marginBottom: "0.3rem" }}>{label}</p>
            <p style={{ fontSize: "0.85rem", fontWeight: 900, color, fontFamily: "monospace" }}>₹{value}</p>
        </div>
    );
}

function LevelBox({ label, levels, color }: { label: string; levels: string[]; color: string }) {
    if (!levels.length) return null;
    return (
        <div style={{ flex: 1, minWidth: "140px", padding: "0.7rem 1rem", borderRadius: "12px", background: `${color}0d`, border: `1px solid ${color}33` }}>
            <p style={{ fontSize: "0.5rem", fontWeight: 800, color: `${color}cc`, textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: "0.4rem" }}>{label}</p>
            {levels.map((l, i) => (
                <p key={i} style={{ fontSize: "0.75rem", fontWeight: 700, color, fontFamily: "monospace", lineHeight: 1.6 }}>₹{l}</p>
            ))}
        </div>
    );
}

function NewsBlock({ title, items, impact, accentColor = "#f59e0b" }: {
    title: string; items: string[]; impact: string | null; accentColor?: string;
}) {
    return (
        <div style={{ padding: "0.9rem 1rem", borderRadius: "12px", background: `${accentColor}08`, border: `1px solid ${accentColor}25` }}>
            <p style={{ fontSize: "0.55rem", fontWeight: 800, color: accentColor, textTransform: "uppercase", letterSpacing: "0.2em", marginBottom: "0.5rem" }}>
                {title}
            </p>
            {items.map((item, i) => (
                <p key={i} style={{ fontSize: "0.7rem", color: "#cbd5e1", marginBottom: "0.25rem", paddingLeft: "0.6rem", borderLeft: `2px solid ${accentColor}50` }}>
                    • {item}
                </p>
            ))}
            {impact && (
                <p style={{ fontSize: "0.65rem", color: "#94a3b8", marginTop: "0.5rem", fontStyle: "italic" }}>
                    → {impact}
                </p>
            )}
        </div>
    );
}

function ReasoningBlock({ label, text, show, onToggle }: {
    label: string; text: string; show: boolean; onToggle: () => void;
}) {
    return (
        <div style={{ borderRadius: "12px", border: "1px solid rgba(255,255,255,0.06)", overflow: "hidden" }}>
            <button onClick={onToggle} style={{
                width: "100%", padding: "0.7rem 1rem", background: "rgba(255,255,255,0.02)",
                border: "none", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", color: "#94a3b8"
            }}>
                <span style={{ fontSize: "0.55rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.2em" }}>{label}</span>
                <span style={{ fontSize: "0.7rem", transition: "transform 0.2s", transform: show ? "rotate(180deg)" : "none" }}>▾</span>
            </button>
            {show && (
                <div style={{ padding: "0.8rem 1rem", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                    <p style={{ fontSize: "0.72rem", color: "#cbd5e1", lineHeight: 1.7 }}>{text}</p>
                </div>
            )}
        </div>
    );
}

function QualityBar({ cfg }: { cfg: { color: string; pct: number; label: string } }) {
    return (
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <span style={{ fontSize: "0.52rem", color: "#475569", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em" }}>Trade Quality</span>
            <div style={{ width: "80px", height: "6px", borderRadius: "4px", background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
                <div style={{ width: `${cfg.pct}%`, height: "100%", background: cfg.color, borderRadius: "4px", boxShadow: `0 0 6px ${cfg.color}` }} />
            </div>
            <span style={{ fontSize: "0.55rem", fontWeight: 800, color: cfg.color, letterSpacing: "0.1em" }}>{cfg.label}</span>
        </div>
    );
}

function fmtTime(iso: string): string {
    if (!iso) return "—";
    try { return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }); }
    catch { return "—"; }
}
