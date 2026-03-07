"use client";

import { useState, useEffect, useCallback } from "react";

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

const BIAS_CONFIG = {
    BULLISH: { label: "BULLISH", color: "#22c55e", bg: "rgba(34,197,94,0.10)", border: "rgba(34,197,94,0.3)" },
    BEARISH: { label: "BEARISH", color: "#ef4444", bg: "rgba(239,68,68,0.10)", border: "rgba(239,68,68,0.3)" },
    WAIT: { label: "WAIT", color: "#f59e0b", bg: "rgba(245,158,11,0.10)", border: "rgba(245,158,11,0.3)" },
};

const QUALITY_CONFIG = {
    HIGH: { color: "#22c55e", pct: 90, label: "HIGH" },
    MEDIUM: { color: "#f59e0b", pct: 55, label: "MEDIUM" },
    RISKY: { color: "#ef4444", pct: 25, label: "RISKY" },
};

const STRENGTH_COLORS: Record<string, string> = {
    HIGH: "#22c55e",
    MEDIUM: "#f59e0b",
    LOW: "#94a3b8",
};

export default function AIDecision({ symbol }: { symbol: string }) {
    const [data, setData] = useState<AIData | null>(null);
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
            const json: AIData = await res.json();
            setData(json);
            setCountdown(300);
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : "Failed to load AI analysis");
        } finally {
            setIsLoading(false);
        }
    }, [symbol]);

    useEffect(() => {
        fetchDecision();
    }, [fetchDecision]);

    useEffect(() => {
        const tick = setInterval(() => {
            setCountdown((c) => {
                if (c <= 1) {
                    fetchDecision();
                    return 300;
                }
                return c - 1;
            });
        }, 1000);
        return () => clearInterval(tick);
    }, [fetchDecision]);

    const mins = Math.floor(countdown / 60);
    const secs = String(countdown % 60).padStart(2, "0");
    const isEOD = data?.analysis_type === "EOD";

    return (
        <div
            style={{
                background: "rgba(15,23,42,0.82)",
                border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: "20px",
                padding: "1.3rem",
                backdropFilter: "blur(12px)",
            }}
        >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.8rem", gap: "0.8rem", flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.55rem", flexWrap: "wrap" }}>
                    <span style={{ fontSize: "0.66rem", fontWeight: 800, color: isEOD ? "#fb923c" : "#818cf8", textTransform: "uppercase", letterSpacing: "0.16em" }}>
                        {isEOD ? "Next Day Outlook" : "AI Price Action Analysis"}
                    </span>
                    <span
                        style={{
                            fontSize: "0.56rem",
                            padding: "3px 8px",
                            borderRadius: "6px",
                            background: isEOD ? "rgba(251,146,60,0.1)" : "rgba(99,102,241,0.1)",
                            border: `1px solid ${isEOD ? "rgba(251,146,60,0.24)" : "rgba(99,102,241,0.24)"}`,
                            color: isEOD ? "#fb923c" : "#818cf8",
                            fontWeight: 700,
                            letterSpacing: "0.08em",
                        }}
                    >
                        {isEOD ? `Based on ${(data as EODData)?.session_date || "last session"}` : "Gemini | News Context"}
                    </span>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                    <span style={{ fontSize: "0.58rem", color: "#64748b", fontWeight: 600 }}>Next refresh: {mins}:{secs}</span>
                    <button
                        onClick={fetchDecision}
                        disabled={isLoading}
                        style={{
                            fontSize: "0.62rem",
                            padding: "5px 11px",
                            borderRadius: "8px",
                            background: "rgba(99,102,241,0.12)",
                            border: "1px solid rgba(99,102,241,0.24)",
                            color: "#818cf8",
                            cursor: "pointer",
                            fontWeight: 700,
                        }}
                    >
                        {isLoading ? "Loading..." : "Refresh"}
                    </button>
                </div>
            </div>

            {!isEOD && (
                <div style={{ marginBottom: "0.9rem", padding: "0.65rem 0.8rem", borderRadius: "10px", background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.18)", fontSize: "0.68rem", color: "#93c5fd", lineHeight: 1.5 }}>
                    News impact can include global macro/geopolitical context. Treat this as decision support and verify critical headlines separately.
                </div>
            )}

            {isLoading && !data && (
                <div style={{ textAlign: "center", padding: "1.8rem", color: "#64748b", fontSize: "0.82rem", fontWeight: 600 }}>
                    {isEOD ? "Building next-day outlook..." : "Analyzing price action + macro news context..."}
                </div>
            )}

            {error && !data && (
                <div style={{ padding: "1rem", borderRadius: "12px", background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)", color: "#ef4444", fontSize: "0.75rem" }}>
                    {error}
                </div>
            )}

            {data && !isEOD && <IntradayView data={data as IntradayData} showReasoning={showReasoning} onToggleReasoning={() => setShowReasoning((v) => !v)} />}
            {data && isEOD && <EODView data={data as EODData} showReasoning={showReasoning} onToggleReasoning={() => setShowReasoning((v) => !v)} />}
        </div>
    );
}

