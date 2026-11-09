"use client";

import { useId } from "react";

export interface MoveBar {
    time: string;
    open: number;
    high: number;
    low: number;
    close: number;
}

function istDay(iso: string): string {
    const parsed = new Date(iso);
    if (Number.isNaN(parsed.getTime())) return "";
    return new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Kolkata",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).format(parsed);
}

export function sessionBars(candles: MoveBar[]): MoveBar[] {
    if (candles.length === 0) return [];
    const lastDay = istDay(candles[candles.length - 1].time);
    const sameDay = lastDay ? candles.filter((bar) => istDay(bar.time) === lastDay) : candles;
    return sameDay.length >= 2 ? sameDay : candles.slice(-48);
}

export function sessionMove(bars: MoveBar[]): {
    change: number;
    pct: number;
    high: number;
    low: number;
    open: number;
    close: number;
} | null {
    if (bars.length === 0) return null;
    const open = bars[0].open;
    const close = bars[bars.length - 1].close;
    const high = Math.max(...bars.map((bar) => bar.high));
    const low = Math.min(...bars.map((bar) => bar.low));
    if (!open) return null;
    return { change: close - open, pct: ((close - open) / open) * 100, high, low, open, close };
}

export default function MarketMoveChart({ bars }: { bars: MoveBar[] }) {
    const gradientId = useId().replace(/:/g, "");
    const closes = bars.map((bar) => bar.close);
    if (closes.length < 2) {
        return (
            <div className="flex h-36 items-center justify-center text-xs text-terminal-dim">
                Waiting for price bars
            </div>
        );
    }

    const width = 640;
    const height = 148;
    const min = Math.min(...closes);
    const max = Math.max(...closes);
    const span = max - min || 1;
    const points = closes.map((value, index) => {
        const x = (index / (closes.length - 1)) * width;
        const y = height - 10 - ((value - min) / span) * (height - 20);
        return { x, y };
    });
    const line = points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
    const area = `${line} L${width},${height} L0,${height} Z`;
    const up = closes[closes.length - 1] >= closes[0];
    const stroke = up ? "#089981" : "#f23645";
    const last = points[points.length - 1];

    return (
        <svg viewBox={`0 0 ${width} ${height}`} className="h-36 w-full" role="img" aria-label="Intraday price move">
            <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={stroke} stopOpacity="0.28" />
                    <stop offset="100%" stopColor={stroke} stopOpacity="0" />
                </linearGradient>
            </defs>
            {[0.25, 0.5, 0.75].map((level) => (
                <line
                    key={level}
                    x1="0"
                    x2={width}
                    y1={height * level}
                    y2={height * level}
                    stroke="#2a2e39"
                    strokeWidth="1"
                />
            ))}
            <path d={area} fill={`url(#${gradientId})`} />
            <path d={line} fill="none" stroke={stroke} strokeWidth="2.4" strokeLinejoin="round" />
            <circle cx={last.x} cy={last.y} r="4.5" fill={stroke} />
        </svg>
    );
}

export function MiniCandles({ bars }: { bars: MoveBar[] }) {
    const slice = bars.slice(-24);
    if (slice.length === 0) return null;
    const high = Math.max(...slice.map((bar) => bar.high));
    const low = Math.min(...slice.map((bar) => bar.low));
    const span = high - low || 1;
    const width = 320;
    const height = 56;
    const slot = width / slice.length;

    return (
        <svg viewBox={`0 0 ${width} ${height}`} className="mt-2 h-14 w-full" aria-hidden>
            {slice.map((bar, index) => {
                const up = bar.close >= bar.open;
                const color = up ? "#089981" : "#f23645";
                const x = index * slot + slot * 0.28;
                const bodyTop = Math.min(bar.open, bar.close);
                const bodyBottom = Math.max(bar.open, bar.close);
                const yHigh = ((high - bar.high) / span) * (height - 4) + 2;
                const yLow = ((high - bar.low) / span) * (height - 4) + 2;
                const yBody = ((high - bodyBottom) / span) * (height - 4) + 2;
                const bodyHeight = Math.max(1.5, ((bodyBottom - bodyTop) / span) * (height - 4));
                return (
                    <g key={`${bar.time}-${index}`}>
                        <line x1={x + slot * 0.18} x2={x + slot * 0.18} y1={yHigh} y2={yLow} stroke={color} strokeWidth="1" />
                        <rect x={x} y={yBody} width={Math.max(2, slot * 0.42)} height={bodyHeight} fill={color} rx="0.5" />
                    </g>
                );
            })}
        </svg>
    );
}
