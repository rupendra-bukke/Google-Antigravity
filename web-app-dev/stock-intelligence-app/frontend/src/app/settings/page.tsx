"use client";

import { useEffect, useState } from "react";
import { DASHBOARD_INDICES } from "@/lib/indices";
import { useSettings } from "../context/SettingsContext";
import { useSymbol } from "../context/SymbolContext";

const REFRESH_OPTIONS = [
    { label: "1 minute", value: 60 },
    { label: "2 minutes", value: 120 },
    { label: "3 minutes (default)", value: 180 },
    { label: "5 minutes", value: 300 },
];

export default function SettingsPage() {
    const { settings, updateSettings, resetSettings, hydrated } = useSettings();
    const { setSelectedSymbol } = useSymbol();
    const [savedToast, setSavedToast] = useState(false);

    useEffect(() => {
        if (!savedToast) return;
        const timer = setTimeout(() => setSavedToast(false), 2000);
        return () => clearTimeout(timer);
    }, [savedToast]);

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
        <div className="max-w-3xl mx-auto px-4 md:px-6 pt-6 md:pt-10 space-y-6 pb-12 animate-fade-in">
            <div className="text-center py-4">
                <p className="text-[10px] font-black text-brand-400 uppercase tracking-[0.2em]">Trade-Craft</p>
                <h1 className="text-3xl md:text-4xl font-black text-white mt-2">Settings</h1>
                <p className="text-sm text-gray-400 mt-2">
                    Preferences are saved in your browser on this device.
                </p>
            </div>

            <div className="glass-card border border-white/10 rounded-2xl p-5 space-y-6">
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
                                            ? "border-brand-500/40 bg-brand-500/15 text-brand-300"
                                            : "border-white/10 bg-gray-900/40 text-gray-400"
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
                                            ? "border-brand-500/40 bg-brand-500/15 text-brand-300"
                                            : "border-white/10 bg-gray-900/40 text-gray-400"
                                    }`}
                                >
                                    {option.label}
                                </button>
                            );
                        })}
                    </div>
                </section>

                <div className="flex flex-wrap gap-3 pt-2">
                    <button
                        type="button"
                        onClick={handleSave}
                        className="rounded-xl border border-brand-500/40 bg-brand-500/20 px-4 py-2.5 text-sm font-bold text-brand-200"
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

            <div className="glass-card border border-white/10 rounded-2xl p-5">
                <h2 className="text-sm font-bold text-white mb-2">Current values</h2>
                <div className="text-xs text-gray-400 space-y-1">
                    <p>Default index: <span className="text-gray-200">{settings.defaultSymbol}</span></p>
                    <p>Refresh interval: <span className="text-gray-200">{settings.dashboardRefreshSec}s</span></p>
                </div>
            </div>
        </div>
    );
}
