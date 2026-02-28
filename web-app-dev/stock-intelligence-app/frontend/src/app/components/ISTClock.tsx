"use client";

import { useState, useEffect } from "react";

export default function ISTClock() {
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
            const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
            const dayName = dayNames[ist.getUTCDay()];
            const date = `${dayName}, ${dd}-${mo}-${yyyy}`;

            setTime({ hh, mm, ss, period, date });
        }

        tick(); // run immediately
        const id = setInterval(tick, 1000);
        return () => clearInterval(id);
    }, []);

    const Digit = ({ char, dim = false }: { char: string; dim?: boolean }) => (
        <span style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "'Courier New', 'Lucida Console', monospace",
            fontSize: "1.6rem",
            fontWeight: 900,
            letterSpacing: "0.05em",
            color: dim ? "rgba(212,175,55,0.3)" : "#d4af37",
            background: dim ? "transparent" : "rgba(212,175,55,0.06)",
            border: dim ? "none" : "1px solid rgba(212,175,55,0.18)",
            borderRadius: "6px",
            padding: dim ? "0" : "2px 6px",
            minWidth: dim ? "auto" : "2rem",
            lineHeight: 1,
            textShadow: dim ? "none" : "0 0 12px rgba(212,175,55,0.5)",
            transition: "color 0.2s ease",
        }}>
            {char}
        </span>
    );

    return (
        <div style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "6px",
            padding: "12px 16px",
            borderRadius: "16px",
            background: "rgba(212,175,55,0.04)",
            border: "1px solid rgba(212,175,55,0.12)",
            backdropFilter: "blur(12px)",
        }}>
            {/* Time row */}
            <div style={{ display: "flex", alignItems: "center", gap: "3px" }}>
                <Digit char={time.hh[0]} />
                <Digit char={time.hh[1]} />
                <Digit char=":" dim />
                <Digit char={time.mm[0]} />
                <Digit char={time.mm[1]} />
                <Digit char=":" dim />
                <Digit char={time.ss[0]} />
                <Digit char={time.ss[1]} />
                <span style={{
                    fontSize: "0.65rem",
                    fontWeight: 900,
                    color: "#d4af37",
                    marginLeft: "5px",
                    opacity: 0.8,
                    fontFamily: "monospace",
                    letterSpacing: "0.08em",
                }}>
                    {time.period}
                </span>
            </div>

            {/* Label row */}
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{
                    fontSize: "0.5rem",
                    fontWeight: 800,
                    color: "rgba(212,175,55,0.5)",
                    textTransform: "uppercase",
                    letterSpacing: "0.2em",
                }}>
                    {time.date}
                </span>
                <span style={{
                    fontSize: "0.48rem",
                    fontWeight: 900,
                    background: "rgba(212,175,55,0.1)",
                    border: "1px solid rgba(212,175,55,0.2)",
                    color: "#d4af37",
                    padding: "1px 5px",
                    borderRadius: "4px",
                    letterSpacing: "0.15em",
                }}>
                    IST
                </span>
            </div>
        </div>
    );
}
