export const DASHBOARD_INDICES = [
    { label: "NIFTY 50", symbol: "^NSEI", emoji: "🇮🇳" },
    { label: "Bank NIFTY", symbol: "^NSEBANK", emoji: "🏦" },
    { label: "SENSEX", symbol: "^BSESN", emoji: "📊" },
] as const;

export const DASHBOARD_SYMBOLS = new Set(DASHBOARD_INDICES.map((item) => item.symbol));

export const SYMBOL_LABELS: Record<string, string> = {
    "^NSEI": "NIFTY 50",
    "^NSEBANK": "Bank NIFTY",
    "^BSESN": "SENSEX",
};

export function normalizeDashboardSymbol(symbol: string | undefined): string {
    if (symbol && (DASHBOARD_SYMBOLS as Set<string>).has(symbol)) {
        return symbol;
    }
    return "^NSEI";
}
