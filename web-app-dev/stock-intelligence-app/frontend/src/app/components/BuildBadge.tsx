"use client";

import { BUILD_LABEL } from "@/lib/buildLabel";

export default function BuildBadge({ className = "" }: { className?: string }) {
    return (
        <div
            className={`inline-block rounded-md border border-terminal-border bg-terminal-bg px-2 py-1 font-mono text-[9px] tracking-wide text-terminal-dim ${className}`}
            title={`Build ${BUILD_LABEL}`}
        >
            {BUILD_LABEL}
        </div>
    );
}
