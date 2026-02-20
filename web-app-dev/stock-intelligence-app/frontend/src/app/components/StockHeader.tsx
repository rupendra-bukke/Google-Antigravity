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

    return (
        <div className="glass-card p-6 md:p-8 animate-fade-in relative overflow-hidden">
            {/* Subtle gradient accent */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-brand-500/5 to-transparent rounded-full -translate-y-32 translate-x-32 pointer-events-none" />

            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 relative">
                <div>
                    <div className="flex items-center gap-2 mb-3">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                        </span>
                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em]">
                            Live Intraday
                        </span>
                    </div>
                    <h2 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
                        {displayName}
                    </h2>
                    <p className="text-[11px] text-gray-500 mt-1 font-medium">{exchange}</p>
                </div>

                <div className="text-left md:text-right">
                    {isLoading ? (
                        <div className="h-10 w-44 rounded-xl bg-gray-800/60 shimmer" />
                    ) : (
                        <>
                            <p className="text-3xl md:text-4xl font-black text-white tabular-nums tracking-tight">
                                ₹{price?.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                            </p>
                            <p className="text-[10px] text-gray-500 mt-1.5 font-medium">
                                Last updated · {formattedTime}
                            </p>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
