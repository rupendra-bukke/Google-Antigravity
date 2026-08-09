"use client";

import { useEffect, useMemo, useState } from "react";
import { authedFetch } from "@/lib/authedFetch";
import { DASHBOARD_INDICES } from "@/lib/indices";
import { DEFAULT_WATCHLIST_SYMBOLS } from "@/lib/userSettings";
import { useSettings } from "../context/SettingsContext";
import { useSymbol } from "../context/SymbolContext";
import PageHeader from "../components/PageHeader";

const REFRESH_OPTIONS = [
    { label: "1 minute", value: 60 },
    { label: "2 minutes", value: 120 },
    { label: "3 minutes", value: 180 },
    { label: "5 minutes", value: 300 },
];

const CHECKPOINT_REFRESH_OPTIONS = [
    { label: "1 minute", value: 60 },
    { label: "2 minutes (default)", value: 120 },
    { label: "3 minutes", value: 180 },
    { label: "5 minutes", value: 300 },
];

const CATCHUP_REFRESH_OPTIONS = [
    { label: "30 seconds (default)", value: 30 },
    { label: "1 minute", value: 60 },
];

interface FocusOption {
    symbol: string;
    label: string;
    kind: "index" | "stock";
}

export default function SettingsPage() {
    const { settings, updateSettings, resetSettings, hydrated } = useSettings();
    const { setSelectedSymbol } = useSymbol();
    const [savedToast, setSavedToast] = useState(false);
    const [poolOptions, setPoolOptions] = useState<FocusOption[]>([]);

    useEffect(() => {
        if (!savedToast) return;
        const timer = setTimeout(() => setSavedToast(false), 2000);
        return () => clearTimeout(timer);
    }, [savedToast]);

    useEffect(() => {
        authedFetch("/api/v1/market-focus-options", { cache: "no-store" })
            .then((res) => (res.ok ? res.json() : null))
            .then((json) => {
                if (json?.items) setPoolOptions(json.items);
            })
            .catch(() => {
                setPoolOptions([]);
            });
    }, []);

    const watchlistPool = useMemo(() => {
        if (poolOptions.length > 0) return poolOptions;
        return DEFAULT_WATCHLIST_SYMBOLS.map((symbol) => {
            const index = DASHBOARD_INDICES.find((item) => item.symbol === symbol);
            if (index) return { symbol, label: index.label, kind: "index" as const };
            return { symbol, label: symbol.replace(".NS", ""), kind: "stock" as const };
        });
    }, [poolOptions]);

    const toggleWatchlistSymbol = (symbol: string) => {
        const enabled = settings.watchlistSymbols.includes(symbol);
        const next = enabled
            ? settings.watchlistSymbols.filter((item) => item !== symbol)
            : [...settings.watchlistSymbols, symbol];
        if (next.length === 0) return;
        updateSettings({ watchlistSymbols: next });
    };

    const handleSave = () => {
        setSelectedSymbol(settings.defaultSymbol);
        setSavedToast(true);
    };

    if (!hydrated) {
        return (
            <div className="max-w-3xl mx-auto px-4 md:px-6 pt-10 pb-12">
                <div className="glass-card border border-white/10 rounded-2xl p-6 text-center text-sm text-gray-400">
                    Loading settings...
                </div>
            </div>
        );
    }

    return (
        <div className="page-shell">
            <PageHeader
                module="Settings"
                title="Settings"
                description="Preferences are saved in your browser on this device."
            />

            <div className="glass-card border-terminal-border p-4 space-y-6">
                <section className="space-y-3">
                    <h2 className="text-sm font-bold text-white">Default index</h2>
                    <p className="text-xs text-gray-500">
                        Which index opens when you visit the dashboard.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {DASHBOARD_INDICES.map((option) => {
                            const active = settings.defaultSymbol === option.symbol;
                            return (
                                <button
                                    key={option.symbol}
                                    type="button"
                                    onClick={() => updateSettings({ defaultSymbol: option.symbol })}
                                    className={`rounded-xl border px-3 py-2.5 text-sm font-semibold text-left ${
                                        active
                                            ? "border-bb-orange bg-bb-orange/15 text-bb-orange"
                                            : "border-terminal-border bg-terminal-bg text-terminal-muted"
                                    }`}
                                >
                                    {option.label}
                                </button>
                            );
                        })}
                    </div>
                </section>

                <section className="space-y-3">
                    <h2 className="text-sm font-bold text-white">Dashboard refresh interval</h2>
                    <p className="text-xs text-gray-500">
                        How often the main dashboard polls for new market data. Higher intervals reduce backend load.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {REFRESH_OPTIONS.map((option) => {
                            const active = settings.dashboardRefreshSec === option.value;
                            return (
                                <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => updateSettings({ dashboardRefreshSec: option.value })}
                                    className={`rounded-xl border px-3 py-2.5 text-sm font-semibold text-left ${
                                        active
                                            ? "border-bb-orange bg-bb-orange/15 text-bb-orange"
                                            : "border-terminal-border bg-terminal-bg text-terminal-muted"
                                    }`}
                                >
                                    {option.label}
                                </button>
                            );
                        })}
                    </div>
                </section>

                <section className="space-y-3">
                    <h2 className="text-sm font-bold text-white">Checkpoint timeline refresh</h2>
                    <p className="text-xs text-gray-500">
                        How often the checkpoint board polls for new timeline cards during live market hours.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {CHECKPOINT_REFRESH_OPTIONS.map((option) => {
                            const active = settings.checkpointRefreshSec === option.value;
                            return (
                                <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => updateSettings({ checkpointRefreshSec: option.value })}
                                    className={`rounded-xl border px-3 py-2.5 text-sm font-semibold text-left ${
                                        active
                                            ? "border-bb-orange bg-bb-orange/15 text-bb-orange"
                                            : "border-terminal-border bg-terminal-bg text-terminal-muted"
                                    }`}
                                >
                                    {option.label}
                                </button>
                            );
                        })}
                    </div>
                </section>

                <section className="space-y-3">
                    <h2 className="text-sm font-bold text-white">Checkpoint catch-up refresh</h2>
                    <p className="text-xs text-gray-500">
                        Faster polling while the board is filling missed checkpoints after market open.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {CATCHUP_REFRESH_OPTIONS.map((option) => {
                            const active = settings.checkpointCatchupSec === option.value;
                            return (
                                <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => updateSettings({ checkpointCatchupSec: option.value })}
                                    className={`rounded-xl border px-3 py-2.5 text-sm font-semibold text-left ${
                                        active
                                            ? "border-bb-orange bg-bb-orange/15 text-bb-orange"
                                            : "border-terminal-border bg-terminal-bg text-terminal-muted"
                                    }`}
                                >
                                    {option.label}
                                </button>
                            );
                        })}
                    </div>
                </section>

                <section className="space-y-3">
                    <h2 className="text-sm font-bold text-white">Dashboard chart</h2>
                    <p className="text-xs text-gray-500">
                        Candlesticks load only when enabled, keeping the default dashboard light on free tier.
                    </p>
                    <button
                        type="button"
                        onClick={() => updateSettings({ showCandlestickChart: !settings.showCandlestickChart })}
                        className={`rounded-xl border px-3 py-2.5 text-sm font-semibold text-left w-full sm:w-auto ${
                            settings.showCandlestickChart
                                ? "border-bb-orange bg-bb-orange/15 text-bb-orange"
                                : "border-terminal-border bg-terminal-bg text-terminal-muted"
                        }`}
                    >
                        {settings.showCandlestickChart ? "Chart enabled on dashboard" : "Chart hidden (default)"}
                    </button>
                </section>

                <section className="space-y-3">
                    <h2 className="text-sm font-bold text-white">Watchlist symbols</h2>
                    <p className="text-xs text-gray-500">
                        Choose which assets appear on the Watchlist page. At least one symbol must stay enabled.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {watchlistPool.map((option) => {
                            const active = settings.watchlistSymbols.includes(option.symbol);
                            const isLast = active && settings.watchlistSymbols.length === 1;
                            return (
                                <button
                                    key={option.symbol}
                                    type="button"
                                    disabled={isLast}
                                    onClick={() => toggleWatchlistSymbol(option.symbol)}
                                    className={`rounded-xl border px-3 py-2.5 text-sm font-semibold text-left ${
                                        active
                                            ? "border-bb-orange bg-bb-orange/15 text-bb-orange"
                                            : "border-terminal-border bg-terminal-bg text-terminal-muted"
                                    } ${isLast ? "opacity-60 cursor-not-allowed" : ""}`}
                                >
                                    {option.label}
                                    <span className="block text-[10px] font-normal text-gray-500 mt-0.5">
                                        {option.kind === "stock" ? "Stock" : "Index"} · {option.symbol}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </section>

                <div className="flex flex-wrap gap-3 pt-2">
                    <button
                        type="button"
                        onClick={handleSave}
                        className="btn-primary px-4 py-2 text-sm normal-case tracking-normal"
                    >
                        Apply to dashboard now
                    </button>
                    <button
                        type="button"
                        onClick={resetSettings}
                        className="rounded-xl border border-white/10 bg-gray-900/40 px-4 py-2.5 text-sm font-bold text-gray-300"
                    >
                        Reset to defaults
                    </button>
                </div>

                {savedToast && (
                    <p className="text-xs text-emerald-400 font-semibold">Settings applied.</p>
                )}
            </div>

            <div className="glass-card border-terminal-border p-4">
                <h2 className="text-sm font-bold text-white mb-2">Current values</h2>
                <div className="text-xs text-gray-400 space-y-1">
                    <p>Default index: <span className="text-gray-200">{settings.defaultSymbol}</span></p>
                    <p>Dashboard refresh: <span className="text-gray-200">{settings.dashboardRefreshSec}s</span></p>
                    <p>Checkpoint refresh: <span className="text-gray-200">{settings.checkpointRefreshSec}s</span></p>
                    <p>Catch-up refresh: <span className="text-gray-200">{settings.checkpointCatchupSec}s</span></p>
                    <p>Chart on dashboard: <span className="text-gray-200">{settings.showCandlestickChart ? "Yes" : "No"}</span></p>
                    <p>Watchlist symbols: <span className="text-gray-200">{settings.watchlistSymbols.join(", ")}</span></p>
                </div>
            </div>
        </div>
    );
}
