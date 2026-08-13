export interface TraderJourneyTrack {
    id: "bankNifty" | "options" | "trading";
    label: string;
    shortLabel: string;
    startDate: string;
}

export const DEFAULT_TRADER_JOURNEY: TraderJourneyTrack[] = [
    { id: "bankNifty", label: "Bank Nifty", shortLabel: "T", startDate: "2022-02-25" },
    { id: "options", label: "Options", shortLabel: "D", startDate: "2023-10-30" },
    { id: "trading", label: "Trading", shortLabel: "M", startDate: "2024-08-30" },
];

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function parseJourneyDate(dateStr: string): Date | null {
    if (!ISO_DATE_RE.test(dateStr)) return null;
    const [year, month, day] = dateStr.split("-").map(Number);
    if (!year || month < 1 || month > 12 || day < 1 || day > 31) return null;
    const parsed = new Date(Date.UTC(year, month - 1, day));
    if (
        parsed.getUTCFullYear() !== year ||
        parsed.getUTCMonth() !== month - 1 ||
        parsed.getUTCDate() !== day
    ) {
        return null;
    }
    return parsed;
}

/** Calendar today in IST as a UTC midnight date (same approach as ExpiryBanner). */
export function getISTToday(): Date {
    const now = new Date();
    const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
    return new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()));
}

export function yearsSince(startDateStr: string, today = getISTToday()): number {
    const start = parseJourneyDate(startDateStr);
    if (!start) return 0;
    const msPerYear = 365.25 * 24 * 60 * 60 * 1000;
    const diff = today.getTime() - start.getTime();
    return Math.max(0, diff / msPerYear);
}

export function formatJourneyYears(years: number): string {
    return `${years.toFixed(1)}y`;
}

/** Display stored ISO date as DD-MM-YYYY (matches user-facing journey dates). */
export function formatJourneyStartDate(dateStr: string): string {
    const parsed = parseJourneyDate(dateStr);
    if (!parsed) return dateStr;
    const day = String(parsed.getUTCDate()).padStart(2, "0");
    const month = String(parsed.getUTCMonth() + 1).padStart(2, "0");
    const year = parsed.getUTCFullYear();
    return `${day}-${month}-${year}`;
}

export function formatJourneyTrack(track: TraderJourneyTrack, today = getISTToday()): string {
    return `${track.shortLabel} ${formatJourneyStartDate(track.startDate)} ${formatJourneyYears(
        yearsSince(track.startDate, today)
    )}`;
}

export function formatJourneySummary(tracks: TraderJourneyTrack[], today = getISTToday()): string {
    return tracks.map((track) => formatJourneyTrack(track, today)).join(" · ");
}

export function normalizeJourneyStartDate(value: unknown, fallback: string): string {
    if (typeof value !== "string") return fallback;
    return parseJourneyDate(value) ? value : fallback;
}

export function normalizeTraderJourney(
    raw: Partial<Record<TraderJourneyTrack["id"], string>> | undefined
): TraderJourneyTrack[] {
    return DEFAULT_TRADER_JOURNEY.map((track) => ({
        ...track,
        startDate: normalizeJourneyStartDate(raw?.[track.id], track.startDate),
    }));
}

export function normalizeTraderJourneyFromStorage(raw: unknown): TraderJourneyTrack[] {
    if (Array.isArray(raw)) {
        const byId: Partial<Record<TraderJourneyTrack["id"], string>> = {};
        for (const item of raw) {
            if (!item || typeof item !== "object") continue;
            const id = (item as TraderJourneyTrack).id;
            const startDate = (item as TraderJourneyTrack).startDate;
            if (
                (id === "bankNifty" || id === "options" || id === "trading") &&
                typeof startDate === "string"
            ) {
                byId[id] = startDate;
            }
        }
        return normalizeTraderJourney(byId);
    }

    if (raw && typeof raw === "object") {
        return normalizeTraderJourney(raw as Partial<Record<TraderJourneyTrack["id"], string>>);
    }

    return normalizeTraderJourney(undefined);
}
