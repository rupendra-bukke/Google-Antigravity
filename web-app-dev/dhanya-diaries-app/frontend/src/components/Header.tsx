"use client";

import { useEffect, useState } from "react";
import { getChannelStats, ChannelStats } from "@/lib/youtube";

export default function Header() {
    const [stats, setStats] = useState<ChannelStats | null>(null);

    useEffect(() => {
        async function fetchStats() {
            const data = await getChannelStats();
            setStats(data);
        }
        fetchStats();
    }, []);

    const subscribeUrl = "https://www.youtube.com/channel/UC_UoV11Yx2u66CaBsvHPJiw?sub_confirmation=1";

    return (
        <header className="fixed top-0 inset-x-0 z-50 pt-6 md:pt-10 px-4 md:px-12 pointer-events-none">
            <div className="max-w-7xl mx-auto flex items-center justify-between pointer-events-auto bg-white/80 backdrop-blur-3xl border border-brand-red/20 rounded-[2.5rem] p-5 md:p-8 shadow-[0_30px_60px_-15px_rgba(229,57,53,0.15)]">

                {/* Brand Group - MASSIVE */}
                <div className="flex items-center gap-6 md:gap-8 group cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
                    <div className="relative">
                        <img
                            src="/DD-Logo.png"
                            alt="Logo"
                            className="w-16 h-16 md:w-24 md:h-24 object-contain transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3 shadow-xl rounded-2xl"
                        />
                        <div className="absolute -top-2 -right-2 w-5 h-5 bg-brand-red rounded-full border-4 border-white animate-bounce shadow-lg" />
                    </div>
                    <div className="flex flex-col">
                        <span className="font-serif text-3xl md:text-5xl font-black text-brand-red tracking-tighter leading-none">Dhanya diaries</span>
                        <span className="text-[10px] md:text-[11px] font-black uppercase tracking-[0.5em] text-gray-400 mt-2 ml-1">Lifestyle • Cooking • Home</span>
                    </div>
                </div>

                {/* Navigation - Hidden on small, Elegant on Large */}
                <nav className="hidden xl:flex items-center gap-10">
                    {['Journal', 'Kitchen', 'Styling', 'Vlogs'].map((item) => (
                        <a key={item} href={`#${item.toLowerCase()}`} className="nav-link text-sm hover:scale-110 transition-transform">{item}</a>
                    ))}
                </nav>

                {/* Action Group - IMPACTFUL */}
                <div className="flex items-center gap-6 md:gap-10">
                    <div className="hidden lg:flex flex-col items-end">
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-brand-red leading-none">Live Community</span>
                        </div>
                        <span className="text-xl md:text-2xl font-serif italic font-light text-gray-600 mt-1">
                            {stats?.subscriberCount || "24.5K"} Subscribers
                        </span>
                    </div>

                    <a
                        href={subscribeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group relative overflow-hidden bg-brand-red text-white text-xs md:text-sm font-black px-10 md:px-14 py-5 md:py-6 rounded-3xl transition-all hover:scale-105 active:scale-95 shadow-[0_20px_40px_-10px_rgba(229,57,53,0.4)]"
                    >
                        <span className="relative z-10 uppercase tracking-[0.2em]">Subscribe</span>
                        <div className="absolute inset-0 bg-[#c62828] translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                    </a>
                </div>

            </div>
        </header>
    );
}
