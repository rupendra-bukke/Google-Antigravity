"use client";

import { useEffect, useState } from "react";
import { getChannelStats, ChannelStats } from "@/lib/youtube";

export default function Header() {
    const [stats, setStats] = useState<ChannelStats | null>(null);
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 50);
        window.addEventListener("scroll", handleScroll);

        async function fetchStats() {
            const data = await getChannelStats();
            setStats(data);
        }
        fetchStats();

        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    const subscribeUrl = "https://www.youtube.com/channel/UC_UoV11Yx2u66CaBsvHPJiw?sub_confirmation=1";

    return (
        <header className={`fixed top-0 inset-x-0 z-50 transition-all duration-500 ${scrolled ? "glass-nav py-4" : "py-8"}`}>
            <div className="section-container flex items-center justify-between font-sans">

                {/* BRANDING: Symmetric & Balanced */}
                <div
                    className="flex items-center gap-5 cursor-pointer group"
                    onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                >
                    <div className="relative">
                        <img
                            src="/DD-Logo.png"
                            alt="Logo"
                            className="w-10 h-10 md:w-12 md:h-12 object-contain transition-transform duration-500 group-hover:scale-110"
                        />
                        <div className="absolute inset-0 bg-brand-red opacity-0 group-hover:opacity-10 rounded-full blur-xl transition-opacity" />
                    </div>
                    <div className="h-7 md:h-9">
                        <img
                            src="/DD-Title.png"
                            alt="Dhanya Diaries"
                            className="h-full w-auto object-contain"
                        />
                    </div>
                </div>

                {/* NAVIGATION: Minimalist Designer Links */}
                <nav className="hidden lg:flex items-center gap-10">
                    {['Journal', 'Kitchen', 'Lifestyle', 'Vlogs'].map((item) => (
                        <a
                            key={item}
                            href={`#${item.toLowerCase()}`}
                            className="text-[10px] font-bold uppercase tracking-[0.3em] text-brand-dark/40 hover:text-brand-red hover:tracking-[0.4em] transition-all duration-300"
                        >
                            {item}
                        </a>
                    ))}
                </nav>

                {/* STATS & CTA: High-End UI */}
                <div className="flex items-center gap-6 md:gap-10">
                    <div className="hidden sm:flex flex-col items-end">
                        <span className="text-xl md:text-2xl font-serif italic text-brand-dark/30 leading-none">
                            {stats?.subscriberCount || "24.5K"}
                        </span>
                        <span className="text-[7px] font-black uppercase tracking-[0.2em] text-brand-red mt-1">Founding Souls</span>
                    </div>

                    <a
                        href={subscribeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="relative overflow-hidden bg-brand-dark text-white text-[9px] font-black px-10 py-4.5 rounded-full transition-all duration-500 hover:bg-brand-red hover:px-12 flex items-center gap-2 group"
                    >
                        <span className="uppercase tracking-[0.2em]">Subscribe</span>
                        <span className="text-sm transition-transform group-hover:translate-x-1">→</span>
                    </a>
                </div>

            </div>
        </header>
    );
}
