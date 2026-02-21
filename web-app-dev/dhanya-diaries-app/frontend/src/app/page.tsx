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
        getLatestVideos(8),
        getChannelStats()
      ]);
      setVideos(vids);
      setStats(channelStats);
    }
    loadData();
  }, []);

  return (
    <div className={`transition-opacity duration-1000 ${isLoaded ? "opacity-100" : "opacity-0"}`}>

      {/* ── SECTION 1: THE STUDIO MASTHEAD ── */}
      <section className="relative pt-40 pb-20 px-6 md:px-12 text-center">
        <div className="max-w-4xl mx-auto space-y-8 animate-reveal">
          <div className="flex flex-col items-center gap-6">
            <span className="text-[10px] font-black uppercase tracking-[0.5em] text-brand-red">Curating the Home</span>

            <div className="flex flex-col items-center">
              <img
                src="/DD-Title.png"
                alt="Dhanya Diaries"
                className="w-full max-w-[900px] h-auto animate-reveal drop-shadow-2xl"
              />
            </div>
          </div>

          <p className="text-lg md:text-xl text-gray-500 max-w-xl mx-auto font-medium leading-relaxed">
            Discover a collection of kitchen secrets, interior stories, and the quiet beauty of everyday living.
          </p>

          <div className="pt-8">
            <button className="bg-brand-charcoal text-white px-12 py-6 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-brand-red transition-all shadow-2xl">
              Explore the Journal
            </button>
          </div>
        </div>
      </section>

      {/* ── SECTION 2: THE FEATURED DIARY (CLEAN GRID) ── */}
      <section className="py-20 px-6 md:px-12">
        <div className="max-w-7xl mx-auto">
          {/* LARGE FEATURE PIECE */}
          <div className="grid lg:grid-cols-12 gap-12 items-center mb-32">
            <div className="lg:col-span-8">
              <div className="designer-card aspect-video relative group">
                <img
                  src={videos[0]?.thumbnail || "https://images.unsplash.com/photo-1588196749597-9ff075ee6b5b?auto=format&fit=crop&w=1200&q=80"}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000"
                />
                <div className="absolute inset-0 bg-brand-charcoal/10 group-hover:bg-transparent transition-all duration-500" />
              </div>
            </div>
            <div className="lg:col-span-4 space-y-6">
              <span className="text-[10px] font-black uppercase tracking-widest text-brand-red">Latest Upload</span>
              <h2 className="text-4xl md:text-5xl leading-tight text-brand-charcoal">
                {videos[0]?.title || "A Soulful Morning Ritual"}
              </h2>
              <p className="text-gray-500 leading-relaxed italic font-serif">
                "వంటలో ప్రేమ ఒక రహస్య వస్తువు."
              </p>
            </div>
          </div>

          {/* SEASONS GRID */}
          <div className="grid md:grid-cols-3 gap-12 md:gap-20">
            {videos.slice(1, 4).map((v, i) => (
              <a key={v.id} href={`https://youtube.com/watch?v=${v.id}`} className="group space-y-8 designer-card-hover block">
                <div className="aspect-[4/5] designer-card">
                  <img src={v.thumbnail} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-[3s]" />
                </div>
                <div className="px-2 space-y-4">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-[1px] bg-brand-red/30" />
                    <span className="text-[9px] font-black uppercase tracking-widest text-brand-red">Edition 0{i + 1}</span>
                  </div>
                  <h3 className="text-3xl leading-snug group-hover:text-brand-red transition-colors">{v.title}</h3>
                </div>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECTION 3: REFINED FOOTER ── */}
      <footer className="py-40 bg-brand-charcoal text-white text-center px-6">
        <div className="max-w-4xl mx-auto space-y-12">
          <img src="/DD-Logo.png" className="w-20 h-20 mx-auto opacity-20 grayscale invert" />

          <div className="flex justify-center py-10">
            <img
              src="/DD-Title.png"
              alt="Dhanya Diaries"
              className="w-full max-w-[600px] h-auto opacity-80 invert brightness-200"
            />
          </div>

          <h3 className="text-4xl md:text-6xl font-serif italic text-white/10 tracking-tighter">ఇంకా ఎంతో ఉంది...</h3>
          <div className="h-[1px] w-20 bg-brand-red/30 mx-auto" />
          <div className="flex justify-center gap-10">
            {['Instagram', 'YouTube', 'Email'].map(social => (
              <a key={social} href="#" className="text-[10px] font-black uppercase tracking-[0.3em] text-white/30 hover:text-brand-red transition-all cursor-pointer">{social}</a>
            ))}
          </div>
          <p className="text-[10px] font-black tracking-[0.5em] text-white/10 pt-12">© 2026 Dhanya Diaries</p>
        </div>
      </footer>

    </div>
  );
}