function IntradayView({ data, showReasoning, onToggleReasoning }: { data: IntradayData; showReasoning: boolean; onToggleReasoning: () => void }) {
    const bias = BIAS_CONFIG[data.decision] ?? BIAS_CONFIG.WAIT;
    const quality = QUALITY_CONFIG[data.trade_quality] ?? QUALITY_CONFIG.RISKY;

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
            <SectionTitle step="1" title="Decision Summary" />
            <SectionCard>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.8rem", alignItems: "stretch" }}>
                    <BiasBadge label={bias.label} color={bias.color} bg={bias.bg} border={bias.border} strength={data.bias_strength} />
                    <div style={{ flex: 1, minWidth: "220px", display: "grid", gap: "0.5rem" }}>
                        <KV label="Market structure" value={data.market_structure} />
                        <KV label="Stop-loss hunt" value={data.sl_hunt_detected ? `Detected: ${data.sl_hunt_detail || "Yes"}` : "Not detected"} valueColor={data.sl_hunt_detected ? "#f59e0b" : "#94a3b8"} />
                        <KV label="Breakout" value={`${data.breakout_type}${data.breakout_detail ? `: ${data.breakout_detail}` : ""}`} valueColor={data.breakout_type === "REAL" ? "#22c55e" : data.breakout_type === "FAKE" ? "#ef4444" : "#94a3b8"} />
                    </div>
                </div>
            </SectionCard>

            {(data.entry_zone || data.stop_loss || data.target) && (
                <>
                    <SectionTitle step="2" title="Entry and Risk Levels" />
                    <SectionCard>
                        <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
                            <PriceTile label="Entry zone" value={data.entry_zone} color="#22c55e" />
                            <PriceTile label="Stop loss" value={data.stop_loss} color="#ef4444" />
                            <PriceTile label="Target" value={data.target} color="#6366f1" />
                        </div>
                    </SectionCard>
                </>
            )}

            <SectionTitle step="3" title="Risk Check" />
            <SectionCard>
                <KV label="Missing confirmation" value={data.missing_confirmation} valueColor="#cbd5e1" />
            </SectionCard>

            {(data.news_items?.length > 0 || data.news_impact) && (
                <>
                    <SectionTitle step="4" title="News Context" />
                    <NewsPanel title="Market news and impact" items={data.news_items} impact={data.news_impact} />
                </>
            )}

            <SectionTitle step="5" title="Detailed Reasoning" />
            <ReasoningPanel label="View full reasoning" text={data.reasoning} show={showReasoning} onToggle={onToggleReasoning} />

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.6rem" }}>
                <QualityBar cfg={quality} />
                <span style={{ fontSize: "0.58rem", color: "#475569" }}>Updated: {fmtTime(data.captured_at)} IST</span>
            </div>
        </div>
    );
}

