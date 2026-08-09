import type { ReactNode } from "react";

interface PageHeaderProps {
    eyebrow?: string;
    title: string;
    description?: string;
    actions?: ReactNode;
}

export default function PageHeader({
    eyebrow = "TRADE-CRAFT",
    title,
    description,
    actions,
}: PageHeaderProps) {
    return (
        <header className="terminal-header">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0 flex items-start gap-3">
                    <div className="hidden sm:block w-1 self-stretch bg-bb-orange shrink-0" />
                    <div className="min-w-0">
                        <p className="text-[9px] font-mono font-bold uppercase tracking-[0.2em] text-bb-orange">
                            {eyebrow}
                        </p>
                        <h1 className="text-base md:text-lg font-bold uppercase tracking-wide text-white font-mono">
                            {title}
                        </h1>
                        {description && (
                            <p className="text-[11px] text-terminal-muted mt-0.5 max-w-3xl leading-relaxed">
                                {description}
                            </p>
                        )}
                    </div>
                </div>
                {actions && <div className="shrink-0">{actions}</div>}
            </div>
        </header>
    );
}
