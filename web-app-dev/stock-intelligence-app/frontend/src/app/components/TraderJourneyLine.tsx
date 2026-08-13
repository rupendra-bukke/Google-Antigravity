"use client";

import {
    formatJourneySummary,
    formatJourneyYears,
    yearsSince,
    type TraderJourneyTrack,
} from "@/lib/traderJourney";
import { useSettings } from "../context/SettingsContext";

interface TraderJourneyLineProps {
    className?: string;
    /** Show only one track (e.g. bank Nifty when that index is selected). */
    trackId?: TraderJourneyTrack["id"];
    /** Prefix before the summary, e.g. "Journey". */
    prefix?: string;
}

export default function TraderJourneyLine({
    className = "",
    trackId,
    prefix,
}: TraderJourneyLineProps) {
    const { settings, hydrated } = useSettings();

    if (!hydrated) return null;

    const tracks = trackId
        ? settings.traderJourney.filter((track) => track.id === trackId)
        : settings.traderJourney;

    if (tracks.length === 0) return null;

    const text = trackId
        ? `${tracks[0].label} ${formatJourneyYears(yearsSince(tracks[0].startDate))}`
        : formatJourneySummary(tracks);

    return (
        <p className={`font-mono text-terminal-dim ${className}`}>
            {prefix ? <span className="text-terminal-muted">{prefix} </span> : null}
            <span className="text-terminal-muted">{text}</span>
        </p>
    );
}
