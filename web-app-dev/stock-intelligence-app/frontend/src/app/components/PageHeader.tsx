import type { ReactNode } from "react";

interface PageHeaderProps {
    /** Short module label shown in the top rail, e.g. "Dashboard" */
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
        <header className="terminal-header">
            <div className="terminal-header-rail">
                <div className="terminal-header-brand">
                    <span className="terminal-header-mark" aria-hidden>
                        TC
                    </span>
                    <span className="terminal-header-product">Trade-Craft</span>
                    <span className="text-terminal-border select-none">/</span>
                    <span className="terminal-header-module">{moduleLabel}</span>
                </div>
                {actions && <div className="terminal-header-actions">{actions}</div>}
            </div>

            <div className="terminal-header-body">
                <h1 className="terminal-header-title">{title}</h1>
                {description && <p className="terminal-header-desc">{description}</p>}
            </div>
        </header>
    );
}
