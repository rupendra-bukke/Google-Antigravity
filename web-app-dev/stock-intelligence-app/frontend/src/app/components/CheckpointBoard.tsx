"use client";

import { useState, useEffect, useCallback, useMemo } from "react";

const API_BASE = "/api";
const FIXED_SYMBOL = "^NSEI";

interface CheckpointData {
    captured_at: string;
    spot_price: number;
    scalp_signal: string;
    three_min_confirm: string;
    htf_trend: string;
    trend_direction: string;
    execute: string;
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
        direction: string;
        arrow: string;
        confidence: number;
        reasons: string[];
    } | null;
}

interface Panel {
    id: string;
    label: string;
    time: string;
    data: CheckpointData | null;
}

type TradeIntent = "BUY" | "SELL" | "WAIT";
type EvalOutcome = "WIN" | "LOSS" | "FLAT" | "SKIP" | "PENDING" | "NO_NEXT";

interface EvalRow {
    id: string;
    label: string;
    time: string;
    nextLabel: string;
    nextTime: string;
    intent: TradeIntent;
    outcome: EvalOutcome;
    entry: number | null;
    exit: number | null;
    points: number | null;
    note: string;
}

interface MoveView {
    arrow: string;
    label: string;
    sublabel: string;
    color: string;
    bg: string;
    border: string;
    conf: number;
    confColor: string;
}

function getIstDateStr(date: Date = new Date()): string {
    return new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Kolkata",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).format(date);
}

function formatBoardDate(dateStr: string | null | undefined): string {
    if (!dateStr) return "--";
    const dt = new Date(`${dateStr}T00:00:00Z`);
    if (Number.isNaN(dt.getTime())) return dateStr;
    return dt.toLocaleDateString("en-IN", {
        timeZone: "Asia/Kolkata",
        day: "2-digit",
        month: "short",
        year: "numeric",
    });
}

function formatCapturedAt(capturedAt: string | undefined): string {
    if (!capturedAt) return "--";
    const dt = new Date(capturedAt);
    if (Number.isNaN(dt.getTime())) return capturedAt;
    return `${dt.toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    })} IST`;
}

function formatCheckpointSlot(boardDate: string | null, slotTime: string): string {
    const d = formatBoardDate(boardDate);
    if (d === "--") return `${slotTime} IST`;
    return `${d}, ${slotTime} IST`;
}

