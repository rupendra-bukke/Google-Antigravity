"use client";

import { useState, useEffect, useCallback } from "react";

type AnalysisStatus = "full" | "repaired" | "fallback";

interface IntradayData {
    analysis_type?: undefined | "INTRADAY";
    analysis_status?: AnalysisStatus;
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
    checkpoint_mode?: boolean;
    snapshot_mode?: boolean;
    snapshot_label?: string | null;
    snapshot_stale?: boolean;
    active_checkpoint?: string | null;
    active_checkpoint_time_ist?: string | null;
    next_checkpoint?: string | null;
    next_checkpoint_time_ist?: string | null;
    valid_until_ist?: string | null;
    checkpoint_generated_at_ist?: string | null;
    next_refresh_at_ist?: string | null;
}

interface EODData {
    analysis_type: "EOD";
    analysis_status?: AnalysisStatus;
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
    next_refresh_at_ist?: string | null;
    eod_cache_only?: boolean;
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

type MarketBias = "BULLISH" | "BEARISH" | "WAIT";

const INTRADAY_FALLBACK_REFRESH_SECONDS = 300;
const EOD_REFRESH_SECONDS = 1800;

function makeLocalFallback(symbol: string, reason: string): IntradayData {
    return {
        analysis_status: "fallback",
        decision: "WAIT",
        bias_strength: "LOW",
        market_structure: "Temporarily unavailable",
        sl_hunt_detected: false,
        sl_hunt_detail: null,
        breakout_type: "NONE",
        breakout_detail: null,
        entry_zone: null,
        stop_loss: null,
        target: null,
        trade_quality: "RISKY",
        missing_confirmation: "AI response unavailable",
        news_items: [],
        news_impact: reason,
        reasoning: "Service is temporarily busy. Use manual confirmation and retry.",
        captured_at: new Date().toISOString(),
        symbol,
    };
}

function getOptionPlan(bias: MarketBias) {
    if (bias === "BULLISH") {
        return {
            action: "BUY CE",
            setup: "Buy-side setup",
            cue: "Prefer CE on dips",
            color: "#22c55e",
            bg: "rgba(34,197,94,0.10)",
            border: "rgba(34,197,94,0.35)",
        };
    }
    if (bias === "BEARISH") {
        return {
            action: "BUY PE",
            setup: "Sell-side setup",
            cue: "Prefer PE on rises",
            color: "#ef4444",
            bg: "rgba(239,68,68,0.10)",
            border: "rgba(239,68,68,0.35)",
        };
    }
    return {
        action: "NO TRADE",
        setup: "Wait for confirmation",
        cue: "Avoid forced entries",
        color: "#f59e0b",
        bg: "rgba(245,158,11,0.10)",
        border: "rgba(245,158,11,0.35)",
    };
}

function secondsUntilIso(iso: string | null | undefined): number | null {
    if (!iso) return null;
    const target = new Date(iso).getTime();
    if (Number.isNaN(target)) return null;
    const now = Date.now();
    const diff = Math.ceil((target - now) / 1000);
    return diff > 0 ? diff : 0;
}

function getRefreshSeconds(payload: AIData | null): number {
    if (!payload) return INTRADAY_FALLBACK_REFRESH_SECONDS;

    const anyPayload = payload as IntradayData | EODData;
    const genericNext = secondsUntilIso(anyPayload.next_refresh_at_ist);
    if (genericNext !== null && genericNext > 0) return genericNext;

    if (payload.analysis_type === "EOD") return EOD_REFRESH_SECONDS;

    const intraday = payload as IntradayData;
    if (intraday.checkpoint_mode) {
        const seconds = secondsUntilIso(intraday.valid_until_ist);
        if (seconds !== null && seconds > 0) return seconds;
    }
    return INTRADAY_FALLBACK_REFRESH_SECONDS;
}


type AnalysisBadgeTone = {
    label: string;
    color: string;
    bg: string;
    border: string;
};

type SnapshotChipState = "active" | "pending" | "done" | "idle";

const SNAPSHOT_CHECKPOINTS = [
    { id: "1000", label: "Morning AI", time: "10:00 IST" },
    { id: "1430", label: "Afternoon AI", time: "14:30 IST" },
    { id: "1530", label: "Next Day", time: "15:30 IST" },
] as const;

const SNAPSHOT_ORDER: string[] = SNAPSHOT_CHECKPOINTS.map((item) => item.id);

function includesAny(text: string | null | undefined, fragments: string[]): boolean {
    const normalized = (text || "").toLowerCase();
    return fragments.some((fragment) => normalized.includes(fragment));
}

function getSnapshotTracker(payload: AIData | null): { shownId: string | null; pendingId: string | null } {
    if (!payload) {
        return { shownId: null, pendingId: null };
    }

    if (payload.analysis_type === "EOD") {
        return { shownId: "1530", pendingId: null };
    }

    const intraday = payload as IntradayData;
    if (intraday.active_checkpoint) {
        return {
            shownId: intraday.active_checkpoint,
            pendingId: intraday.snapshot_stale ? (intraday.next_checkpoint ?? null) : null,
        };
    }

    return { shownId: null, pendingId: "1000" };
}

function getSnapshotChipState(chipId: string, shownId: string | null, pendingId: string | null): SnapshotChipState {
    if (shownId === chipId) return "active";
    if (pendingId === chipId) return "pending";

    const chipIndex = SNAPSHOT_ORDER.indexOf(chipId);
    const shownIndex = shownId ? SNAPSHOT_ORDER.indexOf(shownId) : -1;
    const pendingIndex = pendingId ? SNAPSHOT_ORDER.indexOf(pendingId) : -1;
    const completedBeforeShown = shownIndex > -1 && chipIndex < shownIndex
    const completedBeforePending = shownIndex === -1 && pendingIndex > -1 && chipIndex < pendingIndex

    if (completedBeforeShown || completedBeforePending) {
        return "done";
    }

    return "idle";
}

function looksFallback(payload: AIData): boolean {
    if (payload.analysis_status === "fallback") return true;
    if (payload.analysis_type === "EOD") {
        const eod = payload as EODData;
        return includesAny(payload.reasoning, ["analysis unavailable", "temporarily unavailable", "not ready yet"])
            || includesAny(eod.sl_hunt_risk, ["analysis unavailable"]);
    }

    const intraday = payload as IntradayData;
    return includesAny(payload.reasoning, ["analysis unavailable", "temporarily unavailable"])
        || includesAny(intraday.missing_confirmation, ["unavailable"])
        || includesAny(intraday.market_structure, ["unavailable"]);
}

function looksPartial(payload: AIData): boolean {
    if (payload.analysis_status === "repaired") return true;
    return includesAny(payload.reasoning, ["repaired", "format issue"]);
}

function getAnalysisStatusBadge(payload: AIData | null): AnalysisBadgeTone | null {
    if (!payload) return null;

    if (looksPartial(payload)) {
        return {
            label: "Partial AI",
            color: "#fbbf24",
            bg: "rgba(245,158,11,0.12)",
            border: "rgba(245,158,11,0.28)",
        };
    }

    if (looksFallback(payload)) {
        return {
            label: payload.analysis_type === "EOD" ? "Fallback EOD" : "Fallback AI",
            color: "#fda4af",
            bg: "rgba(244,63,94,0.10)",
            border: "rgba(244,63,94,0.28)",
        };
    }

    if (payload.analysis_type === "EOD" && payload.eod_cache_only) {
        return {
            label: "Saved EOD",
            color: "#fdba74",
            bg: "rgba(251,146,60,0.12)",
            border: "rgba(251,146,60,0.30)",
        };
    }

    if (payload.analysis_type !== "EOD" && (payload as IntradayData).checkpoint_mode) {
        const intraday = payload as IntradayData;
        return {
            label: intraday.snapshot_stale ? "Saved AI (pending)" : "Saved AI",
            color: "#93c5fd",
            bg: "rgba(59,130,246,0.12)",
            border: "rgba(59,130,246,0.28)",
        };
    }

    return {
        label: "Full AI",
        color: "#86efac",
        bg: "rgba(34,197,94,0.10)",
        border: "rgba(34,197,94,0.28)",
    };
}

function getEodSlHuntNote(data: EODData): { label: string; value: string; color: string } {
    if (includesAny(data.sl_hunt_risk, ["analysis unavailable"])) {
        return {
            label: "Tomorrow setup note",
            value: "Pending reliable AI output",
            color: "#94a3b8",
        };
    }

    return {
        label: "SL hunt risk tomorrow",
        value: data.sl_hunt_risk,
        color: "#f59e0b",
    };
}

export default function AIDecision({ symbol }: { symbol: string }) {
    const [data, setData] = useState<AIData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showReasoning, setShowReasoning] = useState(false);
    const [countdown, setCountdown] = useState(300);

