"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "../context/AuthContext";
import { useSymbol } from "../context/SymbolContext";
import BuildBadge from "./BuildBadge";
import TradeCraftBrand from "./TradeCraftBrand";
import TraderJourneyLine from "./TraderJourneyLine";
import {
    IconDashboard,
    IconHistory,
    IconSettings,
    IconWatchlist,
} from "./NavIcons";

const SYMBOL_META: Record<string, string> = {
    "^NSEI": "NIFTY 50",
    "^NSEBANK": "BANK NIFTY",
    "^BSESN": "SENSEX",
};

const navItems = [
    { label: "Dashboard", id: "dashboard" as const, path: "/", Icon: IconDashboard },
    { label: "Watchlist", id: "watchlist" as const, path: "/watchlist", Icon: IconWatchlist },
    { label: "History", id: "history" as const, path: "/history", Icon: IconHistory },
    { label: "Settings", id: "settings" as const, path: "/settings", Icon: IconSettings },
];

export default function Sidebar() {
    const { selectedSymbol } = useSymbol();
    const { user, signOut } = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    const [isOpen, setIsOpen] = useState(false);
    const [isSigningOut, setIsSigningOut] = useState(false);

    const meta = SYMBOL_META[selectedSymbol] || selectedSymbol;
    const activeTab =
        pathname === "/watchlist"
            ? "watchlist"
            : pathname === "/history"
              ? "history"
              : pathname === "/settings"
                ? "settings"
                : "dashboard";

    return (
        <>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="fixed left-3 top-3 z-50 rounded-md border border-terminal-border bg-terminal-panel p-2 text-terminal-text md:hidden"
                aria-label="Toggle menu"
            >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {isOpen ? (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    ) : (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    )}
                </svg>
            </button>

            {isOpen && (
                <div className="fixed inset-0 z-30 bg-black/70 md:hidden" onClick={() => setIsOpen(false)} />
            )}

            <aside
                className={`
                    glass-sidebar fixed inset-y-0 left-0 z-40 flex w-60 flex-col p-3
                    transition-transform duration-200
                    ${isOpen ? "translate-x-0" : "-translate-x-[120%]"}
                    md:translate-x-0
                `}
            >
                <div className="px-1 pb-3">
                    <TradeCraftBrand size="sm" showTagline />
                    <p className="mt-3 text-[11px] font-medium text-terminal-muted">
                        {meta}
                    </p>
                </div>

                <div className="mb-3 rounded-md border border-terminal-border bg-terminal-bg px-3 py-2.5">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-terminal-dim">Journey</p>
                    <TraderJourneyLine className="mt-2" />
                </div>

                <nav className="flex-1 space-y-1">
                    {navItems.map((item) => {
                        const active = activeTab === item.id;
                        const Icon = item.Icon;
                        return (
                            <button
                                key={item.id}
                                type="button"
                                onClick={() => {
                                    router.push(item.path);
                                    setIsOpen(false);
                                }}
                                className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-[13px] font-medium ${
                                    active
                                        ? "nav-item-active"
                                        : "text-terminal-muted hover:bg-white/5 hover:text-white"
                                }`}
                            >
                                <Icon className="h-4 w-4 shrink-0" />
                                {item.label}
                            </button>
                        );
                    })}
                </nav>

                <div className="space-y-2 pt-3">
                    <div className="rounded-md border border-terminal-border bg-terminal-bg px-3 py-2.5">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-terminal-dim">Session</p>
                        <p className="mt-1 truncate text-xs text-terminal-text">{user?.email || "—"}</p>
                        <button
                            type="button"
                            onClick={async () => {
                                setIsSigningOut(true);
                                try {
                                    await signOut();
                                    router.push("/login");
                                } finally {
                                    setIsSigningOut(false);
                                }
                            }}
                            disabled={isSigningOut}
                            className="btn-ghost mt-2 w-full text-bb-red"
                        >
                            {isSigningOut ? "..." : "Log out"}
                        </button>
                    </div>
                    <BuildBadge className="w-full text-center" />
                </div>
            </aside>
        </>
    );
}
