"use client";

interface IndicatorSignals {
    ema20: string;
    rsi14: string;
    vwap: string;
    bollinger: string;
    macd: string;
}

function signalClass(value: string | undefined): string {
    if (value === "BUY") return "signal-buy";
    if (value === "SELL") return "signal-sell";
    return "signal-neutral";
}

function computeDecision(signals: IndicatorSignals) {
    const sigs = [signals.ema20, signals.rsi14, signals.vwap, signals.bollinger, signals.macd];
    const buy = sigs.filter((s) => s === "BUY").length;
    const sell = sigs.filter((s) => s === "SELL").length;
    const neutral = sigs.filter((s) => s === "NEUTRAL").length;

    let decision = "NEUTRAL";
    if (buy >= 4) decision = "STRONG BUY";
    else if (buy === 3) decision = "BUY";
    else if (buy === 2 && buy > sell) decision = "LEAN BUY";
    else if (sell >= 4) decision = "STRONG SELL";
    else if (sell === 3) decision = "SELL";
    else if (sell === 2 && sell > buy) decision = "LEAN SELL";

    return { decision, buy, sell, neutral };
}

export default function IndicatorTable({ signals }: { signals?: IndicatorSignals | null }) {
    const rows = [
        { key: "EMA20", value: signals?.ema20 },
        { key: "RSI14", value: signals?.rsi14 },
        { key: "VWAP", value: signals?.vwap },
        { key: "BB", value: signals?.bollinger },
        { key: "MACD", value: signals?.macd },
    ];

    const summary = signals ? computeDecision(signals) : null;

    return (
        <div className="border border-terminal-border bg-terminal-panel">
            <div className="flex items-center justify-between border-b border-terminal-border bg-terminal-bg px-2 py-1">
                <span className="section-label">Technical Indicators</span>
                {summary && (
                    <span
                        className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 border ${
                            summary.decision.includes("BUY")
                                ? "text-bb-green border-bb-green/40 bg-bb-green/10"
                                : summary.decision.includes("SELL")
                                  ? "text-bb-red border-bb-red/40 bg-bb-red/10"
                                  : "text-terminal-muted border-terminal-border"
                        }`}
                    >
                        {summary.decision} · {summary.buy}B/{summary.sell}S/{summary.neutral}N
                    </span>
                )}
            </div>
            <table className="data-table">
                <thead>
                    <tr>
                        <th>Indicator</th>
                        <th>Signal</th>
                        <th className="hidden sm:table-cell">Side</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row) => (
                        <tr key={row.key} className="hover:bg-terminal-bg/80">
                            <td className="text-terminal-muted">{row.key}</td>
                            <td className={signalClass(row.value)}>{row.value || "—"}</td>
                            <td className="hidden sm:table-cell text-terminal-dim">
                                {row.value === "BUY" ? "LONG" : row.value === "SELL" ? "SHORT" : "FLAT"}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