    const fetchDecision = useCallback(async () => {
        const runOnce = async (): Promise<AIData> => {
            const res = await fetch(`/api/v1/ai-decision?symbol=${encodeURIComponent(symbol)}`, { cache: "no-store" });
            if (!res.ok) {
                let detail = `API error ${res.status}`;
                try {
                    const raw = await res.text();
                    if (raw) {
                        try {
                            const parsed = JSON.parse(raw);
                            detail = parsed?.detail || parsed?.error || detail;
                        } catch {
                            detail = `${detail}: ${raw.slice(0, 140)}`;
                        }
                    }
                } catch {
                    // Ignore parsing issues and keep generic detail.
                }
                const err = new Error(detail) as Error & { status?: number };
                err.status = res.status;
                throw err;
            }
            return (await res.json()) as AIData;
        };

        try {
            setIsLoading(true);
            setError(null);
            let json: AIData;
            try {
                json = await runOnce();
            } catch (firstErr: unknown) {
                const status = (firstErr as { status?: number })?.status;
                if (status && status >= 500) {
                    // One quick retry for transient Render/Gateway failures.
                    await new Promise((r) => setTimeout(r, 1200));
                    json = await runOnce();
                } else {
                    throw firstErr;
                }
            }
            setData(json);
            setCountdown(getRefreshSeconds(json));
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : "Failed to load AI analysis";
            setError(msg);
            // Keep panel usable even when upstream API returns 5xx.
            setData((prev) => {
                const fallback = prev ?? makeLocalFallback(symbol, msg);
                setCountdown(getRefreshSeconds(fallback));
                return fallback;
            });
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
                if (typeof document !== "undefined" && document.hidden) {
                    return c;
                }
                return Math.max(c - 1, 0);
            });
        }, 1000);
        return () => clearInterval(tick);
    }, []);

    useEffect(() => {
        if (countdown === 0 && !isLoading) {
            fetchDecision();
        }
    }, [countdown, isLoading, fetchDecision]);

    const isEOD = data?.analysis_type === "EOD";
    const intraday = !isEOD ? (data as IntradayData | null) : null;
    const analysisBadge = getAnalysisStatusBadge(data);
    const snapshotChip = isEOD
        ? `Based on ${(data as EODData)?.session_date || "last session"}`
        : intraday?.snapshot_label
            ? intraday.snapshot_stale
                ? `${intraday.snapshot_label} | update pending`
                : intraday.snapshot_label
            : intraday?.checkpoint_mode
                ? `Saved snapshot ${intraday.active_checkpoint_time_ist || "--"}`
                : "Saved AI | News Context";
    const { shownId, pendingId } = getSnapshotTracker(data);

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
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.8rem", gap: "0.75rem", flexWrap: "wrap" }}>
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
                        {snapshotChip}
                    </span>
                    {analysisBadge && (
                        <span
                            style={{
                                fontSize: "0.56rem",
                                padding: "3px 8px",
                                borderRadius: "999px",
                                background: analysisBadge.bg,
                                border: `1px solid ${analysisBadge.border}`,
                                color: analysisBadge.color,
                                fontWeight: 700,
                                letterSpacing: "0.08em",
                            }}
                        >
                            {analysisBadge.label}
                        </span>
                    )}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", flexWrap: "wrap", justifyContent: "flex-end" }}>
                    {SNAPSHOT_CHECKPOINTS.map((chip) => {
                        const state = getSnapshotChipState(chip.id, shownId, pendingId);
                        const tone = state === "active"
                            ? chip.id === "1530"
                                ? { fg: "#fdba74", bg: "rgba(251,146,60,0.14)", border: "rgba(251,146,60,0.36)" }
                                : { fg: "#93c5fd", bg: "rgba(59,130,246,0.14)", border: "rgba(59,130,246,0.34)" }
                            : state === "pending"
                                ? { fg: "#fbbf24", bg: "rgba(245,158,11,0.10)", border: "rgba(245,158,11,0.28)" }
                                : state === "done"
                                    ? { fg: "#cbd5e1", bg: "rgba(148,163,184,0.08)", border: "rgba(148,163,184,0.18)" }
                                    : { fg: "#64748b", bg: "rgba(15,23,42,0.28)", border: "rgba(71,85,105,0.18)" };
                        const stateLabel = state === "active"
                            ? "NOW"
                            : state === "pending"
                                ? "NEXT"
                                : state === "done"
                                    ? "DONE"
                                    : "LATER";

                        return (
                            <div
                                key={chip.id}
                                style={{
                                    minWidth: "96px",
                                    padding: "0.40rem 0.52rem",
                                    borderRadius: "10px",
                                    background: tone.bg,
                                    border: `1px solid ${tone.border}`,
                                    boxShadow: state === "active" ? `0 0 0 1px ${tone.border}` : "none",
                                }}
                            >
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.35rem" }}>
                                    <span style={{ fontSize: "0.49rem", color: tone.fg, fontWeight: 800, letterSpacing: "0.10em", textTransform: "uppercase" }}>
                                        {chip.label}
                                    </span>
                                    <span style={{ fontSize: "0.47rem", color: tone.fg, fontWeight: 800, letterSpacing: "0.10em" }}>
                                        {stateLabel}
                                    </span>
                                </div>
                                <div style={{ marginTop: "0.22rem", fontSize: "0.82rem", color: state === "idle" ? "#94a3b8" : "#f8fafc", fontWeight: 800 }}>
                                    {chip.time}
                                </div>
                            </div>
                        );
                    })}

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
                    {intraday?.checkpoint_mode && (
                        <div style={{ marginTop: "0.35rem", fontSize: "0.62rem", color: "#bfdbfe", fontWeight: 700 }}>
                            {intraday.snapshot_stale
                                ? "Showing the last saved AI snapshot while the next scheduled update is pending."
                                : `Showing the saved AI snapshot captured at ${intraday.active_checkpoint_time_ist || "--"} IST. The schedule row above highlights the current saved checkpoint.`}
                        </div>
                    )}
                </div>
            )}

            {isLoading && !data && (
                <div style={{ textAlign: "center", padding: "1.8rem", color: "#64748b", fontSize: "0.82rem", fontWeight: 600 }}>
                    {isEOD ? "Loading saved next-day outlook..." : "Loading saved AI market snapshot..."}
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
    const plan = getOptionPlan(data.decision);

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
            <SectionTitle step="1" title="Decision Summary" />
            <SectionCard>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.8rem", alignItems: "stretch" }}>
                    <BiasBadge
                        label={bias.label}
                        color={bias.color}
                        bg={bias.bg}
                        border={bias.border}
                        strength={data.bias_strength}
                        optionAction={plan.action}
                        optionCue={plan.cue}
                    />
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
                            <ActionTile label="Suggested option side" action={plan.action} setup={plan.setup} cue={plan.cue} color={plan.color} bg={plan.bg} border={plan.border} />
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
                <span style={{ fontSize: "0.58rem", color: "#475569" }}>Saved at: {fmtTime(data.captured_at)} IST</span>
            </div>
        </div>
    );
}