function EODView({ data, showReasoning, onToggleReasoning }: { data: EODData; showReasoning: boolean; onToggleReasoning: () => void }) {
    const bias = BIAS_CONFIG[data.next_day_bias] ?? BIAS_CONFIG.WAIT;

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
            <SectionTitle step="1" title="Session Summary and Bias" />
            <SectionCard>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.8rem" }}>
                    <BiasBadge label={`${bias.label} TOMORROW`} color={bias.color} bg={bias.bg} border={bias.border} strength={data.bias_strength} />
                    <div style={{ flex: 1, minWidth: "220px", display: "grid", gap: "0.5rem" }}>
                        <KV label="Today's session" value={data.session_type} />
                        <KV label="Close position" value={data.close_position} valueColor={data.close_position.includes("Top") ? "#22c55e" : data.close_position.includes("Bottom") ? "#ef4444" : "#f59e0b"} />
                        <KV label="SL hunt risk tomorrow" value={data.sl_hunt_risk} valueColor="#f59e0b" />
                    </div>
                </div>
            </SectionCard>

            {(data.key_resistance.length > 0 || data.key_support.length > 0) && (
                <>
                    <SectionTitle step="2" title="Key Levels for Tomorrow" />
                    <SectionCard>
                        <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
                            <LevelTile label="Resistance" levels={data.key_resistance} color="#ef4444" />
                            <LevelTile label="Support" levels={data.key_support} color="#22c55e" />
                        </div>
                    </SectionCard>
                </>
            )}

            {(data.next_day_entry_zone || data.next_day_stop_loss || data.next_day_target) && (
                <>
                    <SectionTitle step="3" title="Tomorrow's Trade Plan" />
                    <SectionCard>
                        <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
                            <PriceTile label="Entry zone" value={data.next_day_entry_zone} color="#22c55e" />
                            <PriceTile label="Stop loss" value={data.next_day_stop_loss} color="#ef4444" />
                            <PriceTile label="Target" value={data.next_day_target} color="#6366f1" />
                        </div>
                    </SectionCard>
                </>
            )}

            {data.alert_levels.length > 0 && (
                <>
                    <SectionTitle step="4" title="Pre-Market Alert Levels" />
                    <NewsPanel title="Alert levels" items={data.alert_levels.map((a) => `Watch: ${a}`)} impact={null} accentColor="#fb923c" />
                </>
            )}

            {data.news_tomorrow.length > 0 && (
                <>
                    <SectionTitle step="5" title="Events and News Tomorrow" />
                    <NewsPanel title="Events to monitor" items={data.news_tomorrow} impact={null} accentColor="#818cf8" />
                </>
            )}

            <SectionTitle step="6" title="Detailed Reasoning" />
            <ReasoningPanel label="View full EOD reasoning" text={data.reasoning} show={showReasoning} onToggle={onToggleReasoning} />

            <span style={{ fontSize: "0.58rem", color: "#475569", textAlign: "right" }}>EOD based on {data.session_date} | Updated: {fmtTime(data.captured_at)} IST</span>
        </div>
    );
}

