"use client";

import { authedFetch } from "@/lib/authedFetch";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { usePageVisible } from "@/hooks/usePageVisible";

export interface ExpiryCalendarCard {
    abbr: string;
    next_expiry: string;
    days_to_next?: number;
    expiry_type?: string;
    expiry_today?: boolean;
}

interface ExpiryCalendarContextValue {
    cardsByAbbr: Record<string, ExpiryCalendarCard>;
    loading: boolean;
    refresh: () => Promise<void>;
}

const STORAGE_KEY = "trade-craft-expiry-calendar";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const REFRESH_MS = 60 * 60 * 1000;

const ExpiryCalendarContext = createContext<ExpiryCalendarContextValue | undefined>(undefined);

function readCache(): Record<string, ExpiryCalendarCard> | null {
    if (typeof window === "undefined") return null;
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as { savedAt: number; cards: Record<string, ExpiryCalendarCard> };
        if (!parsed?.savedAt || Date.now() - parsed.savedAt > CACHE_TTL_MS) return null;
        return parsed.cards ?? null;
    } catch {
        return null;
    }
}

function writeCache(cards: Record<string, ExpiryCalendarCard>) {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ savedAt: Date.now(), cards })
    );
}

export function ExpiryCalendarProvider({ children }: { children: React.ReactNode }) {
    const visible = usePageVisible();
    const [cardsByAbbr, setCardsByAbbr] = useState<Record<string, ExpiryCalendarCard>>({});
    const [loading, setLoading] = useState(true);

    const refresh = useCallback(async () => {
        try {
            const res = await authedFetch("/api/v1/expiry-calendar", { cache: "no-store" });
            if (!res.ok) return;
            const data = await res.json();
            const cards = Array.isArray(data.cards) ? data.cards : [];
            const nextMap: Record<string, ExpiryCalendarCard> = {};
            for (const card of cards) {
                if (!card || typeof card.abbr !== "string" || typeof card.next_expiry !== "string") continue;
                nextMap[card.abbr.toUpperCase()] = card;
            }
            if (Object.keys(nextMap).length > 0) {
                setCardsByAbbr(nextMap);
                writeCache(nextMap);
            }
        } catch {
            // Keep cached/fallback data.
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        const cached = readCache();
        if (cached) {
            setCardsByAbbr(cached);
            setLoading(false);
        }
        void refresh();
    }, [refresh]);

    useEffect(() => {
        if (!visible) return;
        const timer = setInterval(() => void refresh(), REFRESH_MS);
        return () => clearInterval(timer);
    }, [visible, refresh]);

    const value = useMemo(
        () => ({ cardsByAbbr, loading, refresh }),
        [cardsByAbbr, loading, refresh]
    );

    return <ExpiryCalendarContext.Provider value={value}>{children}</ExpiryCalendarContext.Provider>;
}

export function useExpiryCalendar() {
    const context = useContext(ExpiryCalendarContext);
    if (!context) {
        throw new Error("useExpiryCalendar must be used inside ExpiryCalendarProvider");
    }
    return context;
}
