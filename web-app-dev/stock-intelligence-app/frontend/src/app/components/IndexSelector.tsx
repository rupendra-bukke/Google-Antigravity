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
        <div className="inline-flex flex-wrap border border-terminal-border bg-terminal-bg">
            {DASHBOARD_INDICES.map(({ label, symbol }) => {
                const isActive = selected === symbol;
                return (
                    <button
                        key={symbol}
                        type="button"
                        onClick={() => onSelect(symbol)}
                        disabled={disabled}
                        className={`
                            px-2.5 py-1 text-[10px] font-mono font-bold uppercase tracking-wide
                            border-r border-terminal-border last:border-r-0
                            transition-colors disabled:opacity-40 disabled:cursor-not-allowed
                            ${isActive
                                ? "bg-bb-orange text-black"
                                : "text-terminal-muted hover:text-bb-orange hover:bg-bb-orange/10"
                            }
                        `}
                    >
                        {label}
                    </button>
                );
            })}
        </div>
    );
}
