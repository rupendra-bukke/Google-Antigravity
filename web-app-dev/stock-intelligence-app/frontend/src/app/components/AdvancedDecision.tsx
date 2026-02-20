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

function getSignalColor(v: string) {
    if (v.includes("🟢") || v.includes("GREEN") || v.includes("Bullish") || v.includes("BUY") || v.includes("Strong"))
        return { text: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" };
    if (v.includes("🔴") || v.includes("RED") || v.includes("Bearish") || v.includes("SELL"))
        return { text: "text-rose-400", bg: "bg-rose-500/10", border: "border-rose-500/20" };
    return { text: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20" };
}

function SignalRow({ label, value }: { label: string; value: string }) {
    const colors = getSignalColor(value);
    return (
        <div className="flex items-center justify-between gap-3">
            <span className="text-[11px] text-gray-500 font-semibold uppercase tracking-wide shrink-0">{label}</span>
            <span className={`text-[11px] font-bold px-2.5 py-1 rounded-lg ${colors.bg} ${colors.text} border ${colors.border} text-right`}>
                {value}
            </span>
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

    const isBullish = data.execute === "Strong";
    const isNoTrade = data.execute === "NO TRADE";
    const executeBorderColor = isBullish ? "border-emerald-500" : isNoTrade ? "border-rose-500" : "border-amber-500";
    const isCE = data.option_strike?.option_type === "CE";
    const strikeColor = isCE ? "text-emerald-400" : "text-rose-400";
    const strikeTicketBorder = isCE ? "border-emerald-500/30" : "border-rose-500/30";
    const strikeTicketBg = isCE ? "from-emerald-900/20 to-transparent" : "from-rose-900/20 to-transparent";
    const strikeHeaderBg = isCE ? "bg-emerald-500/10" : "bg-rose-500/10";

    return (
        <div className="glass-card p-6 md:p-8 animate-slide-up relative overflow-hidden">
            {/* Background glow */}
            <div className={`absolute -top-24 -right-24 w-72 h-72 ${isBullish ? 'bg-emerald-500/5' : isNoTrade ? 'bg-rose-500/5' : 'bg-amber-500/5'} rounded-full blur-3xl pointer-events-none`} />

            {/* Header */}
            <div className="flex items-center justify-between mb-5">
                <p className="section-label">Advanced Analysis</p>
                <span className="text-[9px] text-gray-600 font-mono">
                    v{data.prompt_version} · {data.date_time}
                </span>
            </div>

            {/* Execute Badge — styled with left border accent + pulse */}
            <div className={`mb-6 pl-4 border-l-4 ${executeBorderColor} rounded-r-xl`}>
                <span className={`inline-flex items-center gap-2.5 px-5 py-3 rounded-xl text-xl font-black tracking-wide ${executeColor}`}>
                    {isBullish && <span className="relative flex h-2.5 w-2.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" /><span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" /></span>}
                    <span>{executeEmoji}</span>
                    {isNoTrade ? "NO TRADE" : `EXECUTE: ${data.execute}`}
                </span>
                {data.execute_reason && (
                    <p className="text-[11px] text-gray-500 mt-2 ml-1 max-w-lg">{data.execute_reason}</p>
                )}
            </div>

            {/* Signal Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {/* Left: Color-coded Signal Pills */}
                <div className="bg-gray-900/40 rounded-2xl p-5 border border-gray-800/40 space-y-3">
                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-1">📡 Live Signals</p>
                    <SignalRow label="Scalp (1-30 min)" value={data.scalp_signal} />
                    <SignalRow label="3-Min Confirm" value={data.three_min_confirm} />
                    <SignalRow label="HTF Trend (15m/1h)" value={data.htf_trend} />
                    <SignalRow label="Trend Direction" value={data.trend_direction} />
                </div>

                {/* Right: Trading Ticket Style Option Strike */}
                {data.option_strike ? (
                    <div className={`rounded-2xl border ${strikeTicketBorder} overflow-hidden`}>
                        {/* Ticket Header */}
                        <div className={`${strikeHeaderBg} px-5 py-3 flex items-center justify-between border-b ${strikeTicketBorder}`}>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">🎯 Trade Ticket</p>
                            <span className={`text-xs font-black px-2 py-0.5 rounded ${isCE ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                                {data.option_strike.option_type}
                            </span>
                        </div>
                        {/* Ticket Body */}
                        <div className={`bg-gradient-to-b ${strikeTicketBg} p-5 space-y-3`}>
                            <div className="text-center pb-3 border-b border-gray-800/30">
                                <p className="text-[10px] text-gray-500 mb-1">Strike</p>
                                <p className="text-2xl font-black text-white tabular-nums">
                                    {data.option_strike.strike_label} <span className={strikeColor}>{data.option_strike.strike}</span>
                                </p>
                                <p className={`text-xs font-bold mt-1 ${data.option_strike.premium_valid ? 'text-gray-400' : 'text-rose-400 line-through'}`}>
                                    Est. Premium: ₹{data.option_strike.est_premium}
                                </p>
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-center">
                                <div className="bg-rose-500/10 rounded-xl p-2 border border-rose-500/20">
                                    <p className="text-[9px] text-gray-500 mb-0.5">SL</p>
                                    <p className="text-sm font-black text-rose-400 tabular-nums">{data.option_strike.sl_points}<span className="text-[9px] ml-0.5">pts</span></p>
                                </div>
                                <div className="bg-brand-500/10 rounded-xl p-2 border border-brand-500/20">
                                    <p className="text-[9px] text-gray-500 mb-0.5">R:R</p>
                                    <p className="text-sm font-black text-brand-400 tabular-nums">1:{Math.round(data.option_strike.target_points / data.option_strike.sl_points * 10) / 10}</p>
                                </div>
                                <div className="bg-emerald-500/10 rounded-xl p-2 border border-emerald-500/20">
                                    <p className="text-[9px] text-gray-500 mb-0.5">Target</p>
                                    <p className="text-sm font-black text-emerald-400 tabular-nums">{data.option_strike.target_points}<span className="text-[9px] ml-0.5">pts</span></p>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="rounded-2xl border border-gray-800/30 bg-gray-900/20 flex items-center justify-center">
                        <div className="text-center">
                            <p className="text-2xl mb-2">⚪</p>
                            <p className="text-xs text-gray-600 font-semibold">No trade — strike not computed</p>
                        </div>
                    </div>
                )}
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
