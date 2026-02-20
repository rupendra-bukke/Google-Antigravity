"use client";

interface OptionStrike {
    strike: number;
    strike_label: string;
    option_type: string;
    est_premium: number;
    sl_points: number;
    target_points: number;
    premium_valid: boolean;
}

interface AdvancedData {
    prompt_version: number;
    date_time: string;
    index: string;
    spot_price: number;
    scalp_signal: string;
    three_min_confirm: string;
    htf_trend: string;
    trend_direction: string;
    option_strike: OptionStrike | null;
    execute: string;
    execute_reason: string;
    steps_detail: Record<string, any>;
}

interface AdvancedDecisionProps {
    data: AdvancedData | null;
    isLoading: boolean;
}

function SignalLine({ label, value }: { label: string; value: string }) {
    const getColor = (v: string) => {
        if (v.includes("🟢") || v.includes("GREEN") || v.includes("Bullish") || v.includes("BUY") || v.includes("Strong"))
            return "text-emerald-400";
        if (v.includes("🔴") || v.includes("RED") || v.includes("Bearish") || v.includes("SELL"))
            return "text-rose-400";
        return "text-amber-400";
    };

    return (
        <div className="flex items-center justify-between py-2 border-b border-gray-800/30 last:border-0">
            <span className="text-xs text-gray-500 font-medium">{label}</span>
            <span className={`text-sm font-bold ${getColor(value)}`}>{value}</span>
        </div>
    );
}

