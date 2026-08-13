"use client";

import {
    formatJourneyStartDate,
    formatJourneyTrack,
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
        const text = `${track.label} ${formatJourneyStartDate(track.startDate)} ${formatJourneyYears(
            yearsSince(track.startDate)
        )}`;

        return (
            <p className={`font-mono text-terminal-dim ${className}`}>
                {prefix ? <span className="text-terminal-muted">{prefix} </span> : null}
                <span className="text-terminal-muted">{text}</span>
            </p>
        );
    }

    return (
        <div className={`font-mono text-terminal-dim space-y-0.5 ${className}`}>
            {prefix ? (
                <p className="text-[8px] text-terminal-dim uppercase tracking-widest">{prefix}</p>
            ) : null}
            {tracks.map((track) => (
                <p key={track.id} className="text-terminal-muted truncate">
                    {formatJourneyTrack(track)}
                </p>
            ))}
        </div>
    );
}
