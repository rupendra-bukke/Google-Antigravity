"use client";

import { useMemo, useState } from "react";
import { useSymbol } from "../context/SymbolContext";
import IndexSelector from "../components/IndexSelector";
import CheckpointBoard from "../components/CheckpointBoard";

function getIstDateStr(date: Date = new Date()): string {
    return new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Kolkata",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).format(date);
}

function shiftDate(dateStr: string, days: number): string {
    const dt = new Date(`${dateStr}T00:00:00Z`);
    dt.setUTCDate(dt.getUTCDate() + days);
    return dt.toISOString().slice(0, 10);
}

function formatDisplayDate(dateStr: string): string {
    const dt = new Date(`${dateStr}T00:00:00Z`);
    if (Number.isNaN(dt.getTime())) return dateStr;
    return dt.toLocaleDateString("en-IN", {
        timeZone: "Asia/Kolkata",
        weekday: "short",
        day: "2-digit",
        month: "short",
        year: "numeric",
    });
}

export default function HistoryPage() {
    const { selectedSymbol, setSelectedSymbol } = useSymbol();
    const [selectedDate, setSelectedDate] = useState(() => getIstDateStr());

    const quickDates = useMemo(
        () => ({
            today: getIstDateStr(),
            yesterday: shiftDate(getIstDateStr(), -1),
        }),
        []
    );

    return (
        <div className="max-w-6xl mx-auto px-4 md:px-6 pt-6 md:pt-10 space-y-6 pb-12 animate-fade-in">
            <div className="text-center py-4">
                <p className="text-[10px] font-black text-brand-400 uppercase tracking-[0.2em]">Trade-Craft</p>
                <h1 className="text-3xl md:text-4xl font-black text-white mt-2">Market History</h1>
                <p className="text-sm text-gray-400 mt-2 max-w-xl mx-auto">
                    Browse past checkpoint timelines by date and index. Review signals, outcomes, and session close.
                </p>
            </div>

            <div className="glass-card border border-white/10 rounded-2xl p-4 md:p-5 space-y-4">
                <div className="flex flex-col lg:flex-row lg:items-end gap-4 justify-between">
                    <div className="space-y-2">
                        <label className="block text-xs font-semibold text-gray-300 uppercase tracking-[0.12em]">
                            Index
                        </label>
                        <IndexSelector selected={selectedSymbol} onSelect={setSelectedSymbol} />
                    </div>

                    <div className="space-y-2">
                        <label className="block text-xs font-semibold text-gray-300 uppercase tracking-[0.12em]">
                            Trading date
                        </label>
                        <div className="flex flex-wrap items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setSelectedDate(shiftDate(selectedDate, -1))}
                                className="px-3 py-2 rounded-xl border border-white/10 bg-gray-900/50 text-sm text-gray-300"
                            >
                                ← Prev
                            </button>
                            <input
                                type="date"
                                value={selectedDate}
                                max={quickDates.today}
                                onChange={(event) => setSelectedDate(event.target.value)}
                                className="rounded-xl border border-white/15 bg-[#0b1225] px-3 py-2 text-sm text-white outline-none focus:border-brand-400"
                            />
                            <button
                                type="button"
                                onClick={() => setSelectedDate(shiftDate(selectedDate, 1))}
                                disabled={selectedDate >= quickDates.today}
                                className="px-3 py-2 rounded-xl border border-white/10 bg-gray-900/50 text-sm text-gray-300 disabled:opacity-40"
                            >
                                Next →
                            </button>
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap gap-2">
                    <button
                        type="button"
                        onClick={() => setSelectedDate(quickDates.today)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${
                            selectedDate === quickDates.today
                                ? "border-brand-500/40 bg-brand-500/15 text-brand-300"
                                : "border-white/10 text-gray-400"
                        }`}
                    >
                        Today
                    </button>
                    <button
                        type="button"
                        onClick={() => setSelectedDate(quickDates.yesterday)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${
                            selectedDate === quickDates.yesterday
                                ? "border-brand-500/40 bg-brand-500/15 text-brand-300"
                                : "border-white/10 text-gray-400"
                        }`}
                    >
                        Yesterday
                    </button>
                    <span className="text-xs text-gray-500 self-center ml-1">
                        Viewing {formatDisplayDate(selectedDate)}
                    </span>
                </div>
            </div>

            <CheckpointBoard symbol={selectedSymbol} date={selectedDate} mode="history" />
        </div>
    );
}
