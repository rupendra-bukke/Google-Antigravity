import MarketMoveChart, { MiniCandles, sessionBars, sessionMove, type MoveBar } from "./MarketMoveChart";

interface BollingerData {
    upper: number;
    middle: number;
    lower: number;
}

interface MacdData {
    macd_line: number;
    signal_line: number;
    histogram: number;
}

interface IndicatorData {
    ema20: number;
    rsi14: number;
    vwap: number;
    bollinger: BollingerData;
    macd: MacdData;
}

interface StockHeaderProps {
    symbol: string;
    price: number;
    timestamp: string;
    isLoading: boolean;
    candles?: MoveBar[];
    chartLoading?: boolean;
    indicators?: IndicatorData | null;
}

const SYMBOL_NAMES: Record<string, string> = {
    "^NSEI": "NIFTY 50",
    "^NSEBANK": "Bank NIFTY",
    "^BSESN": "SENSEX",
};

const SYMBOL_EXCHANGES: Record<string, string> = {
    "^NSEI": "NSE India · Index",
    "^NSEBANK": "NSE India · Sectoral Index",
    "^BSESN": "BSE India · Index",
};

const SYMBOL_TAG: Record<string, string> = {
    "^NSEI": "NIFTY",
    "^NSEBANK": "BANKNIFTY",
    "^BSESN": "SENSEX",
};

function formatInr(value: number): string {
    return value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

export default function StockHeader({
    symbol,
    price,
    timestamp,
    isLoading,
    candles = [],
    chartLoading = false,
    indicators = null,
}: StockHeaderProps) {
    const formattedTime = timestamp
        ? new Date(timestamp).toLocaleString("en-IN", {
            timeZone: "Asia/Kolkata",
            dateStyle: "medium",
            timeStyle: "short",
        })
        : "—";

    const displayName = SYMBOL_NAMES[symbol] || symbol;
    const exchange = SYMBOL_EXCHANGES[symbol] || "Exchange";
    const tag = SYMBOL_TAG[symbol] || symbol;
    const bars = sessionBars(candles);
    const move = sessionMove(bars);
    const up = (move?.change ?? 0) > 0;
    const down = (move?.change ?? 0) < 0;
    const moveColor = up ? "text-bb-green" : down ? "text-bb-red" : "text-terminal-muted";
    const rsi = indicators?.rsi14;
    const band = indicators?.bollinger;
    const bandSpan = band ? band.upper - band.lower : 0;
    const bandPos = band && bandSpan > 0 ? clamp(((price - band.lower) / bandSpan) * 100, 0, 100) : null;

    return (
        <div className="glass-card animate-fade-in overflow-hidden">
            <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.2fr)] lg:p-5">
                <div className="min-w-0">
                    <p className="section-label">{tag}</p>
                    <h2 className="mt-1 truncate text-xl font-semibold tracking-tight text-terminal-text md:text-2xl">
                        {displayName}
                    </h2>
                    <p className="mt-1 font-mono text-[11px] text-terminal-muted">{exchange}</p>

                    {isLoading ? (
                        <div className="mt-4 space-y-2">
                            <div className="h-9 w-40 shimmer bg-terminal-bg" />
                            <div className="h-4 w-28 shimmer bg-terminal-bg" />
                        </div>
                    ) : (
                        <>
                            <p className="mt-4 font-mono text-3xl font-semibold tabular-nums tracking-tight text-white">
                                ₹{formatInr(price || 0)}
                            </p>
                            {move && (
                                <p className={`mt-2 font-mono text-sm font-medium tabular-nums ${moveColor}`}>
                                    {up ? "▲" : down ? "▼" : "–"} {up ? "+" : ""}
                                    {formatInr(move.change)} ({up ? "+" : ""}
                                    {move.pct.toFixed(2)}%)
                                    <span className="ml-2 text-[11px] font-normal text-terminal-dim">session</span>
                                </p>
                            )}
                            <p className="mt-2 font-mono text-[10px] text-terminal-dim">Updated {formattedTime} IST</p>
                        </>
                    )}

                    <div className="mt-5 space-y-3">
                        <Meter
                            label="RSI 14"
                            valueLabel={rsi != null ? rsi.toFixed(1) : "—"}
                            percent={rsi != null ? clamp(rsi, 0, 100) : 0}
                            tone={rsi == null ? "flat" : rsi >= 70 ? "down" : rsi <= 30 ? "up" : "flat"}
                        />
                        <Meter
                            label="Price in band"
                            valueLabel={bandPos != null ? `${bandPos.toFixed(0)}%` : "—"}
                            percent={bandPos ?? 0}
                            tone={bandPos == null ? "flat" : bandPos >= 80 ? "down" : bandPos <= 20 ? "up" : "flat"}
                        />
                        {move && (
                            <RangeTrack low={move.low} high={move.high} price={move.close} />
                        )}
                    </div>
                </div>

                <div className="rounded-md border border-terminal-border bg-terminal-bg px-3 py-3">
                    <div className="mb-1 flex items-center justify-between">
                        <p className="section-label">Session move</p>
                        <p className="font-mono text-[10px] text-terminal-dim">
                            {chartLoading ? "Loading bars…" : move ? `H ${formatInr(move.high)} · L ${formatInr(move.low)}` : "No bars"}
                        </p>
                    </div>
                    <MarketMoveChart bars={bars} />
                    <MiniCandles bars={bars} />
                </div>
            </div>
        </div>
    );
}

function Meter({
    label,
    valueLabel,
    percent,
    tone,
}: {
    label: string;
    valueLabel: string;
    percent: number;
    tone: "up" | "down" | "flat";
}) {
    const fill = tone === "up" ? "bg-bb-green" : tone === "down" ? "bg-bb-red" : "bg-bb-orange";
    return (
        <div>
            <div className="mb-1 flex items-center justify-between text-[11px]">
                <span className="text-terminal-muted">{label}</span>
                <span className="font-mono tabular-nums text-terminal-text">{valueLabel}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-terminal-bg">
                <div className={`h-full ${fill}`} style={{ width: `${clamp(percent, 0, 100)}%` }} />
            </div>
        </div>
    );
}

function RangeTrack({ low, high, price }: { low: number; high: number; price: number }) {
    const span = high - low || 1;
    const pos = clamp(((price - low) / span) * 100, 0, 100);
    return (
        <div>
            <div className="mb-1 flex items-center justify-between text-[11px]">
                <span className="text-terminal-muted">Day range</span>
                <span className="font-mono tabular-nums text-terminal-dim">
                    {formatInr(low)} – {formatInr(high)}
                </span>
            </div>
            <div className="relative h-1.5 rounded-full bg-gradient-to-r from-bb-red via-terminal-border to-bb-green">
                <span
                    className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-terminal-text"
                    style={{ left: `${pos}%` }}
                />
            </div>
        </div>
    );
}
