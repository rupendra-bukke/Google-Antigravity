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

      {/* ── CINEMATIC FULL HERO (TELUGU EDITION) ── */}
      <section className="relative h-screen flex items-center px-6 md:px-12 overflow-hidden">

        {/* THE WATERMARK LOGO (Low Opacity Background) */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-full pointer-events-none -z-20 flex items-center justify-center overflow-hidden">
          <img
            src="/DD-Logo.png"
            className="w-[800px] h-auto opacity-[0.03] rotate-12 scale-150 grayscale blur-sm"
            alt="Watermark"
          />
        </div>

        {/* Background Image Overlay */}
        <div className="absolute inset-0 -z-10">
          <img
            src={videos[0]?.thumbnail || "https://images.unsplash.com/photo-1588196749597-9ff075ee6b5b?auto=format&fit=crop&w=1920&q=80"}
            className="w-full h-full object-cover animate-slow-zoom"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-white via-white/40 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-white to-transparent" />
        </div>

        <div className="max-w-7xl mx-auto w-full grid lg:grid-cols-12 gap-16 items-center">

          <div className="lg:col-span-8 space-y-10 z-10">
            <div className="space-y-4">
              <span className="text-[10px] font-black uppercase tracking-[0.6em] text-brand-red animate-reveal block">
                ధన్య డైరీస్ • DHANYA DIARIES
              </span>

              <div className="relative">
                <h1 className="text-7xl md:text-[8rem] font-serif leading-[0.9] text-[#1a1515] tracking-tighter">
                  ఇంటి <br />
                  <span className="italic pl-12 text-brand-red font-light relative">
                    ఆత్మీయత.
                    <span className="absolute -bottom-2 inset-x-0 h-2 bg-brand-red/10 -z-10 -rotate-1 rounded-full" />
                  </span>
                </h1>
              </div>
            </div>

            <div className="flex flex-wrap gap-12 items-center pt-8">
              <button className="bg-brand-red text-white px-14 py-6 rounded-2xl font-black text-xs uppercase tracking-widest shadow-2xl hover:scale-105 transition-all shadow-brand-red/20 group overflow-hidden relative">
                <span className="relative z-10">మరిన్ని చూడండి</span>
                <div className="absolute inset-0 bg-[#c62828] translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
              </button>

              <div className="flex flex-col">
                <span className="text-[9px] font-black uppercase tracking-widest text-[#1a1515]/40 leading-none">అభిమానులు</span>
                <span className="text-3xl font-serif italic text-gray-500 mt-2">
                  {stats?.subscriberCount || "24.5K"} Souls
                </span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-4 relative mt-20 lg:mt-0">
            {/* Floating Mini Content Card */}
            <div className="p-10 rounded-[4rem] bg-white/40 backdrop-blur-3xl magazine-shadow border border-white/20 space-y-6 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-brand-red/5 rounded-full -translate-y-10 translate-x-10 blur-2xl group-hover:scale-150 transition-transform duration-1000" />

              <span className="px-3 py-1 rounded-full bg-brand-red/10 text-brand-red text-[8px] font-black uppercase tracking-widest inline-block">
                Kitchen Logic
              </span>

              <p className="text-lg font-serif italic leading-relaxed text-gray-700 relative z-10">
                "వంటలో ప్రేమ ఉంటే ఆ రుచే వేరు... ప్రతి ముద్ద ఒక జ్ఞాపకం."
              </p>

              <div className="pt-4 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-brand-red/10 flex items-center justify-center text-brand-red text-xs">☕</div>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Morning Rituals</span>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* ── THE JOURNAL SECTION (EDITORIAL) ── */}
      <section className="py-40 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          {/* Section Header */}
          <div className="flex flex-col md:flex-row justify-between items-end gap-12 mb-24 border-b border-gray-50 pb-16">
            <div className="space-y-6 max-w-2xl">
              <h2 className="text-6xl md:text-8xl font-serif text-[#1a1515] leading-none mb-4 tracking-tighter">
                జర్నల్ <span className="text-brand-red italic opacity-30">Archives.</span>
              </h2>
              <p className="text-gray-400 font-medium leading-relaxed uppercase text-[10px] tracking-widest pl-1">
                A SEASONAL COLLECTION OF LIFE, FOOD, AND MEMORIES
              </p>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-16">
            {videos.slice(1, 4).map((v, i) => (
              <a key={v.id} href={`https://youtube.com/watch?v=${v.id}`} className="group space-y-8 block">
                <div className="aspect-[4/5] rounded-[4rem] overflow-hidden magazine-shadow relative shadow-brand-red/5">
                  <img src={v.thumbnail} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-[3s] ease-out" />
                  <div className="absolute inset-0 bg-brand-red/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <div className="space-y-4 px-4">
                  <div className="flex items-center gap-3">
                    <span className="h-[1px] w-8 bg-brand-red/30"></span>
                    <span className="text-[9px] font-black uppercase tracking-widest text-brand-red">Episode {i + 1}</span>
                  </div>
                  <h3 className="text-4xl font-serif leading-[1.1] group-hover:text-brand-red transition-colors duration-500">{v.title}</h3>
                </div>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* ── FOOTER DECOR ── */}
      <footer className="py-60 text-center relative overflow-hidden bg-brand-paper">
        <img src="/DD-Logo.png" className="w-56 h-56 mx-auto opacity-[0.05] grayscale mb-12 animate-slow-spin" />
        <div className="space-y-4">
          <h3 className="text-5xl md:text-7xl font-serif italic text-[#1a1515]/10 tracking-tighter">ఇంకా ఎంతో ఉంది...</h3>
          <p className="text-[10px] font-black tracking-[0.6em] text-brand-red uppercase">Stay Connected</p>
        </div>
      </footer>

    </div>
  );
}
