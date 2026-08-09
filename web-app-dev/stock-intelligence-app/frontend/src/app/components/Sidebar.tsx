"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "../context/AuthContext";
import { useSymbol } from "../context/SymbolContext";
import BuildBadge from "./BuildBadge";
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
                className="fixed top-2 left-2 z-50 md:hidden p-2 border border-terminal-border bg-terminal-panel text-bb-orange"
                aria-label="Toggle menu"
            >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {isOpen ? (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    ) : (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    )}
                </svg>
            </button>

            {isOpen && (
                <div className="fixed inset-0 bg-black/80 z-30 md:hidden" onClick={() => setIsOpen(false)} />
            )}

            <aside
                className={`
                    fixed top-0 left-0 h-full w-52 z-40 glass-sidebar flex flex-col
                    transition-transform duration-200
                    ${isOpen ? "translate-x-0" : "-translate-x-full"}
                    md:translate-x-0
                `}
            >
                <div className="border-b-2 border-b-bb-orange px-3 py-2.5">
                    <p className="text-[9px] font-mono font-bold text-bb-orange uppercase tracking-[0.2em]">Trade-Craft</p>
                    <p className="text-[11px] font-mono font-bold text-white uppercase mt-0.5">Terminal</p>
                    <p className="text-[10px] font-mono text-terminal-muted mt-1 truncate">{meta}</p>
                </div>

                <nav className="flex-1 py-1">
                    <p className="px-3 py-1.5 text-[9px] font-mono text-terminal-dim uppercase tracking-widest">Menu</p>
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
                                className={`w-full flex items-center gap-2 px-3 py-2 text-[11px] font-mono font-semibold uppercase tracking-wide border-l-2 border-transparent ${
                                    active
                                        ? "nav-item-active"
                                        : "text-terminal-muted hover:text-bb-orange hover:bg-terminal-bg"
                                }`}
                            >
                                <Icon className="w-4 h-4 shrink-0" />
                                {item.label}
                            </button>
                        );
                    })}
                </nav>

                <div className="border-t border-terminal-border p-2 space-y-2">
                    <div className="px-2 py-2 border border-terminal-border bg-terminal-bg">
                        <p className="text-[8px] font-mono text-terminal-dim uppercase">Session</p>
                        <p className="text-[10px] font-mono text-terminal-text truncate mt-0.5">{user?.email || "—"}</p>
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
                            className="mt-2 w-full btn-ghost py-1 text-[9px] text-bb-red border-bb-red/30 hover:bg-bb-red/10"
                        >
                            {isSigningOut ? "..." : "Logout"}
                        </button>
                    </div>
                    <BuildBadge className="w-full text-center text-[9px]" />
                </div>
            </aside>
        </>
    );
}
