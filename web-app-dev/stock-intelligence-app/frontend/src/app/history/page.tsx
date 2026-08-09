"use client";

import { useMemo, useState } from "react";
import { useSymbol } from "../context/SymbolContext";
import IndexSelector from "../components/IndexSelector";
import CheckpointBoard from "../components/CheckpointBoard";
import PageHeader from "../components/PageHeader";

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
        <div className="page-shell">
            <PageHeader
                module="History"
                title="Market History"
                description="Browse past checkpoint timelines by date and index. Review signals, outcomes, and session close."
            />

            <div className="toolbar-card space-y-4">
                <div className="flex flex-col lg:flex-row lg:items-end gap-4 justify-between">
                    <div className="space-y-2">
                        <label className="section-label block">Index</label>
                        <IndexSelector selected={selectedSymbol} onSelect={setSelectedSymbol} />
                    </div>

                    <div className="space-y-2">
                        <label className="section-label block">Trading date</label>
                        <div className="flex flex-wrap items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setSelectedDate(shiftDate(selectedDate, -1))}
                                className="btn-ghost px-3 py-2 text-sm"
                            >
                                ← Prev
                            </button>
                            <input
                                type="date"
                                value={selectedDate}
                                max={quickDates.today}
                                onChange={(event) => setSelectedDate(event.target.value)}
                                className="border border-terminal-border bg-terminal-bg px-2 py-2 text-[11px] font-mono text-white outline-none focus:border-bb-orange"
                            />
                            <button
                                type="button"
                                onClick={() => setSelectedDate(shiftDate(selectedDate, 1))}
                                disabled={selectedDate >= quickDates.today}
                                className="btn-ghost px-3 py-2 text-sm disabled:opacity-40"
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
                                ? "border-bb-orange bg-bb-orange/15 text-bb-orange"
                                : "border-terminal-border text-terminal-muted"
                        }`}
                    >
                        Today
                    </button>
                    <button
                        type="button"
                        onClick={() => setSelectedDate(quickDates.yesterday)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${
                            selectedDate === quickDates.yesterday
                                ? "border-bb-orange bg-bb-orange/15 text-bb-orange"
                                : "border-terminal-border text-terminal-muted"
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
