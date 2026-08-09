import { normalizeDashboardSymbol } from "@/lib/indices";

export interface UserSettings {
    defaultSymbol: string;
    dashboardRefreshSec: number;
    checkpointRefreshSec: number;
    checkpointCatchupSec: number;
    showCandlestickChart: boolean;
    watchlistSymbols: string[];
}

export const DEFAULT_WATCHLIST_SYMBOLS = [
    "^NSEI",
    "^NSEBANK",
    "^BSESN",
    "JPPOWER.NS",
];

export const DEFAULT_SETTINGS: UserSettings = {
    defaultSymbol: "^NSEI",
    dashboardRefreshSec: 180,
    checkpointRefreshSec: 120,
    checkpointCatchupSec: 30,
    showCandlestickChart: false,
    watchlistSymbols: [...DEFAULT_WATCHLIST_SYMBOLS],
};

const STORAGE_KEY = "trade-craft-settings";
const VALID_DASHBOARD_REFRESH = new Set([60, 120, 180, 300]);
const VALID_CHECKPOINT_REFRESH = new Set([60, 120, 180, 300]);
const VALID_CATCHUP_REFRESH = new Set([30, 60]);

function normalizeWatchlistSymbols(symbols: unknown): string[] {
    if (!Array.isArray(symbols)) return [...DEFAULT_WATCHLIST_SYMBOLS];
    const cleaned = symbols
        .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
        .map((item) => item.trim());
    return cleaned.length > 0 ? cleaned : [...DEFAULT_WATCHLIST_SYMBOLS];
}

export function loadUserSettings(): UserSettings {
    if (typeof window === "undefined") {
        return { ...DEFAULT_SETTINGS };
    }

    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return { ...DEFAULT_SETTINGS };

        const parsed = JSON.parse(raw) as Partial<UserSettings>;
        return {
            defaultSymbol: normalizeDashboardSymbol(parsed.defaultSymbol),
            dashboardRefreshSec: VALID_DASHBOARD_REFRESH.has(parsed.dashboardRefreshSec ?? 0)
                ? (parsed.dashboardRefreshSec as number)
                : DEFAULT_SETTINGS.dashboardRefreshSec,
            checkpointRefreshSec: VALID_CHECKPOINT_REFRESH.has(parsed.checkpointRefreshSec ?? 0)
                ? (parsed.checkpointRefreshSec as number)
                : DEFAULT_SETTINGS.checkpointRefreshSec,
            checkpointCatchupSec: VALID_CATCHUP_REFRESH.has(parsed.checkpointCatchupSec ?? 0)
                ? (parsed.checkpointCatchupSec as number)
                : DEFAULT_SETTINGS.checkpointCatchupSec,
            showCandlestickChart: parsed.showCandlestickChart === true,
            watchlistSymbols: normalizeWatchlistSymbols(parsed.watchlistSymbols),
        };
    } catch {
        return { ...DEFAULT_SETTINGS };
    }
}

export function saveUserSettings(settings: UserSettings): void {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
            ...settings,
            defaultSymbol: normalizeDashboardSymbol(settings.defaultSymbol),
            watchlistSymbols: normalizeWatchlistSymbols(settings.watchlistSymbols),
        })
    );
}

export function resetUserSettings(): UserSettings {
    if (typeof window !== "undefined") {
        window.localStorage.removeItem(STORAGE_KEY);
    }
    return { ...DEFAULT_SETTINGS };
}
