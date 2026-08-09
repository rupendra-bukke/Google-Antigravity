import type { ReactNode } from "react";

interface PageHeaderProps {
    eyebrow?: string;
    title: string;
    description?: string;
    actions?: ReactNode;
    align?: "left" | "center";
}

export default function PageHeader({
    eyebrow = "Trade-Craft",
    title,
    description,
    actions,
    align = "left",
}: PageHeaderProps) {
    const isCenter = align === "center";

    return (
        <header
            className={`relative overflow-hidden rounded-2xl border border-gold-500/15 bg-surface-900/80 backdrop-blur-xl shadow-terminal ${
                isCenter ? "text-center px-6 py-8" : "px-5 py-5 md:px-6 md:py-6"
            }`}
        >
            <div className="pointer-events-none absolute inset-0 bg-mesh-terminal opacity-60" />
            <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-gold-500/10 blur-3xl" />
            <div className="pointer-events-none absolute -left-6 bottom-0 h-24 w-24 rounded-full bg-brand-500/10 blur-3xl" />

            <div className={`relative ${isCenter ? "" : "flex flex-col gap-4 md:flex-row md:items-end md:justify-between"}`}>
                <div className={isCenter ? "space-y-2" : "space-y-1.5 min-w-0"}>
                    <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-gold-400/90">
                        {eyebrow}
                    </p>
                    <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white text-gradient-gold">
                        {title}
                    </h1>
                    {description && (
                        <p className={`text-sm text-gray-400 max-w-2xl ${isCenter ? "mx-auto" : ""}`}>
                            {description}
                        </p>
                    )}
                </div>
                {actions && (
                    <div className={`shrink-0 ${isCenter ? "mt-4 flex justify-center" : ""}`}>
                        {actions}
                    </div>
                )}
            </div>
        </header>
    );
}
