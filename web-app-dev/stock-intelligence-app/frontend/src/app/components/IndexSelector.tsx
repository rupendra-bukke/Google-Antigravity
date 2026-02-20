"use client";

const INDICES = [
    { label: "NIFTY 50", symbol: "^NSEI", emoji: "🇮🇳" },
    { label: "Bank NIFTY", symbol: "^NSEBANK", emoji: "🏦" },
    { label: "SENSEX", symbol: "^BSESN", emoji: "📊" },
];

interface IndexSelectorProps {
    selected: string;
    onSelect: (symbol: string) => void;
    disabled?: boolean;
}

export default function IndexSelector({
    selected,
    onSelect,
    disabled,
}: IndexSelectorProps) {
    return (
        <div className="flex flex-wrap gap-2">
            {INDICES.map(({ label, symbol, emoji }) => {
                const isActive = selected === symbol;
                return (
                    <button
                        key={symbol}
                        onClick={() => onSelect(symbol)}
                        disabled={disabled}
                        className={`
              px-4 py-2.5 rounded-xl text-sm font-semibold
              transition-all duration-200
              disabled:opacity-40 disabled:cursor-not-allowed
              ${isActive
                                ? "glass-card bg-brand-500/15 text-brand-400 border-brand-500/30 shadow-lg shadow-brand-500/10"
                                : "bg-gray-800/40 text-gray-400 border border-gray-700/50 hover:bg-gray-800/70 hover:text-gray-200"
                            }
            `}
                    >
                        <span className="mr-1.5">{emoji}</span>
                        {label}
                    </button>
                );
            })}
        </div>
    );
}