export default function AdvancedDecision({ data, isLoading }: AdvancedDecisionProps) {
    if (isLoading) {
        return (
            <div className="glass-card p-6 md:p-8 animate-fade-in">
                <p className="section-label mb-4">Advanced Analysis</p>
                <div className="space-y-3">
                    {[...Array(6)].map((_, i) => (
                        <div key={i} className="h-5 rounded bg-gray-800/50 shimmer" style={{ width: `${70 + i * 5}%` }} />
                    ))}
                </div>
            </div>
        );
    }

    if (!data) return null;

    const executeColor =
        data.execute === "Strong"
            ? "decision-buy"
            : data.execute === "Weak"
                ? "decision-hold"
                : "decision-sell";

    const executeEmoji =
        data.execute === "Strong"
            ? "🟢"
            : data.execute === "Weak"
                ? "🟡"
                : "🔴";

    return (
        <div className="glass-card p-6 md:p-8 animate-slide-up relative overflow-hidden">
            {/* Background glow */}
            {data.execute === "Strong" && (
                <div className="absolute -top-20 -right-20 w-60 h-60 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
            )}
            {data.execute === "NO TRADE" && (
                <div className="absolute -top-20 -right-20 w-60 h-60 bg-rose-500/5 rounded-full blur-3xl pointer-events-none" />
            )}

            {/* Header */}
            <div className="flex items-center justify-between mb-5">
                <p className="section-label">Advanced Analysis</p>
                <span className="text-[9px] text-gray-600 font-mono">
                    v{data.prompt_version} · {data.date_time}
                </span>
            </div>

            {/* Execute Badge */}
            <div className="mb-6">
                <span
                    className={`inline-flex items-center gap-2.5 px-6 py-3.5 rounded-2xl text-xl font-black tracking-wide ${executeColor}`}
                >
                    <span className="text-xl">{executeEmoji}</span>
                    {data.execute === "NO TRADE" ? "NO TRADE" : `EXECUTE: ${data.execute}`}
                </span>
                {data.execute_reason && (
                    <p className="text-[11px] text-gray-500 mt-2 ml-1 max-w-lg">{data.execute_reason}</p>
                )}
            </div>

            {/* Signal Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {/* Left: Signals */}
                <div className="bg-gray-800/20 rounded-xl p-4 border border-gray-800/30">
                    <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest mb-3">Signals</p>
                    <SignalLine label="1-30 MIN SCALP" value={data.scalp_signal} />
                    <SignalLine label="📊 3-MIN CONFIRM" value={data.three_min_confirm} />
                    <SignalLine label="📉 HTF TREND (15m/1h)" value={data.htf_trend} />
                    <SignalLine label="📉 TREND DIRECTION" value={data.trend_direction} />
                </div>

                {/* Right: Option Strike (if trade) */}
                <div className="bg-gray-800/20 rounded-xl p-4 border border-gray-800/30">
                    <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest mb-3">🎯 Option Strike</p>
                    {data.option_strike ? (
                        <div className="space-y-2.5">
                            <div className="flex justify-between items-baseline">
                                <span className="text-xs text-gray-500">Strike</span>
                                <span className="text-lg font-black text-white tabular-nums">
                                    {data.option_strike.strike_label} {data.option_strike.strike}{" "}
                                    <span className={data.option_strike.option_type === "CE" ? "text-emerald-400" : "text-rose-400"}>
                                        {data.option_strike.option_type}
                                    </span>
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-xs text-gray-500">Est. Premium</span>
                                <span className={`text-sm font-bold tabular-nums ${data.option_strike.premium_valid ? "text-gray-200" : "text-rose-400 line-through"}`}>
                                    ₹{data.option_strike.est_premium}
                                </span>
                            </div>
                            <div className="h-px bg-gray-800/40 my-1" />
                            <div className="flex justify-between">
                                <span className="text-xs text-gray-500">Stoploss</span>
                                <span className="text-sm font-bold text-rose-400 tabular-nums">
                                    {data.option_strike.sl_points} pts
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-xs text-gray-500">Target</span>
                                <span className="text-sm font-bold text-emerald-400 tabular-nums">
                                    {data.option_strike.target_points} pts
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-xs text-gray-500">Risk:Reward</span>
                                <span className="text-sm font-bold text-brand-400 tabular-nums">
                                    1 : {Math.round(data.option_strike.target_points / data.option_strike.sl_points * 10) / 10}
                                </span>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center justify-center h-32 text-gray-600 text-sm">
                            <span>⚪ No trade — strike not computed</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Step Details (collapsible sections) */}
            <details className="group">
                <summary className="text-[10px] font-bold text-gray-600 uppercase tracking-widest cursor-pointer hover:text-gray-400 transition-colors flex items-center gap-2">
                    <svg className="w-3 h-3 transform group-open:rotate-90 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    Detailed Reasoning
                </summary>
                <div className="mt-3 space-y-3 text-xs">
                    {Object.entries(data.steps_detail).map(([key, step]) => (
                        <div key={key} className="bg-gray-800/15 rounded-lg p-3 border border-gray-800/20">
                            <p className="text-[10px] font-bold text-gray-500 uppercase mb-1.5">
                                {key.replace("_", " ")}
                            </p>
                            {step.details && Array.isArray(step.details) && (
                                <ul className="space-y-1">
                                    {step.details.map((d: string, i: number) => (
                                        <li key={i} className="text-gray-400 flex items-start gap-1.5">
                                            <span className="text-brand-500/60 mt-0.5">●</span> {d}
                                        </li>
                                    ))}
                                </ul>
                            )}
                            {step.reasons && Array.isArray(step.reasons) && step.reasons.length > 0 && (
                                <ul className="space-y-1">
                                    {step.reasons.map((r: string, i: number) => (
                                        <li key={i} className="text-amber-400/80 flex items-start gap-1.5">
                                            <span className="mt-0.5">⚠</span> {r}
                                        </li>
                                    ))}
                                </ul>
                            )}
                            {step.skip_reasons && Array.isArray(step.skip_reasons) && step.skip_reasons.length > 0 && (
                                <ul className="space-y-1">
                                    {step.skip_reasons.map((r: string, i: number) => (
                                        <li key={i} className="text-rose-400/80 flex items-start gap-1.5">
                                            <span className="mt-0.5">🚫</span> {r}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    ))}
                </div>
            </details>
        </div>
    );
}