function SectionTitle({ step, title }: { step: string; title: string }) {
    return <p style={{ fontSize: "0.64rem", fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.14em" }}>{step}. {title}</p>;
}

function SectionCard({ children }: { children: React.ReactNode }) {
    return <div style={{ padding: "0.82rem", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.02)" }}>{children}</div>;
}

function BiasBadge({ label, color, bg, border, strength }: { label: string; color: string; bg: string; border: string; strength: string }) {
    return (
        <div style={{ minWidth: "150px", borderRadius: "12px", border: `1px solid ${border}`, background: bg, padding: "0.8rem", textAlign: "center" }}>
            <div style={{ fontSize: "1.02rem", fontWeight: 900, color }}>{label}</div>
            <div style={{ marginTop: "0.25rem", fontSize: "0.62rem", fontWeight: 700, color: STRENGTH_COLORS[strength], letterSpacing: "0.08em" }}>{strength} CONFIDENCE</div>
        </div>
    );
}

function KV({ label, value, valueColor = "#e2e8f0" }: { label: string; value: string; valueColor?: string }) {
    return (
        <div>
            <div style={{ fontSize: "0.58rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: "0.12rem" }}>{label}</div>
            <div style={{ fontSize: "0.78rem", fontWeight: 600, color: valueColor, lineHeight: 1.45 }}>{value}</div>
        </div>
    );
}

function PriceTile({ label, value, color }: { label: string; value: string | null; color: string }) {
    if (!value) return null;
    return (
        <div style={{ flex: 1, minWidth: "140px", padding: "0.7rem", borderRadius: "10px", background: `${color}0d`, border: `1px solid ${color}33`, textAlign: "center" }}>
            <div style={{ fontSize: "0.56rem", fontWeight: 800, color: `${color}cc`, textTransform: "uppercase", letterSpacing: "0.12em" }}>{label}</div>
            <div style={{ marginTop: "0.2rem", fontSize: "0.95rem", fontWeight: 900, color, fontFamily: "monospace" }}>Rs {value}</div>
        </div>
    );
}

function LevelTile({ label, levels, color }: { label: string; levels: string[]; color: string }) {
    if (!levels.length) return null;
    return (
        <div style={{ flex: 1, minWidth: "180px", padding: "0.8rem", borderRadius: "10px", background: `${color}0d`, border: `1px solid ${color}33` }}>
            <div style={{ fontSize: "0.56rem", fontWeight: 800, color: `${color}cc`, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: "0.35rem" }}>{label}</div>
            {levels.map((l, i) => (
                <div key={i} style={{ fontSize: "0.82rem", fontWeight: 700, color, fontFamily: "monospace", lineHeight: 1.5 }}>Rs {l}</div>
            ))}
        </div>
    );
}

function NewsPanel({ title, items, impact, accentColor = "#f59e0b" }: { title: string; items: string[]; impact: string | null; accentColor?: string }) {
    return (
        <SectionCard>
            <div style={{ fontSize: "0.6rem", fontWeight: 800, color: accentColor, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: "0.5rem" }}>{title}</div>
            {items.map((item, i) => (
                <div key={i} style={{ fontSize: "0.78rem", color: "#cbd5e1", lineHeight: 1.5, marginBottom: "0.3rem" }}>- {item}</div>
            ))}
            {impact && <div style={{ marginTop: "0.45rem", fontSize: "0.74rem", color: "#94a3b8", fontStyle: "italic", lineHeight: 1.5 }}>Impact: {impact}</div>}
        </SectionCard>
    );
}

function ReasoningPanel({ label, text, show, onToggle }: { label: string; text: string; show: boolean; onToggle: () => void }) {
    return (
        <div style={{ borderRadius: "12px", border: "1px solid rgba(255,255,255,0.07)", overflow: "hidden" }}>
            <button
                onClick={onToggle}
                style={{ width: "100%", padding: "0.7rem 0.9rem", background: "rgba(255,255,255,0.02)", border: "none", color: "#94a3b8", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
            >
                <span style={{ fontSize: "0.58rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.12em" }}>{label}</span>
                <span style={{ fontSize: "0.72rem" }}>{show ? "-" : "+"}</span>
            </button>
            {show && (
                <div style={{ padding: "0.8rem 0.9rem", borderTop: "1px solid rgba(255,255,255,0.07)" }}>
                    <p style={{ fontSize: "0.78rem", color: "#cbd5e1", lineHeight: 1.6 }}>{text}</p>
                </div>
            )}
        </div>
    );
}

function QualityBar({ cfg }: { cfg: { color: string; pct: number; label: string } }) {
    return (
        <div style={{ display: "flex", alignItems: "center", gap: "0.55rem" }}>
            <span style={{ fontSize: "0.58rem", color: "#64748b", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em" }}>Trade quality</span>
            <div style={{ width: "92px", height: "6px", borderRadius: "4px", background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
                <div style={{ width: `${cfg.pct}%`, height: "100%", background: cfg.color }} />
            </div>
            <span style={{ fontSize: "0.62rem", fontWeight: 800, color: cfg.color, letterSpacing: "0.06em" }}>{cfg.label}</span>
        </div>
    );
}

function fmtTime(iso: string): string {
    if (!iso) return "-";
    try {
        return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
    } catch {
        return "-";
    }
}
