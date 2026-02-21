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

                {/* Logo Group: Single Clean Branding */}
                <Link href="/" className="flex items-center group">
                    <img
                        src="/DD-Logo.png"
                        alt="Dhanya Diaries Logo"
                        className="w-14 h-14 md:w-20 md:h-20 object-contain hover:scale-110 transition-transform duration-500"
                    />
                </Link>

                {/* Desktop Navigation */}
                <nav className="hidden lg:flex items-center gap-8">
                    {navItems.map((item) => (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`text-[11px] font-black uppercase tracking-[0.2em] transition-colors ${pathname === item.href ? "text-brand-red" : "text-brand-text/50 hover:text-brand-red"}`}
                        >
                            {item.name}
                        </Link>
                    ))}
                </nav>

                {/* Action Group */}
                <div className="flex items-center gap-6">
                    <div className="hidden md:flex items-center bg-brand-peach px-4 py-2 rounded-full border border-brand-red/10">
                        <span className="text-sm mr-2 opacity-30">🔍</span>
                        <input
                            type="text"
                            placeholder="Search recipes..."
                            className="bg-transparent border-none outline-none text-[10px] font-bold uppercase tracking-widest w-24 focus:w-40 transition-all text-brand-text"
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

            {/* Mobile Menu */}
            {isMenuOpen && (
                <div className="lg:hidden absolute top-full inset-x-0 bg-white border-b border-brand-peach p-8 flex flex-col gap-6 animate-reveal">
                    {navItems.map((item) => (
                        <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setIsMenuOpen(false)}
                            className="text-lg font-serif font-black text-brand-text hover:text-brand-red"
                        >
                            {item.name}
                        </Link>
                    ))}
                </div>
            )}
        </header>
    );
}
