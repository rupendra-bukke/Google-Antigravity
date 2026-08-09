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

const SYMBOL_META: Record<string, { name: string; initial: string }> = {
    "^NSEI": { name: "NIFTY 50", initial: "N" },
    "^NSEBANK": { name: "Bank NIFTY", initial: "B" },
    "^BSESN": { name: "SENSEX", initial: "S" },
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

    const meta = SYMBOL_META[selectedSymbol] || { name: selectedSymbol, initial: "?" };
    const activeTab =
        pathname === "/watchlist"
            ? "watchlist"
            : pathname === "/history"
              ? "history"
              : pathname === "/settings"
                ? "settings"
                : "dashboard";

    const handleNavClick = (path: string) => {
        router.push(path);
        setIsOpen(false);
    };

    const handleSignOut = async () => {
        setIsSigningOut(true);
        try {
            await signOut();
            router.push("/login");
        } finally {
            setIsSigningOut(false);
        }
    };

    return (
        <>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="fixed top-4 left-4 z-50 md:hidden p-2.5 rounded-xl glass-card border-gold-500/20 hover:border-gold-500/35 transition-colors"
                aria-label="Toggle menu"
            >
                <svg className="w-5 h-5 text-gold-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {isOpen ? (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    ) : (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    )}
                </svg>
            </button>

            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 md:hidden"
                    onClick={() => setIsOpen(false)}
                />
            )}

            <aside
                className={`
                    fixed top-0 left-0 h-full w-[17.5rem] z-40
                    glass-sidebar flex flex-col
                    transition-transform duration-300 ease-out
                    ${isOpen ? "translate-x-0" : "-translate-x-full"}
                    md:translate-x-0
                `}
            >
                <div className="p-5 border-b border-gold-500/10">
                    <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-xl overflow-hidden border border-gold-500/35 shadow-terminal-gold ring-1 ring-gold-500/10">
                            <img
                                src="/assets/trade-craft-logo.png"
                                alt="Trade-Craft Logo"
                                className="w-full h-full object-cover"
                            />
                        </div>
                        <div className="min-w-0">
                            <h1 className="text-sm font-display font-bold text-white tracking-tight">Trade-Craft</h1>
                            <p className="text-[10px] text-gold-400/80 font-semibold tracking-wide">Terminal · NSE Intelligence</p>
                            <p className="text-[10px] text-gray-500 mt-0.5 truncate">{meta.name}</p>
                        </div>
                    </div>
                </div>

                <nav className="flex-1 p-3 space-y-1 mt-1">
                    <p className="px-3 pb-2 text-[9px] font-bold uppercase tracking-[0.2em] text-gray-600">Navigation</p>
                    {navItems.map((item) => {
                        const active = activeTab === item.id;
                        const Icon = item.Icon;
                        return (
                            <button
                                key={item.id}
                                onClick={() => handleNavClick(item.path)}
                                className={`
                                    w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-semibold
                                    transition-all duration-200
                                    ${active ? "nav-item-active" : "text-gray-400 hover:text-gray-200 hover:bg-surface-800/50 border border-transparent"}
                                `}
                            >
                                <Icon className={`w-[18px] h-[18px] ${active ? "text-gold-400" : "text-gray-500"}`} />
                                {item.label}
                            </button>
                        );
                    })}
                </nav>

                <div className="mx-4 border-t border-gold-500/10" />

                <div className="p-4 pt-3">
                    <div className="px-3 py-3 rounded-xl bg-surface-900/60 border border-white/[0.06]">
                        <p className="text-[9px] text-gray-500 font-semibold uppercase tracking-widest">Session</p>
                        <p className="text-[11px] text-gray-200 font-medium truncate mt-1">{user?.email || "Unknown user"}</p>
                        <button
                            onClick={handleSignOut}
                            disabled={isSigningOut}
                            className="mt-3 w-full rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-300 text-[11px] font-bold py-2 hover:bg-rose-500/15 transition-colors"
                        >
                            {isSigningOut ? "Signing out..." : "Logout"}
                        </button>
                    </div>
                </div>

                <div className="p-4 pt-0 space-y-2">
                    <BuildBadge className="w-full text-center" />
                    <p className="text-center text-[9px] text-gray-600 font-medium tracking-wide">
                        Designed by Trade-Craft
                    </p>
                </div>
            </aside>
        </>
    );
}
