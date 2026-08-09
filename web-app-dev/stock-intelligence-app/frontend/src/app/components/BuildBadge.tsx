"use client";

import { BUILD_LABEL } from "@/lib/buildLabel";

export default function BuildBadge({ className = "" }: { className?: string }) {
    return (
        <div
            className={`px-2.5 py-1 rounded-md border border-gold-500/25 bg-gold-500/5 text-[10px] font-bold tracking-[0.08em] uppercase text-gold-300/90 ${className}`}
            title={`Build ${BUILD_LABEL}`}
        >
            Build: {BUILD_LABEL}
        </div>
    );
}