function formatPrice(v: number | null): string {
    if (v === null || Number.isNaN(v)) return "--";
    return `Rs ${v.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

function getNextMove(data: CheckpointData): MoveView {
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
    const tUp = trend.includes("Bullish") || trend.toLowerCase().includes("green");
    const tDown = trend.includes("Bearish") || trend.toLowerCase().includes("red");

    if (strong && isBuyS) {
        return {
            arrow: "▲",
            label: "BUY / CE",
            sublabel: tUp ? "Trend bullish and confirmed" : "Scalp BUY strong",
            color: "#4ade80",
            bg: "rgba(34,197,94,0.12)",
            border: "rgba(34,197,94,0.35)",
            conf: fcConf,
            confColor: "#4ade80",
        };
    }
    if (strong && isSellS) {
        return {
            arrow: "▼",
            label: "SELL / PE",
            sublabel: tDown ? "Trend bearish and confirmed" : "Scalp SELL strong",
            color: "#f87171",
            bg: "rgba(239,68,68,0.12)",
            border: "rgba(239,68,68,0.35)",
            conf: fcConf,
            confColor: "#f87171",
        };
    }

    const bull = (tUp ? 1 : 0) + (fcUp ? 1 : 0) + (isBuyS ? 1 : 0);
    const bear = (tDown ? 1 : 0) + (fcDown ? 1 : 0) + (isSellS ? 1 : 0);

    if (bull > bear && bull >= 2) {
        return {
            arrow: "▲",
            label: "BUY / CE",
            sublabel: "Bias up based on alignment",
            color: "#4ade80",
            bg: "rgba(34,197,94,0.08)",
            border: "rgba(34,197,94,0.2)",
            conf: fcConf,
            confColor: "#4ade80",
        };
    }
    if (bear > bull && bear >= 2) {
        return {
            arrow: "▼",
            label: "SELL / PE",
            sublabel: "Bias down based on alignment",
            color: "#f87171",
            bg: "rgba(239,68,68,0.08)",
            border: "rgba(239,68,68,0.2)",
            conf: fcConf,
            confColor: "#f87171",
        };
    }

    return {
        arrow: "◆",
        label: "WAIT",
        sublabel: "Mixed signals",
        color: "#94a3b8",
        bg: "rgba(148,163,184,0.06)",
        border: "rgba(148,163,184,0.15)",
        conf: fcConf,
        confColor: "#94a3b8",
    };
}

function getTradeIntent(data: CheckpointData): TradeIntent {
    const label = getNextMove(data).label;
    if (label.includes("BUY")) return "BUY";
    if (label.includes("SELL")) return "SELL";
    return "WAIT";
}

function buildEvalRows(panels: Panel[]): EvalRow[] {
    return panels.map((panel, idx) => {
        const next = panels[idx + 1] ?? null;
        const base: EvalRow = {
            id: panel.id,
            label: panel.label,
            time: panel.time,
            nextLabel: next?.label ?? "-",
            nextTime: next?.time ?? "-",
            intent: panel.data ? getTradeIntent(panel.data) : "WAIT",
            outcome: "PENDING",
            entry: panel.data?.spot_price ?? null,
            exit: next?.data?.spot_price ?? null,
            points: null,
            note: "",
        };

        if (!panel.data) {
            return { ...base, outcome: "PENDING", note: "Checkpoint data missing" };
        }
        if (!next) {
            return { ...base, outcome: "NO_NEXT", note: "Last slot has no next checkpoint" };
        }
        if (!next.data) {
            return { ...base, outcome: "PENDING", note: "Next checkpoint data missing" };
        }

        const entry = panel.data.spot_price;
        const exit = next.data.spot_price;
        const diff = Number((exit - entry).toFixed(2));
        const intent = getTradeIntent(panel.data);

        if (intent === "WAIT") {
            return {
                ...base,
                intent,
                outcome: "SKIP",
                entry,
                exit,
                points: diff,
                note: "WAIT signal, skipped",
            };
        }
        if (diff === 0) {
            return {
                ...base,
                intent,
                outcome: "FLAT",
                entry,
                exit,
                points: diff,
                note: "No move till next checkpoint",
            };
        }

        const isWin = (intent === "BUY" && diff > 0) || (intent === "SELL" && diff < 0);
        return {
            ...base,
            intent,
            outcome: isWin ? "WIN" : "LOSS",
            entry,
            exit,
            points: diff,
            note: `${intent} checked till ${next.time}`,
        };
    });
}

function getOutcomeStyle(outcome: EvalOutcome): { text: string; fg: string; bg: string; border: string } {
    switch (outcome) {
        case "WIN":
            return { text: "WIN", fg: "#22c55e", bg: "rgba(34,197,94,0.12)", border: "rgba(34,197,94,0.35)" };
        case "LOSS":
            return { text: "LOSS", fg: "#ef4444", bg: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.35)" };
        case "FLAT":
            return { text: "FLAT", fg: "#f59e0b", bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.35)" };
        case "SKIP":
            return { text: "SKIP", fg: "#a78bfa", bg: "rgba(167,139,250,0.12)", border: "rgba(167,139,250,0.35)" };
        case "NO_NEXT":
            return { text: "N/A", fg: "#94a3b8", bg: "rgba(148,163,184,0.12)", border: "rgba(148,163,184,0.25)" };
        default:
            return { text: "PENDING", fg: "#64748b", bg: "rgba(100,116,139,0.12)", border: "rgba(100,116,139,0.25)" };
    }
}

function StatItem({ label, value, color = "#94a3b8" }: { label: string; value: string | number; color?: string }) {
    return (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "0.65rem", color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>{label}</span>
            <span style={{ fontSize: "0.75rem", color, fontWeight: 600 }}>{value}</span>
        </div>
    );
}

function CheckpointCard({
    panel,
    isLatest,
    boardDate,
}: {
    panel: Panel;
    isLatest: boolean;
    boardDate: string | null;
}) {
    const [h, m] = panel.time.split(":").map(Number);
    const targetTime = new Date();
    targetTime.setHours(h, m, 0, 0);

    const isForToday = boardDate ? boardDate === getIstDateStr() : true;
    const isPending = !panel.data && isForToday && new Date() < targetTime;
    const isMissed = !panel.data && isForToday && new Date() >= targetTime;
    const isHistoricMissing = !panel.data && !isForToday;
    const isPopulated = !!panel.data;
    const move = isPopulated ? getNextMove(panel.data!) : null;

    return (
        <div
            style={{
                background: !isPopulated ? "rgba(15,23,42,0.2)" : move?.bg ?? "rgba(148,163,184,0.06)",
                backdropFilter: "blur(16px)",
                WebkitBackdropFilter: "blur(16px)",
                border: isLatest
                    ? "1px solid rgba(212,175,55,0.4)"
                    : !isPopulated
                        ? "1px dashed rgba(255,255,255,0.05)"
                        : `1px solid ${move?.border ?? "rgba(148,163,184,0.15)"}`,
                borderRadius: "16px",
                padding: "1.2rem",
                minWidth: "200px",
                position: "relative",
                transition: "all 0.3s cubic-bezier(0.4,0,0.2,1)",
                boxShadow: isLatest ? "0 10px 30px -10px rgba(212,175,55,0.15)" : "none",
                transform: isLatest ? "scale(1.02)" : "scale(1)",
                zIndex: isLatest ? 2 : 1,
            }}
        >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.9rem" }}>
                <div>
                    <h4 style={{ color: isPopulated ? "#f8fafc" : "#475569", margin: 0, fontSize: "0.82rem", fontWeight: 700 }}>{panel.label}</h4>
                    <span style={{ display: "block", fontSize: "0.68rem", color: "#64748b", fontWeight: 600 }}>{panel.time} IST</span>
                    <span style={{ display: "block", fontSize: "0.6rem", color: "#475569", fontWeight: 700 }}>
                        {formatBoardDate(boardDate)}
                    </span>
                </div>
                {isLatest && (
                    <div
                        style={{
                            background: "#d4af37",
                            color: "#000",
                            fontSize: "0.55rem",
                            fontWeight: 900,
                            padding: "2px 6px",
                            borderRadius: "4px",
                            textTransform: "uppercase",
                        }}
                    >
                        Latest
                    </div>
                )}
            </div>

            {isPopulated && move ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                    <div
                        style={{
                            background: move.bg,
                            border: `1px solid ${move.border}`,
                            borderRadius: "12px",
                            padding: "10px 12px",
                            display: "flex",
                            flexDirection: "column",
                            gap: "4px",
                        }}
                    >
                        <span style={{ fontSize: "0.5rem", color: "#64748b", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.12em" }}>Next Move</span>
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

                    <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: "0.55rem" }}>
                        <StatItem label="Price" value={formatPrice(panel.data!.spot_price)} color="#e2e8f0" />
                        <StatItem label="Checkpoint" value={formatCheckpointSlot(boardDate, panel.time)} color="#94a3b8" />
                        <StatItem label="Saved At" value={formatCapturedAt(panel.data!.captured_at)} color="#94a3b8" />
                    </div>
                </div>
            ) : (
                <div style={{ height: "120px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", opacity: 0.6 }}>
                    <div style={{ fontSize: "1.5rem", marginBottom: "0.5rem", animation: (isPending || isMissed) ? "pulse 1.5s infinite" : "none" }}>
                        ...
                    </div>
                    <p style={{ color: "#64748b", fontSize: "0.65rem", textAlign: "center", margin: 0, textTransform: "uppercase", fontWeight: 700 }}>
                        {isPending ? "Waiting..." : isMissed ? "Catching up..." : isHistoricMissing ? "Not captured" : "No Data"}
                    </p>
                </div>
            )}
        </div>
    );
}

function EvalResultPanel({ rows, boardDate }: { rows: EvalRow[]; boardDate: string | null }) {
    const wins = rows.filter((r) => r.outcome === "WIN").length;
    const losses = rows.filter((r) => r.outcome === "LOSS").length;
    const flats = rows.filter((r) => r.outcome === "FLAT").length;
    const skipped = rows.filter((r) => r.outcome === "SKIP").length;
    const pending = rows.filter((r) => r.outcome === "PENDING").length;
    const scored = wins + losses;
    const accuracy = scored > 0 ? Math.round((wins / scored) * 100) : null;

    return (
        <div style={{ marginTop: "1.3rem", border: "1px solid rgba(148,163,184,0.2)", borderRadius: "16px", padding: "1rem", background: "rgba(15,23,42,0.35)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", marginBottom: "0.8rem" }}>
                <h3 style={{ margin: 0, fontSize: "0.78rem", letterSpacing: "0.14em", textTransform: "uppercase", color: "#a5b4fc" }}>
                    Checkpoint Win/Loss Review
                </h3>
                <span style={{ fontSize: "0.62rem", color: "#64748b", fontWeight: 700 }}>
                    Data date {formatBoardDate(boardDate)} · Until next checkpoint
                </span>
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "0.9rem" }}>
                <span style={{ fontSize: "0.68rem", color: "#22c55e", fontWeight: 800 }}>WIN {wins}</span>
                <span style={{ fontSize: "0.68rem", color: "#ef4444", fontWeight: 800 }}>LOSS {losses}</span>
                <span style={{ fontSize: "0.68rem", color: "#f59e0b", fontWeight: 800 }}>FLAT {flats}</span>
                <span style={{ fontSize: "0.68rem", color: "#a78bfa", fontWeight: 800 }}>SKIP {skipped}</span>
                <span style={{ fontSize: "0.68rem", color: "#94a3b8", fontWeight: 800 }}>PENDING {pending}</span>
                <span style={{ fontSize: "0.68rem", color: "#e2e8f0", fontWeight: 800 }}>
                    ACCURACY {accuracy === null ? "--" : `${accuracy}%`}
                </span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: "0.7rem" }}>
                {rows.map((r) => {
                    const tag = getOutcomeStyle(r.outcome);
                    return (
                        <div key={r.id} style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", padding: "0.75rem", background: "rgba(2,6,23,0.55)" }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                                <div>
                                    <div style={{ fontSize: "0.8rem", color: "#e2e8f0", fontWeight: 800 }}>{r.label}</div>
                                    <div style={{ fontSize: "0.63rem", color: "#64748b", fontWeight: 700 }}>
                                        {r.time} {"->"} {r.nextTime}
                                    </div>
                                </div>
                                <span style={{ fontSize: "0.58rem", fontWeight: 900, color: tag.fg, background: tag.bg, border: `1px solid ${tag.border}`, padding: "3px 7px", borderRadius: "999px" }}>
                                    {tag.text}
                                </span>
                            </div>

                            <div style={{ marginTop: "0.55rem", fontSize: "0.66rem", color: "#94a3b8", fontWeight: 700 }}>
                                Decision {r.intent} · Next {r.nextLabel}
                            </div>
                            <div style={{ marginTop: "0.28rem", fontSize: "0.7rem", color: "#cbd5e1", fontWeight: 700 }}>
                                {formatPrice(r.entry)} {"->"} {formatPrice(r.exit)}
                            </div>
                            <div style={{ marginTop: "0.22rem", fontSize: "0.66rem", color: r.points === null ? "#64748b" : r.points >= 0 ? "#22c55e" : "#ef4444", fontWeight: 800 }}>
                                Move {r.points === null ? "--" : `${r.points > 0 ? "+" : ""}${r.points.toFixed(2)} pts`}
                            </div>
                            <div style={{ marginTop: "0.25rem", fontSize: "0.62rem", color: "#64748b", fontWeight: 700 }}>{r.note}</div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export default function CheckpointBoard() {
    const [panels, setPanels] = useState<Panel[]>([]);
    const [loading, setLoading] = useState(true);
    const [catchingUp, setCatchingUp] = useState(false);
    const [boardDate, setBoardDate] = useState<string | null>(null);

    const fetchPanels = useCallback(async () => {
        try {
            const res = await fetch(`${API_BASE}/v1/checkpoints?symbol=${encodeURIComponent(FIXED_SYMBOL)}`);
            if (!res.ok) return;
            const json = await res.json();
            setPanels(json.panels || []);
            setBoardDate(json.date ?? null);
            setCatchingUp(json.catchup_triggered === true);
        } catch (err) {
            console.error("Failed to fetch checkpoints:", err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchPanels();
        const interval = setInterval(fetchPanels, catchingUp ? 10000 : 30000);
        return () => clearInterval(interval);
    }, [fetchPanels, catchingUp]);

    const latestIndex = panels.length - 1 - [...panels].reverse().findIndex((p) => p.data);
    const effectiveLatestIndex = latestIndex >= 0 ? latestIndex : -1;
    const evalRows = useMemo(() => buildEvalRows(panels), [panels]);

    return (
        <div style={{ margin: "2.5rem 0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "1.5rem" }}>
                <div style={{ width: "3px", height: "18px", background: "#d4af37", borderRadius: "2px" }} />
                <h2 style={{ fontSize: "0.75rem", fontWeight: 900, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.2em", margin: 0 }}>
                    Nifty 50 Market Timeline
                </h2>
                <div style={{ flex: 1, height: "1px", background: "linear-gradient(to right, rgba(148,163,184,0.1), transparent)" }} />
                {catchingUp ? (
                    <span style={{ fontSize: "0.6rem", color: "#f59e0b", fontWeight: 700, animation: "pulse 1.5s infinite" }}>
                        CATCHING UP HISTORICAL DATA...
                    </span>
                ) : (
                    <span style={{ fontSize: "0.6rem", color: "#475569", fontWeight: 700 }}>
                        {boardDate ? `DATA DATE ${formatBoardDate(boardDate)} | CAPTURING 7 STRATEGIC POINTS` : "CAPTURING 7 STRATEGIC POINTS"}
                    </span>
                )}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "1rem", perspective: "1000px" }}>
                {loading && panels.length === 0 ? (
                    Array(7)
                        .fill(0)
                        .map((_, i) => (
                            <div key={i} style={{ height: "200px", background: "rgba(255,255,255,0.02)", borderRadius: "16px", animation: "pulse 2s shadow infinite" }} />
                        ))
                ) : (
                    panels.map((panel, i) => (
                        <CheckpointCard key={panel.id} panel={panel} isLatest={i === effectiveLatestIndex} boardDate={boardDate} />
                    ))
                )}
            </div>

            {!loading && evalRows.length > 0 && <EvalResultPanel rows={evalRows} boardDate={boardDate} />}

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
