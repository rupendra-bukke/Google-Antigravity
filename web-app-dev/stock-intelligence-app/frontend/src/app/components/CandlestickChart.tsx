"use client";

import { useEffect, useMemo, useRef } from "react";
import { createChart, ColorType, type UTCTimestamp } from "lightweight-charts";

interface OhlcBar {
    time: string;
    open: number;
    high: number;
    low: number;
    close: number;
}

interface CandlestickChartProps {
    candles: OhlcBar[];
    isLoading: boolean;
}

function toChartTime(value: string): UTCTimestamp | null {
    const parsed = Date.parse(value);
    if (Number.isNaN(parsed)) return null;
    return Math.floor(parsed / 1000) as UTCTimestamp;
}

function normalizeCandles(candles: OhlcBar[]) {
    const byTime = new Map<number, OhlcBar>();

    for (const candle of candles) {
        const time = toChartTime(candle.time);
        if (time === null) continue;
        byTime.set(time, candle);
    }

    return Array.from(byTime.entries())
        .sort(([a], [b]) => a - b)
        .map(([time, candle]) => ({
            time: time as UTCTimestamp,
            open: candle.open,
            high: candle.high,
            low: candle.low,
            close: candle.close,
        }));
}

export default function CandlestickChart({ candles, isLoading }: CandlestickChartProps) {
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<ReturnType<typeof createChart> | null>(null);

    const chartData = useMemo(() => normalizeCandles(candles), [candles]);
    const hasData = chartData.length > 0;

    useEffect(() => {
        const container = chartContainerRef.current;
        if (!container || !hasData) return;

        if (chartRef.current) {
            chartRef.current.remove();
            chartRef.current = null;
        }

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
            width: Math.max(container.clientWidth, 320),
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

        const candlestickSeries = chart.addCandlestickSeries({
            upColor: "#10b981",
            downColor: "#f43f5e",
            borderDownColor: "#f43f5e",
            borderUpColor: "#10b981",
            wickDownColor: "#f43f5e",
            wickUpColor: "#10b981",
        });

        candlestickSeries.setData(chartData);

        if (chartData.length >= 20) {
            const emaLine = chart.addLineSeries({
                color: "#818cf8",
                lineWidth: 2,
                priceLineVisible: false,
                crosshairMarkerVisible: false,
            });

            const emaValues: { time: UTCTimestamp; value: number }[] = [];
            const k = 2 / (20 + 1);
            let emaVal = chartData[0].close;

            for (let i = 0; i < chartData.length; i++) {
                emaVal = chartData[i].close * k + emaVal * (1 - k);
                if (i >= 19) {
                    emaValues.push({
                        time: chartData[i].time,
                        value: Math.round(emaVal * 100) / 100,
                    });
                }
            }

            emaLine.setData(emaValues);
        }

        chart.timeScale().fitContent();

        const resizeChart = () => {
            if (!chartRef.current || !container) return;
            const width = Math.max(container.clientWidth, 320);
            chartRef.current.applyOptions({ width });
        };

        resizeChart();

        const observer = typeof ResizeObserver !== "undefined"
            ? new ResizeObserver(() => resizeChart())
            : null;
        observer?.observe(container);
        window.addEventListener("resize", resizeChart);

        return () => {
            observer?.disconnect();
            window.removeEventListener("resize", resizeChart);
            if (chartRef.current) {
                chartRef.current.remove();
                chartRef.current = null;
            }
        };
    }, [chartData, hasData]);

    return (
        <div className="glass-card p-4 md:p-6 animate-fade-in">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
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

            <div className="relative h-[400px] w-full rounded-xl overflow-hidden">
                <div ref={chartContainerRef} className="absolute inset-0 w-full h-full" />

                {isLoading && (
                    <div className="absolute inset-0 z-10 bg-gray-900/70 backdrop-blur-[1px] flex items-center justify-center">
                        <p className="text-sm text-gray-300">Loading chart…</p>
                    </div>
                )}

                {!isLoading && !hasData && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-gray-800/30">
                        <p className="text-sm text-gray-500">No candlestick data available</p>
                    </div>
                )}
            </div>
        </div>
    );
}
