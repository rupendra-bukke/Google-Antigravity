interface StockHeaderProps {
    symbol: string;
    price: number;
    timestamp: string;
    isLoading: boolean;
}

const SYMBOL_NAMES: Record<string, string> = {
    "^NSEI": "NIFTY 50",
    "^NSEBANK": "Bank NIFTY",
    "^BSESN": "SENSEX",
};

const SYMBOL_EXCHANGES: Record<string, string> = {
    "^NSEI": "NSE India · Index",
    "^NSEBANK": "NSE India · Sectoral Index",
    "^BSESN": "BSE India · Index",
};

const SYMBOL_TAG: Record<string, string> = {
    "^NSEI": "NIFTY",
    "^NSEBANK": "BANKNIFTY",
    "^BSESN": "SENSEX",
};

export default function StockHeader({
    symbol,
    price,
    timestamp,
    isLoading,
}: StockHeaderProps) {
    const formattedTime = timestamp
        ? new Date(timestamp).toLocaleString("en-IN", {
            timeZone: "Asia/Kolkata",
            dateStyle: "medium",
            timeStyle: "short",
        })
        : "—";

    const displayName = SYMBOL_NAMES[symbol] || symbol;
    const exchange = SYMBOL_EXCHANGES[symbol] || "Exchange";
    const tag = SYMBOL_TAG[symbol] || symbol;

    return (
        <div className="glass-card animate-fade-in overflow-hidden">
            <div className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-end sm:justify-between">
                <div className="min-w-0">
                    <p className="section-label">{tag}</p>
                    <h2 className="mt-1 truncate text-xl font-semibold tracking-tight text-white md:text-2xl">
                        {displayName}
                    </h2>
                    <p className="mt-1 font-mono text-[11px] text-terminal-muted">{exchange}</p>
                </div>

                <div className="sm:text-right">
                    {isLoading ? (
                        <div className="space-y-2 sm:items-end">
                            <div className="h-8 w-40 shimmer bg-terminal-bg" />
                            <div className="h-3 w-28 shimmer bg-terminal-bg sm:ml-auto" />
                        </div>
                    ) : (
                        <>
                            <p className="font-mono text-2xl font-bold tabular-nums tracking-tight text-white md:text-3xl">
                                ₹{price?.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                            </p>
                            <p className="mt-1 font-mono text-[10px] text-terminal-dim">
                                Updated {formattedTime} IST
                            </p>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
