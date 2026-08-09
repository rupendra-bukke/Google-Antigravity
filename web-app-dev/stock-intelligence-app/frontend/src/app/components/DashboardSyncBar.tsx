"use client";

interface DashboardSyncBarProps {
    isSyncing: boolean;
    lastRefresh: number;
    autoRefreshSec: number;
    onSync: () => void;
}

function formatIstTime(timestamp: number): string {
    return new Date(timestamp).toLocaleTimeString("en-IN", {
        timeZone: "Asia/Kolkata",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
    });
}

export default function DashboardSyncBar({
    isSyncing,
    lastRefresh,
    autoRefreshSec,
    onSync,
}: DashboardSyncBarProps) {
    const updatedLabel =
        lastRefresh > 0 ? formatIstTime(lastRefresh) : "—";

    return (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-t border-terminal-border pt-2 mt-2">
            <div className="flex items-center gap-2 min-w-0 font-mono text-[10px]">
                <button type="button" onClick={onSync} disabled={isSyncing} className="btn-primary">
                    {isSyncing ? "SYNC..." : "SYNC"}
                </button>
                <span className="text-terminal-dim">|</span>
                <span className="text-terminal-muted">
                    LAST <span className="text-bb-orange">{updatedLabel}</span> IST
                </span>
                <span className="text-terminal-dim hidden sm:inline">|</span>
                <span className="text-terminal-dim hidden sm:inline">
                    AUTO {Math.round(autoRefreshSec / 60)}M
                </span>
            </div>
            <span className="text-[9px] font-mono font-bold uppercase text-bb-green tracking-wider">
                ● LIVE
            </span>
        </div>
    );
}
