"use client";

interface MarketStatusBannerProps {
    isOpen: boolean;
    message: string;
}

export default function MarketStatusBanner({ isOpen, message }: MarketStatusBannerProps) {
    if (isOpen) return null;

    return (
        <div className="flex flex-col gap-2 rounded-lg border border-bb-amber/40 bg-bb-amber/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-bb-amber">
                    Market closed
                </p>
                <p className="mt-0.5 font-mono text-[12px] text-terminal-text">{message}</p>
            </div>
            <p className="shrink-0 font-mono text-[10px] font-bold uppercase tracking-widest text-bb-amber/80">
                Historical data
            </p>
        </div>
    );
}
