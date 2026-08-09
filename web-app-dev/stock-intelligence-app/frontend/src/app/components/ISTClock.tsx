"use client";

import { useState, useEffect } from "react";

interface ISTClockProps {
    compact?: boolean;
    embedded?: boolean;
}

export default function ISTClock({ compact = false, embedded = false }: ISTClockProps) {
    const [time, setTime] = useState({ hh: "00", mm: "00", ss: "00", period: "AM", date: "" });

    useEffect(() => {
        function tick() {
            const now = new Date();
            const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);

            const rawH = ist.getUTCHours();
            const mm = String(ist.getUTCMinutes()).padStart(2, "0");
            const ss = String(ist.getUTCSeconds()).padStart(2, "0");
            const period = rawH >= 12 ? "PM" : "AM";
            const h12 = rawH % 12 || 12;
            const hh = String(h12).padStart(2, "0");

            const dd = String(ist.getUTCDate()).padStart(2, "0");
            const mo = String(ist.getUTCMonth() + 1).padStart(2, "0");
            const yyyy = ist.getUTCFullYear();
            const dayNames = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
            const dayName = dayNames[ist.getUTCDay()];
            const date = `${dayName} ${dd}-${mo}-${yyyy}`;

            setTime({ hh, mm, ss, period, date });
        }

        tick();
        const id = setInterval(tick, 1000);
        return () => clearInterval(id);
    }, []);

    return (
        <div
            className={`font-mono ${
                embedded
                    ? "flex h-full items-center border border-terminal-border bg-terminal-bg px-3 py-1.5 text-[11px]"
                    : `border border-terminal-border bg-terminal-bg ${
                          compact ? "px-2 py-1 text-[10px]" : "px-3 py-1.5 text-[11px]"
                      }`
            }`}
        >
            <div className="flex items-center gap-2 text-bb-orange font-bold tabular-nums">
                <span>{time.hh}:{time.mm}:{time.ss}</span>
                <span className="text-terminal-dim text-[9px]">{time.period}</span>
                <span className="text-terminal-dim">|</span>
                <span className="text-terminal-muted font-normal text-[9px] uppercase tracking-wide">
                    {time.date}
                </span>
                <span className="text-bb-orange text-[9px] font-bold">IST</span>
            </div>
        </div>
    );
}
