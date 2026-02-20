"use client";

interface MarketStatusBannerProps {
    isOpen: boolean;
    message: string;
}

export default function MarketStatusBanner({ isOpen, message }: MarketStatusBannerProps) {
    if (isOpen) return null;

    return (
        <div className="w-full mb-6 animate-slide-down">
            <div className="relative overflow-hidden group">
                {/* Glass effect with amber gradient */}
                <div className="absolute inset-0 bg-gradient-to-r from-amber-500/20 via-orange-500/20 to-amber-500/20 glass-morphism rounded-2xl" />

                {/* Animated pulse background */}
                <div className="absolute inset-0 bg-amber-500/5 animate-pulse rounded-2xl" />

                <div className="relative px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4 border border-amber-500/30 rounded-2xl">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center border border-amber-500/40">
                            <span className="text-2xl animate-bounce">🌙</span>
                        </div>
                        <div>
                            <h3 className="text-lg font-black text-amber-400 uppercase tracking-tight">
                                Indian Market is Closed
                            </h3>
                            <p className="text-xs text-amber-200/60 font-medium">
                                {message}
                            </p>
                        </div>
                    </div>

                    <div className="px-5 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[10px] font-bold text-amber-400/80 uppercase tracking-widest text-center sm:text-left">
                        Analysis based on <span className="text-amber-200">Historical Data</span>
                    </div>
                </div>

                {/* Glossy overlay */}
                <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-white/5 to-transparent pointer-events-none" />
            </div>
        </div>
    );
}
