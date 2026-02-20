interface IndicatorCardProps {
    label: string;
    value: number | string | null;
    description: string;
    icon: string;
    color: "indigo" | "emerald" | "cyan" | "amber" | "rose" | "violet";
    isLoading: boolean;
}

const colorMap = {
    indigo: {
        bg: "from-brand-500/10 to-brand-600/5",
        border: "border-brand-500/20",
        text: "text-brand-400",
        glow: "shadow-brand-500/10",
        icon: "bg-brand-500/15 text-brand-400",
    },
    emerald: {
        bg: "from-emerald-500/10 to-emerald-600/5",
        border: "border-emerald-500/20",
        text: "text-emerald-400",
        glow: "shadow-emerald-500/10",
        icon: "bg-emerald-500/15 text-emerald-400",
    },
    cyan: {
        bg: "from-cyan-500/10 to-cyan-600/5",
        border: "border-cyan-500/20",
        text: "text-cyan-400",
        glow: "shadow-cyan-500/10",
        icon: "bg-cyan-500/15 text-cyan-400",
    },
    amber: {
        bg: "from-amber-500/10 to-amber-600/5",
        border: "border-amber-500/20",
        text: "text-amber-400",
        glow: "shadow-amber-500/10",
        icon: "bg-amber-500/15 text-amber-400",
    },
    rose: {
        bg: "from-rose-500/10 to-rose-600/5",
        border: "border-rose-500/20",
        text: "text-rose-400",
        glow: "shadow-rose-500/10",
        icon: "bg-rose-500/15 text-rose-400",
    },
    violet: {
        bg: "from-violet-500/10 to-violet-600/5",
        border: "border-violet-500/20",
        text: "text-violet-400",
        glow: "shadow-violet-500/10",
        icon: "bg-violet-500/15 text-violet-400",
    },
};

export default function IndicatorCard({
    label,
    value,
    description,
    icon,
    color,
    isLoading,
}: IndicatorCardProps) {
    const c = colorMap[color];

    const formattedValue =
        typeof value === "number"
            ? value.toLocaleString("en-IN", { minimumFractionDigits: 2 })
            : value ?? "—";

    // Calculate fill bar percentage for numeric RSI-like values (0–100)
    const fillPct =
        typeof value === "number" && value >= 0 && value <= 100
            ? Math.min(100, Math.max(0, value))
            : null;

    return (
        <div
            className={`
        glass-card overflow-hidden border ${c.border}
        bg-gradient-to-br ${c.bg}
        hover:scale-[1.02] hover:shadow-xl transition-all duration-300
        animate-slide-up shadow-lg ${c.glow}
      `}
        >
            {/* Color-coded top accent bar */}
            <div className={`h-0.5 w-full bg-gradient-to-r ${c.bg.replace("from-", "from-").replace("to-", "to-")} opacity-60`}
                style={{ background: `linear-gradient(to right, var(--tw-gradient-from), var(--tw-gradient-to))` }} />

            <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                    <div className={`w-10 h-10 rounded-xl ${c.icon} flex items-center justify-center text-lg shrink-0`}>
                        {icon}
                    </div>
                    {fillPct !== null && !isLoading && (
                        <span className={`text-[10px] font-black ${c.text} px-2 py-0.5 rounded-lg ${c.icon.split(" ")[0]}`}>
                            {Math.round(fillPct)}
                        </span>
                    )}
                </div>

                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                    {label}
                </p>

                {isLoading ? (
                    <div className="h-8 w-24 rounded-lg bg-gray-800 shimmer mt-1" />
                ) : (
                    <p className={`text-2xl font-extrabold ${c.text} tabular-nums`}>
                        {formattedValue}
                    </p>
                )}

                {/* Fill bar for RSI-style numeric values */}
                {fillPct !== null && !isLoading && (
                    <div className="mt-3 h-1 bg-gray-800/50 rounded-full overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all duration-700 ${fillPct > 70 ? "bg-rose-400" : fillPct < 30 ? "bg-emerald-400" : `bg-amber-400`
                                }`}
                            style={{ width: `${fillPct}%` }}
                        />
                    </div>
                )}

                <p className="text-xs text-gray-500 mt-3 leading-relaxed">
                    {description}
                </p>
            </div>
        </div>
    );
}
