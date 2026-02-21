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
        <header className="fixed top-0 inset-x-0 z-50 pt-8 px-6 md:px-12 pointer-events-none">
            <div className="max-w-7xl mx-auto flex items-center justify-between pointer-events-auto red-glass rounded-[2rem] px-8 py-5 transition-all outline outline-1 outline-white/20">

                {/* LEFT: BRANDING */}
                <div className="flex items-center gap-6 group cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
                    <img src="/DD-Logo.png" alt="Logo" className="w-12 h-12 md:w-14 md:h-14 object-contain transition-transform group-hover:scale-110" />
                    <div className="flex flex-col">
                        <h1 className="font-serif text-2xl md:text-3xl font-black text-brand-red leading-none">Dhanya diaries</h1>
                        <span className="text-[9px] font-black uppercase tracking-[0.4em] text-gray-400 mt-1">Lifestyle • Home</span>
                    </div>
                </div>

                {/* CENTER: CLEAN NAV */}
                <nav className="hidden lg:flex items-center gap-12 border-x border-gray-100 px-12">
                    {['Journal', 'Kitchen', 'Home', 'Vlogs'].map((item) => (
                        <a key={item} href={`#${item.toLowerCase()}`} className="nav-link text-[10px] font-black hover:text-brand-red transition-colors">{item}</a>
                    ))}
                </nav>

                {/* RIGHT: STATS & CTA */}
                <div className="flex items-center gap-10">
                    <div className="hidden xl:flex flex-col items-end border-r border-gray-100 pr-10">
                        <div className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                            <span className="text-[9px] font-black uppercase tracking-widest text-brand-red/60">Community</span>
                        </div>
                        <span className="text-xl font-serif italic text-gray-500 mt-1 leading-none">
                            {stats?.subscriberCount || "24.5K"} Fans
                        </span>
                    </div>

                    <a
                        href={subscribeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-brand-red text-white text-[10px] font-black px-10 py-5 rounded-2xl hover:bg-[#c62828] transition-all uppercase tracking-[0.2em] shadow-lg shadow-brand-red/20 active:scale-95"
                    >
                        Subscribe
                    </a>
                </div>

            </div>
        </header>
    );
}
