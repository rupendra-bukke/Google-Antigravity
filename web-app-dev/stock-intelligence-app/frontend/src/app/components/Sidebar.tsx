"use client";

import { useState } from "react";
import { useSymbol } from "../context/SymbolContext";

const SYMBOL_META: Record<string, { name: string; initial: string }> = {
    "^NSEI": { name: "NIFTY 50", initial: "N" },
    "^NSEBANK": { name: "Bank NIFTY", initial: "B" },
    "^BSESN": { name: "SENSEX", initial: "S" },
};

const navItems = [
    { label: "Dashboard", icon: "📊", id: "dashboard" },
    { label: "Watchlist", icon: "👁️", id: "watchlist", comingSoon: true },
    { label: "History", icon: "📈", id: "history", comingSoon: true },
    { label: "Settings", icon: "⚙️", id: "settings", comingSoon: true },
];

export default function Sidebar() {
    const { selectedSymbol } = useSymbol();
    const [isOpen, setIsOpen] = useState(false);
    const [activeTab, setActiveTab] = useState("dashboard");
    const [showToast, setShowToast] = useState<string | null>(null);

    const meta = SYMBOL_META[selectedSymbol] || { name: selectedSymbol, initial: "?" };

    const handleNavClick = (id: string, comingSoon?: boolean) => {
        if (comingSoon) {
            setShowToast(id);
            setTimeout(() => setShowToast(null), 2000);
            return;
        }
        setActiveTab(id);
        setIsOpen(false);
    };

    return (
        <>
            {/* Mobile hamburger */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="fixed top-4 left-4 z-50 md:hidden p-2.5 rounded-xl glass-card hover:bg-gray-800/60 transition-colors"
                aria-label="Toggle menu"
            >
                <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    {isOpen ? (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    ) : (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    )}
                </svg>
            </button>

            {/* Overlay */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/50 backdrop-blur-sm z-30 md:hidden transition-opacity"
                    onClick={() => setIsOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside
                className={`
          fixed top-0 left-0 h-full w-64 z-40
          glass-sidebar flex flex-col
          transition-transform duration-300 ease-out
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
          md:translate-x-0
        `}
            >
                {/* Logo */}
                <div className="p-6 border-b border-gray-800/30">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gray-800/50 flex items-center justify-center overflow-hidden border border-gray-700/50">
                            <img
                                src="/rb-logo.png"
                                alt="Logo"
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                    // Fallback to initial if image fails
                                    (e.target as HTMLImageElement).style.display = 'none';
                                    (e.target as HTMLImageElement).parentElement!.innerHTML = `<span class="text-white font-black text-lg">${meta.initial}</span>`;
                                    (e.target as HTMLImageElement).parentElement!.classList.add('bg-gradient-to-br', 'from-brand-500', 'to-brand-700');
                                }}
                            />
                        </div>
                        <div>
                            <h1 className="text-sm font-bold text-white tracking-tight transition-all duration-300">
                                Trade-Craft
                            </h1>
                            <p className="text-[10px] text-gray-500 font-semibold tracking-wide">
                                RB Stock Intelligence
                            </p>
                        </div>
                    </div>
                </div>

                {/* Navigation */}
                <nav className="flex-1 p-3 space-y-0.5 mt-2">
                    {navItems.map((item) => (
                        <button
                            key={item.id}
                            onClick={() => handleNavClick(item.id, item.comingSoon)}
                            className={`
                w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-[13px] font-medium
                transition-all duration-200 relative group
                ${activeTab === item.id
                                    ? "bg-brand-500/10 text-brand-400"
                                    : "text-gray-500 hover:text-gray-300 hover:bg-gray-800/40"
                                }
              `}
                        >
                            <span className="text-base">{item.icon}</span>
                            {item.label}
                            {item.comingSoon && (
                                <span className="ml-auto text-[8px] font-bold uppercase tracking-widest text-gray-600 bg-gray-800/50 px-1.5 py-0.5 rounded">
                                    Soon
                                </span>
                            )}

                            {showToast === item.id && (
                                <span className="absolute left-full ml-3 px-3 py-1.5 rounded-lg bg-gray-800 text-[11px] text-gray-300 border border-gray-700/50 whitespace-nowrap shadow-xl animate-fade-in z-50">
                                    🚧 Coming soon!
                                </span>
                            )}
                        </button>
                    ))}
                </nav>

                {/* Divider line */}
                <div className="mx-4 border-t border-gray-800/30" />

                {/* Footer */}
                <div className="p-4">
                    <div className="px-4 py-3 rounded-xl bg-gradient-to-br from-gray-800/20 to-gray-800/40 text-center border border-gray-800/30">
                        <p className="text-[9px] text-gray-600 font-semibold uppercase tracking-widest">Designed by</p>
                        <p className="text-[11px] font-bold bg-gradient-to-r from-brand-400 to-emerald-400 bg-clip-text text-transparent mt-0.5">
                            Rupendra Bukke
                        </p>
                    </div>
                </div>
            </aside>
        </>
    );
}
