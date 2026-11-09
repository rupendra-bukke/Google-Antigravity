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
        <div className="inline-flex flex-wrap gap-1 rounded-md border border-terminal-border bg-terminal-bg p-1">
            {DASHBOARD_INDICES.map(({ label, symbol }) => {
                const isActive = selected === symbol;
                return (
                    <button
                        key={symbol}
                        type="button"
                        onClick={() => onSelect(symbol)}
                        disabled={disabled}
                        className={`rounded-md px-3 py-1.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${
                            isActive
                                ? "bg-bb-orange text-white"
                                : "text-terminal-muted hover:bg-terminal-panel hover:text-terminal-text"
                        }`}
                    >
                        {label}
                    </button>
                );
            })}
        </div>
    );
}