function EODView({ data, showReasoning, onToggleReasoning }: { data: EODData; showReasoning: boolean; onToggleReasoning: () => void }) {
    const bias = BIAS_CONFIG[data.next_day_bias] ?? BIAS_CONFIG.WAIT;
    const plan = getOptionPlan(data.next_day_bias);
    const slHuntNote = getEodSlHuntNote(data);
    const footerPrefix = data.eod_cache_only ? "Cached EOD based on" : "EOD based on";

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
            <SectionTitle step="1" title="Session Summary and Bias" />
            <SectionCard>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.8rem" }}>
                    <BiasBadge
                        label={`${bias.label} TOMORROW`}
                        color={bias.color}
                        bg={bias.bg}
                        border={bias.border}
                        strength={data.bias_strength}
                        optionAction={plan.action}
                        optionCue={plan.cue}
                    />
                    <div style={{ flex: 1, minWidth: "220px", display: "grid", gap: "0.5rem" }}>
                        <KV label="Today's session" value={data.session_type} />
                        <KV label="Close position" value={data.close_position} valueColor={data.close_position.includes("Top") ? "#22c55e" : data.close_position.includes("Bottom") ? "#ef4444" : "#f59e0b"} />
                        <KV label={slHuntNote.label} value={slHuntNote.value} valueColor={slHuntNote.color} />
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
                            <ActionTile label="Suggested option side" action={plan.action} setup={plan.setup} cue={plan.cue} color={plan.color} bg={plan.bg} border={plan.border} />
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
                    <SectionTitle step="5" title="Overnight Cues and Headlines" />
                    <NewsPanel title="Cues to monitor" items={data.news_tomorrow} impact={null} accentColor="#818cf8" />
                </>
            )}

            <SectionTitle step="6" title="Detailed Reasoning" />
            <ReasoningPanel label="View full next-day reasoning" text={data.reasoning} show={showReasoning} onToggle={onToggleReasoning} />

            <span style={{ fontSize: "0.58rem", color: "#475569", textAlign: "right" }}>{footerPrefix} {data.session_date} | Updated: {fmtTime(data.captured_at)} IST</span>
        </div>
    );
}

