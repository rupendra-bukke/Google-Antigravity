import { normalizeDashboardSymbol } from "@/lib/indices";

export interface UserSettings {
    defaultSymbol: string;
    dashboardRefreshSec: number;
}

export const DEFAULT_SETTINGS: UserSettings = {
    defaultSymbol: "^NSEI",
    dashboardRefreshSec: 180,
};

const STORAGE_KEY = "trade-craft-settings";
const VALID_REFRESH = new Set([60, 120, 180, 300]);

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
            dashboardRefreshSec: VALID_REFRESH.has(parsed.dashboardRefreshSec ?? 0)
                ? (parsed.dashboardRefreshSec as number)
                : DEFAULT_SETTINGS.dashboardRefreshSec,
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
        })
    );
}

export function resetUserSettings(): UserSettings {
    if (typeof window !== "undefined") {
        window.localStorage.removeItem(STORAGE_KEY);
    }
    return { ...DEFAULT_SETTINGS };
}
