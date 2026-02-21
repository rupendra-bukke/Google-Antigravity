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

      {/* ── CINEMATIC FULL HERO ── */}
      <section className="relative h-screen flex items-end pb-24 px-6 md:px-12 overflow-hidden">

        {/* Background Video/Image Overlay */}
        <div className="absolute inset-0 -z-10">
          <img
            src={videos[0]?.thumbnail || "https://images.unsplash.com/photo-1588196749597-9ff075ee6b5b?auto=format&fit=crop&w=1920&q=80"}
            className="w-full h-full object-cover animate-slow-zoom"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#fffdfd] via-[#fffdfd]/30 to-transparent" />
        </div>

        <div className="max-w-7xl mx-auto w-full grid lg:grid-cols-12 gap-12 items-end">
          <div className="lg:col-span-8 space-y-8">
            <div className="overflow-hidden">
              <p className="text-[10px] font-black uppercase tracking-[0.5em] text-brand-red animate-reveal">EST. 2024 • DHANYA DIARIES</p>
            </div>

            <h1 className="text-6xl md:text-[10rem] font-serif leading-[0.85] text-[#1a1515] tracking-tighter">
              Warmth <br />
              <span className="italic pl-4 text-brand-red font-light">Defined.</span>
            </h1>

            <div className="flex flex-wrap gap-12 items-center pt-8">
              <button className="bg-[#e53935] text-white px-12 py-6 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-2xl hover:scale-105 transition-transform">
                Explore Latest
              </button>
              <div className="space-y-1">
                <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">Total Reach</p>
                <p className="text-xl font-serif italic">{stats?.subscriberCount || "5.2K"} Amazing Souls</p>
              </div>
            </div>
          </div>

          <div className="lg:col-span-4 hidden lg:block">
            <div className="p-8 rounded-[3rem] glass-effect magazine-shadow space-y-4">
              <span className="text-[9px] font-black uppercase tracking-widest text-brand-red">Curated Tip</span>
              <p className="text-sm font-serif italic leading-relaxed text-gray-700">
                "A pinch of roasted cumin doesn't just add flavor—it grounds the entire dish with a smoky, earthen soul."
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── THE JOURNAL SECTION (EDITORIAL) ── */}
      <section className="py-40 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-end gap-12 mb-24">
            <div className="space-y-4 max-w-xl">
              <h2 className="text-5xl md:text-7xl font-serif text-[#1a1515]">The Journal Archives.</h2>
              <p className="text-gray-400 font-medium leading-relaxed uppercase text-[10px] tracking-widest">A seasonal collection of recipes and stories</p>
            </div>
            <div className="flex gap-4">
              <button className="h-14 w-14 rounded-full border border-gray-100 flex items-center justify-center hover:border-brand-red transition-all">←</button>
              <button className="h-14 w-14 rounded-full bg-[#1a1515] text-white flex items-center justify-center hover:bg-brand-red transition-all">→</button>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-12">
            {videos.slice(1, 4).map((v, i) => (
              <a key={v.id} href={`https://youtube.com/watch?v=${v.id}`} className="group space-y-8">
                <div className="aspect-[4/5] rounded-[3rem] overflow-hidden magazine-shadow">
                  <img src={v.thumbnail} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-[2s]" />
                </div>
                <div className="space-y-4">
                  <span className="text-[9px] font-black uppercase tracking-widest text-brand-red">Volume {Math.floor(Math.random() * 20) + 1}</span>
                  <h3 className="text-3xl font-serif leading-tight group-hover:text-brand-red transition-colors">{v.title}</h3>
                </div>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* ── FOOTER DECOR ── */}
      <footer className="py-40 text-center space-y-16">
        <img src="/DD-Logo.png" className="w-32 h-32 mx-auto logo-glow opacity-30" />
        <h3 className="text-4xl md:text-6xl font-serif italic text-gray-300">Making life a little more beautiful.</h3>
      </footer>

    </div>
  );
}