function SectionTitle({ step, title }: { step: string; title: string }) {
    return <p style={{ fontSize: "0.64rem", fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.14em" }}>{step}. {title}</p>;
}

function SectionCard({ children }: { children: React.ReactNode }) {
    return <div style={{ padding: "0.82rem", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.02)" }}>{children}</div>;
}

function BiasBadge({
    label,
    color,
    bg,
    border,
    strength,
    optionAction,
    optionCue,
}: {
    label: string;
    color: string;
    bg: string;
    border: string;
    strength: string;
    optionAction: string;
    optionCue: string;
}) {
    return (
        <div style={{ minWidth: "150px", borderRadius: "12px", border: `1px solid ${border}`, background: bg, padding: "0.8rem", textAlign: "center" }}>
            <div style={{ fontSize: "1.02rem", fontWeight: 900, color }}>{label}</div>
            <div style={{ marginTop: "0.25rem", fontSize: "0.62rem", fontWeight: 700, color: STRENGTH_COLORS[strength], letterSpacing: "0.08em" }}>{strength} CONFIDENCE</div>
            <div style={{ marginTop: "0.5rem", fontSize: "0.56rem", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700 }}>
                Suggested Action
            </div>
            <div style={{ marginTop: "0.12rem", fontSize: "0.82rem", fontWeight: 900, color }}>{optionAction}</div>
            <div style={{ marginTop: "0.16rem", fontSize: "0.64rem", color: "#cbd5e1", lineHeight: 1.4 }}>{optionCue}</div>
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

function ActionTile({
    label,
    action,
    setup,
    cue,
    color,
    bg,
    border,
}: {
    label: string;
    action: string;
    setup: string;
    cue: string;
    color: string;
    bg: string;
    border: string;
}) {
    return (
        <div style={{ flex: 1, minWidth: "170px", padding: "0.7rem", borderRadius: "10px", background: bg, border: `1px solid ${border}`, textAlign: "center" }}>
            <div style={{ fontSize: "0.56rem", fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.12em" }}>{label}</div>
            <div style={{ marginTop: "0.2rem", fontSize: "0.95rem", fontWeight: 900, color }}>{action}</div>
            <div style={{ marginTop: "0.2rem", fontSize: "0.68rem", fontWeight: 700, color: "#cbd5e1" }}>{setup}</div>
            <div style={{ marginTop: "0.2rem", fontSize: "0.66rem", color: "#94a3b8", lineHeight: 1.4 }}>{cue}</div>
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

