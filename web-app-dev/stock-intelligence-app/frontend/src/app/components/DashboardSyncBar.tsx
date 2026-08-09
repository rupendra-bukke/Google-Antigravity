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
        lastRefresh > 0 ? `Updated ${formatIstTime(lastRefresh)} IST` : "Waiting for first sync";

    return (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 w-full">
            <div className="flex items-center gap-2 min-w-0">
                <button
                    type="button"
                    onClick={onSync}
                    disabled={isSyncing}
                    className="inline-flex items-center gap-2 rounded-xl border border-brand-500/30 bg-brand-500/10 px-3.5 py-2 text-xs font-bold text-brand-200 transition-all hover:bg-brand-500/20 hover:border-brand-400/40 disabled:opacity-60 disabled:cursor-not-allowed shrink-0"
                    title="Sync dashboard, AI panel, and timeline"
                >
                    <svg
                        className={`h-4 w-4 ${isSyncing ? "animate-spin" : ""}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2.2}
                            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                        />
                    </svg>
                    <span>{isSyncing ? "Syncing…" : "Sync now"}</span>
                </button>

                <div className="min-w-0">
                    <p className="text-[11px] font-semibold text-gray-300 truncate">{updatedLabel}</p>
                    <p className="text-[10px] text-gray-500 truncate">
                        Auto-refresh every {Math.round(autoRefreshSec / 60)} min · syncs price, AI, and timeline
                    </p>
                </div>
            </div>

            <div className="hidden sm:flex items-center gap-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-2.5 py-1 shrink-0">
                <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                </span>
                <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-300/90">
                    Live
                </span>
            </div>
        </div>
    );
}
