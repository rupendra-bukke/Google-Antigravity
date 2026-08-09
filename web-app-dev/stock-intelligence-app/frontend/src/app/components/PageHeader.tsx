import type { ReactNode } from "react";
import TradeCraftBrand from "./TradeCraftBrand";

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
        <header className="terminal-header">
            <div className="terminal-header-inner">
                <div className="terminal-header-brand-zone">
                    <TradeCraftBrand size="lg" />
                </div>

                <div className="terminal-header-page-zone">
                    <div className="terminal-header-top-row">
                        <div className="min-w-0 flex-1">
                            <p className="terminal-header-module">
                                <span className="terminal-header-module-dot" aria-hidden />
                                {moduleLabel}
                            </p>
                            <h1 className="terminal-header-title">{title}</h1>
                        </div>
                        {actions && <div className="terminal-header-actions">{actions}</div>}
                    </div>
                    {description && <p className="terminal-header-desc">{description}</p>}
                </div>
            </div>
        </header>
    );
}
