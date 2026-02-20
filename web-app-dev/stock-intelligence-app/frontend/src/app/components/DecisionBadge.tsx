"use client";

interface DecisionBadgeProps {
    decision: string | null;
    reasoning: string[];
    isLoading: boolean;
}

export default function DecisionBadge({
    decision,
    reasoning,
    isLoading,
}: DecisionBadgeProps) {
    const isBuy = decision === "BUY";
    const isSell = decision === "SELL";

    const decisionClass = isBuy ? "decision-buy" : isSell ? "decision-sell" : "decision-hold";
    const decisionEmoji = isBuy ? "🟢" : isSell ? "🔴" : "🟡";
    const decisionSubtext = isBuy
        ? "Bullish signals detected — consider a long entry"
        : isSell
            ? "Bearish signals detected — consider a short entry"
            : "Mixed signals — stay flat & wait for clarity";

    const glowColor = isBuy ? "bg-emerald-500/5" : isSell ? "bg-rose-500/5" : "bg-amber-500/5";
    const borderColor = isBuy ? "border-emerald-500" : isSell ? "border-rose-500" : "border-amber-500";

    const reasonIcons: Record<number, string> = { 0: "📊", 1: "📈", 2: "🎯", 3: "⚡", 4: "🔍", 5: "📉" };

    return (
        <div className="glass-card p-6 md:p-8 animate-slide-up relative overflow-hidden">
            {/* Background glow */}
            <div className={`absolute -bottom-20 -right-20 w-64 h-64 ${glowColor} rounded-full blur-3xl pointer-events-none`} />

            <p className="section-label mb-5">Intraday Decision</p>

            {isLoading ? (
                <div className="space-y-3">
                    <div className="h-16 w-44 rounded-2xl bg-gray-800/60 shimmer" />
                    <div className="h-4 w-full rounded bg-gray-800/40 shimmer" />
                    <div className="h-4 w-3/4 rounded bg-gray-800/40 shimmer" />
                </div>
            ) : (
                <div className="relative space-y-6">
                    {/* Decision Badge with left border */}
                    <div className={`pl-4 border-l-4 ${borderColor} rounded-r-xl`}>
                        <span className={`inline-flex items-center gap-3 px-6 py-3.5 rounded-xl text-2xl font-black tracking-wide ${decisionClass}`}>
                            <span className="text-2xl">{decisionEmoji}</span>
                            {decision || "—"}
                        </span>
                        <p className="text-xs text-gray-500 mt-2 ml-1 font-medium">{decisionSubtext}</p>
                    </div>

                    {/* Reasoning — pill-numbered steps */}
                    {reasoning.length > 0 && (
                        <div>
                            <p className="section-label mb-3">Reasoning</p>
                            <div className="space-y-2">
                                {reasoning.map((reason, i) => (
                                    <div
                                        key={i}
                                        className="flex items-start gap-3 p-3 rounded-xl bg-gray-800/20 border border-gray-800/30 group hover:bg-gray-800/30 hover:border-gray-700/50 transition-all duration-200"
                                        style={{ animationDelay: `${i * 60}ms` }}
                                    >
                                        <span className="shrink-0 w-6 h-6 rounded-lg bg-brand-500/15 border border-brand-500/20 flex items-center justify-center text-[10px] font-black text-brand-400">
                                            {reasonIcons[i] || "💡"}
                                        </span>
                                        <p className="text-sm text-gray-300 leading-relaxed">{reason}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
