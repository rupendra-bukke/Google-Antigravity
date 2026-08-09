"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
    DEFAULT_SETTINGS,
    loadUserSettings,
    resetUserSettings,
    saveUserSettings,
    type UserSettings,
} from "@/lib/userSettings";

interface SettingsContextValue {
    settings: UserSettings;
    updateSettings: (patch: Partial<UserSettings>) => void;
    resetSettings: () => void;
    hydrated: boolean;
}

const SettingsContext = createContext<SettingsContextValue | undefined>(undefined);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
    const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
    const [hydrated, setHydrated] = useState(false);

    useEffect(() => {
        setSettings(loadUserSettings());
        setHydrated(true);
    }, []);

    const value = useMemo<SettingsContextValue>(
        () => ({
            settings,
            hydrated,
            updateSettings: (patch) => {
                setSettings((prev) => {
                    const next = { ...prev, ...patch };
                    saveUserSettings(next);
                    return next;
                });
            },
            resetSettings: () => {
                const next = resetUserSettings();
                setSettings(next);
            },
        }),
        [settings, hydrated]
    );

    return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
    const context = useContext(SettingsContext);
    if (!context) {
        throw new Error("useSettings must be used inside SettingsProvider");
    }
    return context;
}
