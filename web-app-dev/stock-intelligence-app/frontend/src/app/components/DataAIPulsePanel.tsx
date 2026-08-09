"use client";

import { authedFetch } from "@/lib/authedFetch";
import { onDashboardRefresh } from "@/lib/dashboardRefresh";
import { useCallback, useEffect, useState } from "react";

type AnalysisStatus = "full" | "fallback";
type PriorityLevel = "HIGH" | "MEDIUM" | "LOW";

interface RoleImpact {
    power_bi: string;
    databricks: string;
    kql_adx: string;
    grafana: string;
    vehicle_analytics: string;
}

interface SourceLink {
    title: string;
    source: string;
    link: string;
}

interface CareerPulseData {
    analysis_type: "CAREER_PULSE";
    analysis_status?: AnalysisStatus;
    date: string;
    headlines: string[];
    role_impact: RoleImpact;
    action_this_week: string;
    reasoning: string;
    priority_level: PriorityLevel;
    source_links?: SourceLink[];
    captured_at?: string;
    next_refresh_at_ist?: string;
    snapshot_stale?: boolean;
}

const PRIORITY_STYLES: Record<PriorityLevel, string> = {
    HIGH: "text-bb-red border-bb-red/40 bg-bb-red/10",
    MEDIUM: "text-bb-orange border-bb-orange/40 bg-bb-orange/10",
    LOW: "text-terminal-muted border-terminal-border bg-terminal-bg",
};

const IMPACT_ROWS: Array<{ key: keyof RoleImpact; label: string }> = [
    { key: "power_bi", label: "Power BI / Fabric" },
    { key: "databricks", label: "Databricks" },
    { key: "kql_adx", label: "KQL / Synapse / ADX" },
    { key: "grafana", label: "Grafana" },
    { key: "vehicle_analytics", label: "Vehicle / IoT" },
];

const FALLBACK_REFRESH_SECONDS = 600;

function formatIstShort(iso: string | undefined): string {
    if (!iso) return "—";
    try {
        return new Intl.DateTimeFormat("en-IN", {
            timeZone: "Asia/Kolkata",
            day: "2-digit",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
        }).format(new Date(iso));
    } catch {
        return iso;
    }
}

function makeFallback(): CareerPulseData {
    return {
        analysis_type: "CAREER_PULSE",
        analysis_status: "fallback",
        date: new Date().toISOString().slice(0, 10),
        headlines: ["Loading Data & AI Pulse…"],
        role_impact: {
            power_bi: "—",
            databricks: "—",
            kql_adx: "—",
            grafana: "—",
            vehicle_analytics: "—",
        },
        action_this_week: "—",
        reasoning: "Fetching daily brief.",
        priority_level: "LOW",
    };
}

export default function DataAIPulsePanel() {
    const [data, setData] = useState<CareerPulseData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchPulse = useCallback(async () => {
        try {
            const res = await authedFetch("/api/v1/career-pulse", { cache: "no-store" });
            if (!res.ok) {
                throw new Error(`HTTP ${res.status}`);
            }
            const json = (await res.json()) as CareerPulseData;
            setData(json);
            setError(null);
        } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to load";
            if (message.includes("404")) {
                setError(
                    "Career pulse API not deployed yet — redeploy the Render backend (dev or prod) from the latest main/dev commit."
                );
            } else {
                setError(message);
            }
            setData((prev) => prev ?? makeFallback());
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchPulse();
        return onDashboardRefresh(() => {
            fetchPulse();
        });
    }, [fetchPulse]);

    useEffect(() => {
        const interval = setInterval(fetchPulse, FALLBACK_REFRESH_SECONDS * 1000);
        return () => clearInterval(interval);
    }, [fetchPulse]);

    const pulse = data ?? makeFallback();
    const priority = (pulse.priority_level || "MEDIUM") as PriorityLevel;
    const statusLabel =
        pulse.analysis_status === "full"
            ? "AI digest"
            : pulse.snapshot_stale
              ? "Previous day"
              : "Headlines only";

    return (
        <section className="glass-card overflow-hidden border-t-2 border-t-bb-orange/60">
            <div className="flex flex-wrap items-start justify-between gap-2 border-b border-terminal-border bg-terminal-bg/60 px-3 py-2">
                <div>
                    <p className="section-label">Data &amp; AI Pulse</p>
                    <h2 className="text-sm font-semibold text-white mt-0.5">
                        BI · Analytics · Vehicle Data
                    </h2>
                    <p className="text-[10px] text-terminal-dim mt-0.5">
                        Daily brief for Power BI, Databricks, KQL, Grafana &amp; AI adoption
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                    <span
                        className={`text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 border ${PRIORITY_STYLES[priority]}`}
                    >
                        {priority}
                    </span>
                    <span className="text-[9px] font-mono text-terminal-dim uppercase border border-terminal-border px-1.5 py-0.5">
                        {statusLabel}
                    </span>
                    {pulse.snapshot_stale && (
                        <span className="text-[9px] font-mono text-bb-amber uppercase border border-bb-amber/30 px-1.5 py-0.5">
                            Stale
                        </span>
                    )}
                </div>
            </div>

            <div className="px-3 py-3 space-y-3">
                {loading && !data && (
                    <p className="text-[11px] text-terminal-dim font-mono animate-pulse">Loading pulse…</p>
                )}
                {error && (
                    <p className="text-[11px] text-bb-red font-mono border border-bb-red/30 bg-bb-red/5 px-2 py-1">
                        {error} — showing last known state
                    </p>
                )}

                <div>
                    <p className="text-[10px] font-data font-bold uppercase tracking-wider text-bb-orange mb-1.5">
                        Today&apos;s headlines
                    </p>
                    <ul className="space-y-1">
                        {pulse.headlines.map((item, idx) => (
                            <li
                                key={`${idx}-${item.slice(0, 24)}`}
                                className="text-[11px] text-terminal-text leading-snug flex gap-2"
                            >
                                <span className="text-bb-orange shrink-0">▸</span>
                                <span>{item}</span>
                            </li>
                        ))}
                    </ul>
                </div>

                <div>
                    <p className="text-[10px] font-data font-bold uppercase tracking-wider text-bb-orange mb-1.5">
                        So what for your stack?
                    </p>
                    <div className="grid gap-1 sm:grid-cols-2">
                        {IMPACT_ROWS.map(({ key, label }) => (
                            <div
                                key={key}
                                className="border border-terminal-border bg-terminal-bg px-2 py-1.5"
                            >
                                <p className="text-[9px] font-mono font-bold uppercase text-terminal-dim">
                                    {label}
                                </p>
                                <p className="text-[11px] text-terminal-text mt-0.5 leading-snug">
                                    {pulse.role_impact[key]}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="border border-bb-orange/30 bg-bb-orange/5 px-2.5 py-2">
                    <p className="text-[10px] font-data font-bold uppercase tracking-wider text-bb-orange">
                        Action this week
                    </p>
                    <p className="text-[12px] text-white mt-1 leading-snug">{pulse.action_this_week}</p>
                </div>

                {pulse.reasoning && (
                    <p className="text-[11px] text-terminal-muted leading-relaxed">{pulse.reasoning}</p>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-terminal-border">
                    <p className="text-[9px] font-mono text-terminal-dim">
                        Updated {formatIstShort(pulse.captured_at)} IST · Next ~{" "}
                        {formatIstShort(pulse.next_refresh_at_ist)}
                    </p>
                    <button type="button" onClick={fetchPulse} className="btn-ghost py-0.5 text-[9px]">
                        Reload
                    </button>
                </div>
            </div>
        </section>
    );
}
