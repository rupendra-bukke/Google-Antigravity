"use client";

import { useEffect, useRef } from "react";
import { createChart, ColorType } from "lightweight-charts";

interface OhlcBar {
    time: string;
    open: number;
    high: number;
    low: number;
    close: number;
}

interface CandlestickChartProps {
    candles: OhlcBar[];
    ema20: number | null;
    isLoading: boolean;
}

export default function CandlestickChart({
    candles,
    ema20,
    isLoading,
}: CandlestickChartProps) {
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<ReturnType<typeof createChart> | null>(null);

    useEffect(() => {
        if (!chartContainerRef.current || candles.length === 0) return;

        // Clear previous chart
        if (chartRef.current) {
            chartRef.current.remove();
            chartRef.current = null;
        }

        const container = chartContainerRef.current;

        const chart = createChart(container, {
            layout: {
                background: { type: ColorType.Solid, color: "transparent" },
                textColor: "#9ca3af",
                fontFamily: "Inter, system-ui, sans-serif",
                fontSize: 11,
            },
            grid: {
                vertLines: { color: "rgba(75, 85, 99, 0.15)" },
                horzLines: { color: "rgba(75, 85, 99, 0.15)" },
            },
            width: container.clientWidth,
            height: 400,
            crosshair: {
                vertLine: { color: "rgba(99, 102, 241, 0.3)", width: 1, style: 2 },
                horzLine: { color: "rgba(99, 102, 241, 0.3)", width: 1, style: 2 },
            },
            rightPriceScale: {
                borderColor: "rgba(75, 85, 99, 0.3)",
            },
            timeScale: {
                borderColor: "rgba(75, 85, 99, 0.3)",
                timeVisible: true,
                secondsVisible: false,
            },
        });

        chartRef.current = chart;

        // --- Candlestick series ---
        const candlestickSeries = chart.addCandlestickSeries({
            upColor: "#10b981",
            downColor: "#f43f5e",
            borderDownColor: "#f43f5e",
            borderUpColor: "#10b981",
            wickDownColor: "#f43f5e",
            wickUpColor: "#10b981",
        });

        // Convert ISO timestamps to Unix timestamps (seconds)
        const formattedCandles = candles.map((c) => ({
            time: Math.floor(new Date(c.time).getTime() / 1000) as any,
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
        }));

        candlestickSeries.setData(formattedCandles);

        // --- EMA20 line overlay ---
        if (candles.length >= 20) {
            const emaLine = chart.addLineSeries({
                color: "#818cf8",
                lineWidth: 2,
                priceLineVisible: false,
                crosshairMarkerVisible: false,
            });

            // Compute EMA20 from candle close prices
            const closes = candles.map((c) => c.close);
            const emaValues: { time: any; value: number }[] = [];
            const k = 2 / (20 + 1);
            let emaVal = closes[0];

            for (let i = 0; i < closes.length; i++) {
                emaVal = closes[i] * k + emaVal * (1 - k);
                if (i >= 19) {
                    emaValues.push({
                        time: Math.floor(new Date(candles[i].time).getTime() / 1000) as any,
                        value: Math.round(emaVal * 100) / 100,
                    });
                }
            }

            emaLine.setData(emaValues);
        }

        chart.timeScale().fitContent();

        // --- Resize handler ---
        const handleResize = () => {
            if (chartRef.current && container) {
                chartRef.current.applyOptions({ width: container.clientWidth });
            }
        };
        window.addEventListener("resize", handleResize);

        return () => {
            window.removeEventListener("resize", handleResize);
            if (chartRef.current) {
                chartRef.current.remove();
                chartRef.current = null;
            }
        };
    }, [candles, ema20]);

    return (
        <div className="glass-card p-4 md:p-6 animate-fade-in">
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Price Chart
                    </h3>
                    <p className="text-[10px] text-gray-600 mt-0.5">
                        15-min candles · EMA20 overlay
                    </p>
                </div>
                <div className="flex items-center gap-4 text-[10px] text-gray-500">
                    <span className="flex items-center gap-1">
                        <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" /> Up
                    </span>
                    <span className="flex items-center gap-1">
                        <span className="w-2.5 h-2.5 rounded-sm bg-rose-500" /> Down
                    </span>
                    <span className="flex items-center gap-1">
                        <span className="w-2.5 h-0.5 bg-brand-400 rounded" /> EMA20
                    </span>
                </div>
            </div>

            {isLoading ? (
                <div className="h-[400px] w-full rounded-xl bg-gray-800/50 shimmer flex items-center justify-center">
                    <p className="text-sm text-gray-600">Loading chart…</p>
                </div>
            ) : candles.length === 0 ? (
                <div className="h-[400px] w-full rounded-xl bg-gray-800/30 flex items-center justify-center">
                    <p className="text-sm text-gray-500">No candlestick data available</p>
                </div>
            ) : (
                <div
                    ref={chartContainerRef}
                    className="w-full rounded-xl overflow-hidden"
                />
            )}
        </div>
    );
}
