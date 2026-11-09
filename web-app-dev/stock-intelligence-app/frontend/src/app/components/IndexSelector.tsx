"use client";

import { DASHBOARD_INDICES } from "@/lib/indices";

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
        <div className="inline-flex flex-wrap gap-1 rounded-full border border-terminal-border bg-terminal-bg/80 p-1">
            {DASHBOARD_INDICES.map(({ label, symbol }) => {
                const isActive = selected === symbol;
                return (
                    <button
                        key={symbol}
                        type="button"
                        onClick={() => onSelect(symbol)}
                        disabled={disabled}
                        className={`rounded-full px-3 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${
                            isActive
                                ? "bg-bb-orange text-white"
                                : "text-terminal-muted hover:bg-white/5 hover:text-white"
                        }`}
                    >
                        {label}
                    </button>
                );
            })}
        </div>
    );
}
