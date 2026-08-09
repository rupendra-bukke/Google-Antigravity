"use client";

import { BUILD_LABEL } from "@/lib/buildLabel";

export default function BuildBadge({ className = "" }: { className?: string }) {
    return (
        <div
            className={`inline-block border border-terminal-border bg-terminal-bg px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-terminal-dim ${className}`}
            title={`Build ${BUILD_LABEL}`}
        >
            {BUILD_LABEL}
        </div>
    );
}
