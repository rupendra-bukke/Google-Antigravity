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
        <header className="fixed top-0 inset-x-0 z-50 subtle-glass h-20 md:h-24 flex items-center px-6 md:px-12">
            <div className="max-w-7xl mx-auto w-full flex items-center justify-between">

                {/* BRANDING: Simple & High-Contrast */}
                <div className="flex items-center gap-4 cursor-pointer group" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
                    <img src="/DD-Logo.png" alt="Logo" className="w-10 h-10 md:w-14 md:h-14 object-contain transition-transform group-hover:scale-110" />
                    <div className="flex flex-col">
                        <h1 className="text-xl md:text-2xl leading-none flex gap-1">
                            <span className="dhanya-style">Dhanya</span>
                            <span className="diaries-style">diaries</span>
                        </h1>
                        <span className="text-[8px] font-black uppercase tracking-[0.2em] text-gray-400 mt-1">Lifestyle Studio</span>
                    </div>
                </div>

                {/* NAVIGATION: Clean & Centered Focus */}
                <nav className="hidden lg:flex items-center gap-10">
                    {['Journal', 'Kitchen', 'Home', 'Vlogs'].map((item) => (
                        <a key={item} href={`#${item.toLowerCase()}`} className="text-[10px] font-black uppercase tracking-widest text-brand-charcoal/40 hover:text-brand-red transition-all">
                            {item}
                        </a>
                    ))}
                </nav>

                {/* CTA & STATS: Refined */}
                <div className="flex items-center gap-8">
                    <div className="hidden sm:flex flex-col items-end">
                        <span className="text-base md:text-lg font-serif italic text-gray-500 leading-none">
                            {stats?.subscriberCount || "24.5K"} Subscribers
                        </span>
                        <span className="text-[8px] font-black uppercase tracking-widest text-brand-red mt-1">Active Community</span>
                    </div>

                    <a
                        href={subscribeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-brand-red text-white text-[10px] font-black px-8 py-4 rounded-xl hover:bg-brand-charcoal transition-all uppercase tracking-widest shadow-lg shadow-brand-red/10"
                    >
                        Subscribe
                    </a>
                </div>

            </div>
        </header>
    );
}
