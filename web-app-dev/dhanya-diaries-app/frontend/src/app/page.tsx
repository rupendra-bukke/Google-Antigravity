"use client";

import { useEffect, useState } from "react";
import { getLatestVideos, getChannelStats, YouTubeVideo, ChannelStats } from "@/lib/youtube";

export default function Home() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [videos, setVideos] = useState<YouTubeVideo[]>([]);
  const [stats, setStats] = useState<ChannelStats | null>(null);

  useEffect(() => {
    setIsLoaded(true);
    async function loadData() {
      const [vids, channelStats] = await Promise.all([
        getLatestVideos(6),
        getChannelStats()
      ]);
      setVideos(vids);
      setStats(channelStats);
    }
    loadData();
  }, []);

  return (
    <div className={`transition-opacity duration-1000 ${isLoaded ? "opacity-100" : "opacity-0"}`}>

      {/* ── DESIGNER MASTHEAD (HERO) ── */}
      <section className="relative min-h-screen flex items-center px-6 md:px-12 pt-32 pb-24 overflow-hidden">

        {/* Subtle Watermark Logo */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full pointer-events-none -z-20 opacity-[0.03]">
          <img src="/DD-Logo.png" className="w-[80vw] h-auto grayscale rotate-12 scale-110" />
        </div>

        {/* Ambient background Image */}
        <div className="absolute top-0 right-0 w-full lg:w-[60%] h-[70vh] lg:h-full -z-10">
          <div className="relative w-full h-full overflow-hidden">
            <img
              src={videos[0]?.thumbnail || "https://images.unsplash.com/photo-1588196749597-9ff075ee6b5b?auto=format&fit=crop&w=1920&q=80"}
              className="w-full h-full object-cover animate-zoom"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-white via-white/50 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-t from-white via-transparent to-transparent" />
          </div>
        </div>

        <div className="max-w-7xl mx-auto w-full grid lg:grid-cols-12 gap-16 items-center">

          <div className="lg:col-span-12 space-y-16">
            <div className="space-y-6">
              <p className="text-label animate-reveal">Lifestyle Brand • Est. 2024</p>
              <h1 className="text-[14vw] lg:text-[10rem] font-serif leading-[0.75] text-[#1a1515] tracking-tighter relative">
                Dhanya <br />
                <span className="italic pl-4 lg:pl-20 text-brand-red font-light">Diaries.</span>
              </h1>
              <h2 className="text-4xl lg:text-6xl font-serif italic text-gray-400 pl-4 lg:pl-32 mt-[-20px] lg:mt-[-40px]">
                ఇంటి ఆత్మీయత...
              </h2>
            </div>

            <div className="flex flex-col lg:flex-row gap-12 lg:items-end">
              <button className="bg-[#1a1515] text-white px-16 py-8 rounded-[2rem] font-black text-xs uppercase tracking-widest shadow-2xl hover:bg-brand-red transition-all active:scale-95 group">
                Explore Collection
                <span className="inline-block ml-4 group-hover:translate-x-2 transition-transform">→</span>
              </button>

              <div className="flex flex-col border-l-2 border-brand-red/10 pl-10 py-2">
                <span className="text-label !text-brand-red mb-2">Subscriber Base</span>
                <span className="text-4xl font-serif italic text-gray-400">
                  Join {stats?.subscriberCount || "24.5K"} Others
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── THE ART OF HOME (ASYMMETRIC GRID) ── */}
      <section className="py-40 bg-white overflow-hidden">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-12 gap-24 items-start">

            {/* Feature 1: The Kitchen (Telugu Anchor) */}
            <div className="lg:col-span-5 space-y-12">
              <div className="relative">
                <div className="aspect-[4/5] rounded-[5rem] overflow-hidden designer-shadow">
                  <img src={videos[1]?.thumbnail} className="w-full h-full object-cover hover:scale-110 transition-transform duration-[3s]" />
                </div>
                {/* Floating Telugu Tag */}
                <div className="absolute -bottom-10 -right-10 w-64 p-8 bg-brand-red rounded-[3rem] text-white shadow-2xl rotate-3">
                  <p className="text-2xl font-serif italic leading-snug">
                    "వంటలో ప్రేమ ఒక రహస్య వస్తువు."
                  </p>
                </div>
              </div>
              <div className="space-y-4 pt-10">
                <p className="text-label text-brand-red">Curated Kitchen Magic</p>
                <h3 className="text-5xl font-serif leading-tight">Mastering the <br /> Indian Spice Box.</h3>
              </div>
            </div>

            {/* Feature 2: High Editorial */}
            <div className="lg:col-span-7 lg:pt-40 space-y-12">
              <div className="aspect-video rounded-[5rem] overflow-hidden designer-shadow relative">
                <img src={videos[2]?.thumbnail} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/20 hover:bg-transparent transition-colors duration-500" />
              </div>
              <div className="grid md:grid-cols-2 gap-12">
                <div className="space-y-4">
                  <p className="text-label">Seasonal Vlogs</p>
                  <h3 className="text-3xl font-serif">A Morning in <br /> My Garden.</h3>
                </div>
                <div className="space-y-4">
                  <p className="text-label">Home Organization</p>
                  <h3 className="text-3xl font-serif underline decoration-brand-red/30">Minimalist <br /> Living Space.</h3>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── THE ARCHIVES (TIERED GRID) ── */}
      <section className="py-40 bg-brand-paper">
        <div className="max-w-7xl mx-auto px-6 text-center mb-24">
          <h2 className="text-7xl lg:text-9xl font-serif tracking-tighter mb-8 leading-none">Journal <span className="italic text-brand-red">04</span></h2>
          <p className="text-label">Recent Discoveries & Tips</p>
        </div>

        <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-3 gap-12">
          {videos.slice(3, 6).map((v, i) => (
            <a key={v.id} href={`https://youtube.com/watch?v=${v.id}`} className="group block space-y-8">
              <div className="aspect-[1/1] rounded-full overflow-hidden border-[15px] border-white designer-shadow">
                <img src={v.thumbnail} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-[2s]" />
              </div>
              <div className="px-8 space-y-3">
                <p className="text-[9px] font-black uppercase text-brand-red tracking-[0.3em]">Volume 2.{i + 1}</p>
                <h3 className="text-2xl font-serif leading-tight">{v.title}</h3>
              </div>
            </a>
          ))}
        </div>
      </section>

      {/* ── FOOTER MASTHEAD ── */}
      <footer className="py-60 bg-[#1a1515] text-white text-center relative overflow-hidden">
        <img src="/DD-Logo.png" className="w-96 h-96 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.03] grayscale invert" />
        <div className="space-y-12 relative z-10 px-6">
          <h3 className="text-6xl lg:text-8xl font-serif italic tracking-tighter">ఇంకా ఎంతో ఉంది...</h3>
          <div className="flex justify-center gap-12">
            {['Instagram', 'YouTube', 'Email'].map(social => (
              <a key={social} href="#" className="text-label !text-white/50 hover:!text-brand-red transition-all cursor-pointer">{social}</a>
            ))}
          </div>
          <p className="text-[9px] font-black uppercase tracking-[0.5em] text-white/20 pt-12">© 2026 Dhanya Diaries Studio</p>
        </div>
      </footer>

    </div>
  );
}
