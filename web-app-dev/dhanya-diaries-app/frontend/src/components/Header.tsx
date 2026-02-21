"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Header() {
    const [scrolled, setScrolled] = useState(false);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const pathname = usePathname();

    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 20);
        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    const navItems = [
        { name: "Home", href: "/" },
        { name: "Recipes", href: "/recipes" },
        { name: "Cleaning", href: "/cleaning" },
        { name: "Vlogs", href: "/vlogs" },
        { name: "Community", href: "/community" },
    ];

    return (
        <header className={`fixed top-0 inset-x-0 z-50 transition-all duration-500 ${scrolled ? "bg-white/80 backdrop-blur-xl py-3 shadow-sm" : "py-6"}`}>
            <div className="max-w-7xl mx-auto px-6 md:px-12 flex items-center justify-between">

                {/* Logo Group: Prominent Single Branding */}
                <Link href="/" className="flex items-center group">
                    <img
                        src="/DD-Logo.png"
                        alt="Dhanya Diaries Logo"
                        className="w-20 h-20 md:w-36 md:h-36 object-contain hover:scale-105 transition-transform duration-700"
                    />
                </Link>

                {/* Desktop Navigation: Professional Studio Style */}
                <nav className="hidden lg:flex items-center gap-2 bg-white/40 p-2 rounded-full border border-brand-peach/50 backdrop-blur-sm">
                    {navItems.map((item) => (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`px-6 py-3 rounded-full text-[13px] font-black uppercase tracking-[0.2em] transition-all duration-500 relative group
                                ${pathname === item.href
                                    ? "bg-brand-peach text-brand-red shadow-sm"
                                    : "text-brand-text/40 hover:text-brand-text hover:bg-white"
                                }`}
                        >
                            {item.name}
                            {/* Sophisticated Dot Indicator */}
                            {pathname === item.href && (
                                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-brand-red rounded-full" />
                            )}
                        </Link>
                    ))}
                </nav>

                {/* Action Group: Matching Pill Search */}
                <div className="flex items-center gap-6">
                    <div className="hidden md:flex items-center bg-white/60 px-6 py-4 rounded-full border border-brand-peach focus-within:border-brand-red/30 focus-within:shadow-xl focus-within:shadow-brand-red/5 transition-all duration-500 backdrop-blur-sm">
                        <span className="text-sm mr-3 opacity-30">🔍</span>
                        <input
                            type="text"
                            placeholder="SEARCH RECIPES..."
                            className="bg-transparent border-none outline-none text-[11px] font-black uppercase tracking-[0.2em] w-32 focus:w-48 transition-all text-brand-text placeholder:text-brand-text/30"
                        />
                    </div>

                    <button
                        className="lg:hidden text-2xl"
                        onClick={() => setIsMenuOpen(!isMenuOpen)}
                    >
                        {isMenuOpen ? "✕" : "☰"}
                    </button>
                </div>
            </div>

            {/* Mobile Menu: High-End Studio Layout */}
            {isMenuOpen && (
                <div className="lg:hidden absolute top-full inset-x-4 mt-4 bg-white/95 backdrop-blur-2xl rounded-[3rem] border border-brand-peach/50 p-10 flex flex-col gap-8 shadow-2xl animate-reveal border-b-0">
                    <div className="flex flex-col gap-6">
                        {navItems.map((item) => (
                            <Link
                                key={item.href}
                                href={item.href}
                                onClick={() => setIsMenuOpen(false)}
                                className={`text-2xl font-serif font-black transition-colors ${pathname === item.href ? "text-brand-red" : "text-brand-text/60"}`}
                            >
                                {item.name}
                            </Link>
                        ))}
                    </div>
                    <div className="pt-8 border-t border-brand-peach/30">
                        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-brand-text/30 mb-4">Quick Search</p>
                        <div className="flex items-center bg-brand-peach/30 px-6 py-4 rounded-2xl">
                            <input type="text" placeholder="FIND RECIPES..." className="bg-transparent border-none outline-none text-xs font-bold w-full" />
                            <span>🔍</span>
                        </div>
                    </div>
                </div>
            )}
        </header>
    );
}
