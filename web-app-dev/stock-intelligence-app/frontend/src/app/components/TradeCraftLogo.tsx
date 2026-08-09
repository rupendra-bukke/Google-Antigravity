interface TradeCraftLogoProps {
    size?: "sm" | "md" | "lg";
    className?: string;
}

const SIZE_CLASSES = {
    sm: "h-8 w-8",
    md: "h-10 w-10",
    lg: "h-12 w-12 md:h-14 md:w-14",
} as const;

const SIZE_PX = {
    sm: 32,
    md: 40,
    lg: 56,
} as const;

export default function TradeCraftLogo({ size = "md", className = "" }: TradeCraftLogoProps) {
    const px = SIZE_PX[size];

    return (
        <div className={`relative shrink-0 ${className}`}>
            <img
                src="/assets/trade-craft-logo.png"
                srcSet="/assets/trade-craft-logo-64.png 64w, /assets/trade-craft-logo-128.png 128w, /assets/trade-craft-logo-256.png 256w, /assets/trade-craft-logo.png 512w, /assets/trade-craft-logo@2x.png 1024w"
                sizes={`${px}px`}
                width={px}
                height={px}
                alt="Trade-Craft logo"
                decoding="async"
                className={`${SIZE_CLASSES[size]} rounded-xl object-contain border border-bb-orange/40 bg-[#0d1528] shadow-[0_0_16px_rgba(255,119,0,0.12)]`}
            />
        </div>
    );
}
