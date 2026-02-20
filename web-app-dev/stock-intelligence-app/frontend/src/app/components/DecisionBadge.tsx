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
    const decisionClass =
        decision === "BUY"
            ? "decision-buy"
            : decision === "SELL"
                ? "decision-sell"
                : "decision-hold";

    const decisionEmoji =
        decision === "BUY" ? "🟢" : decision === "SELL" ? "🔴" : "🟡";

    const decisionSubtext =
        decision === "BUY"
            ? "Bullish signals detected"
            : decision === "SELL"
                ? "Bearish signals detected"
                : "Mixed signals — stay cautious";

    return (
        <div className="glass-card p-6 md:p-8 animate-slide-up relative overflow-hidden">
            {/* Background glow for decision */}
            {decision === "BUY" && (
                <div className="absolute -bottom-20 -right-20 w-60 h-60 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
            )}
            {decision === "SELL" && (
                <div className="absolute -bottom-20 -right-20 w-60 h-60 bg-rose-500/5 rounded-full blur-3xl pointer-events-none" />
            )}
            {decision === "HOLD" && (
                <div className="absolute -bottom-20 -right-20 w-60 h-60 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
            )}

            <p className="section-label mb-5">Intraday Decision</p>

            {isLoading ? (
                <div className="space-y-3">
                    <div className="h-16 w-44 rounded-2xl bg-gray-800/60 shimmer" />
                    <div className="h-4 w-full rounded bg-gray-800/40 shimmer" />
                    <div className="h-4 w-3/4 rounded bg-gray-800/40 shimmer" />
                </div>
            ) : (
                <div className="relative">
                    {/* Decision Badge */}
                    <div className="mb-2">
                        <span
                            className={`
                inline-flex items-center gap-3 px-7 py-4 rounded-2xl
                text-2xl font-black tracking-wide
                ${decisionClass}
              `}
                        >
                            <span className="text-2xl">{decisionEmoji}</span>
                            {decision || "—"}
                        </span>
                    </div>
                    <p className="text-xs text-gray-500 mb-6 font-medium">
                        {decisionSubtext}
                    </p>

                    {/* Reasoning */}
                    <div className="space-y-2.5">
                        <p className="section-label">Reasoning</p>
                        <ul className="space-y-2">
                            {reasoning.map((reason, i) => (
                                <li
                                    key={i}
                                    className="flex items-start gap-2.5 text-sm text-gray-300 leading-relaxed"
                                    style={{ animationDelay: `${i * 60}ms` }}
                                >
                                    <span className="text-brand-500/70 mt-0.5 shrink-0 text-xs">●</span>
                                    {reason}
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            )}
        </div>
    );
}
