import TradeCraftLogo from "./TradeCraftLogo";

interface TradeCraftBrandProps {
    size?: "sm" | "md" | "lg";
    showTagline?: boolean;
    className?: string;
}

const TEXT_STYLES = {
    sm: {
        name: "text-sm",
        tagline: "text-[9px]",
        gap: "gap-2",
    },
    md: {
        name: "text-lg md:text-xl",
        tagline: "text-[10px]",
        gap: "gap-2.5",
    },
    lg: {
        name: "text-xl md:text-2xl lg:text-[1.75rem]",
        tagline: "text-[10px] md:text-[11px]",
        gap: "gap-3",
    },
} as const;

export default function TradeCraftBrand({
    size = "md",
    showTagline = true,
    className = "",
}: TradeCraftBrandProps) {
    const styles = TEXT_STYLES[size];

    return (
        <div className={`flex items-center min-w-0 ${styles.gap} ${className}`}>
            <TradeCraftLogo size={size} />
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
