interface TradeCraftBrandProps {
    size?: "sm" | "md" | "lg";
    showTagline?: boolean;
    className?: string;
}

const SIZE_STYLES = {
    sm: {
        logo: "h-8 w-8",
        name: "text-sm",
        tagline: "text-[9px]",
        gap: "gap-2",
    },
    md: {
        logo: "h-10 w-10",
        name: "text-lg md:text-xl",
        tagline: "text-[10px]",
        gap: "gap-2.5",
    },
    lg: {
        logo: "h-11 w-11 md:h-12 md:w-12",
        name: "text-xl md:text-2xl",
        tagline: "text-[10px] md:text-[11px]",
        gap: "gap-3",
    },
} as const;

export default function TradeCraftBrand({
    size = "md",
    showTagline = true,
    className = "",
}: TradeCraftBrandProps) {
    const styles = SIZE_STYLES[size];

    return (
        <div className={`flex items-center min-w-0 ${styles.gap} ${className}`}>
            <div className="relative shrink-0">
                <div
                    className="absolute inset-0 rounded-lg bg-bb-orange/25 blur-md scale-110"
                    aria-hidden
                />
                <img
                    src="/assets/trade-craft-logo.png"
                    alt="Trade-Craft logo"
                    className={`relative ${styles.logo} rounded-lg object-cover border border-bb-orange/50 shadow-[0_0_12px_rgba(255,119,0,0.15)]`}
                />
            </div>
            <div className="min-w-0">
                <p className={`${styles.name} font-bold tracking-tight leading-none text-white`}>
                    Trade<span className="text-bb-orange">-</span>Craft
                </p>
                {showTagline && (
                    <p
                        className={`${styles.tagline} font-data font-semibold uppercase tracking-[0.16em] text-terminal-muted mt-1`}
                    >
                        NSE Intelligence
                    </p>
                )}
            </div>
        </div>
    );
}
