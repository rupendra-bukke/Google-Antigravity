"use client";

import {
    formatJourneyStartDate,
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

    if (trackId) {
        const track = tracks[0];
        return (
            <p className={`font-mono text-[10px] text-terminal-muted ${className}`}>
                {prefix ? <span className="uppercase tracking-wide text-terminal-dim">{prefix} </span> : null}
                <span className="font-bold text-bb-orange">{track.shortLabel}</span>
                <span className="mx-1.5 text-terminal-dim">{formatJourneyStartDate(track.startDate)}</span>
                <span className="text-terminal-text">
                    {formatJourneyYears(yearsSince(track.startDate))}
                </span>
            </p>
        );
    }

    return (
        <div className={`space-y-1 ${className}`}>
            {prefix ? (
                <p className="font-mono text-[8px] uppercase tracking-widest text-terminal-dim">{prefix}</p>
            ) : null}
            {tracks.map((track) => (
                <div key={track.id} className="flex items-baseline gap-2 font-mono text-[10px]">
                    <span className="w-3 shrink-0 font-bold text-bb-orange">{track.shortLabel}</span>
                    <span className="text-terminal-muted">{formatJourneyStartDate(track.startDate)}</span>
                    <span className="ml-auto tabular-nums text-terminal-text">
                        {formatJourneyYears(yearsSince(track.startDate))}
                    </span>
                </div>
            ))}
        </div>
    );
}
