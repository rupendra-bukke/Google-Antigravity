import type { ReactNode } from "react";

interface PageHeaderProps {
    /** Short module label shown above the page title, e.g. "Dashboard" */
    module?: string;
    title: string;
    description?: string;
    actions?: ReactNode;
}

export default function PageHeader({
    module,
    title,
    description,
    actions,
}: PageHeaderProps) {
    const moduleLabel = module ?? title;

    return (
        <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
                <p className="section-label">{moduleLabel}</p>
                <h1 className="mt-1 text-2xl font-semibold tracking-tight text-terminal-text md:text-[1.65rem]">{title}</h1>
                {description && (
                    <p className="mt-1.5 max-w-2xl text-sm text-terminal-muted">{description}</p>
                )}
            </div>
            {actions && <div className="shrink-0">{actions}</div>}
        </header>
    );
}
