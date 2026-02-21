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

      {/* ── DESIGNER SPLIT HERO ── */}
      <section className="relative min-h-[95vh] flex items-center pt-24">
        <div className="section-container w-full grid lg:grid-cols-12 gap-12 md:gap-24 items-center">

          {/* Content Column */}
          <div className="lg:col-span-6 space-y-12 animate-reveal">
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <span className="h-[2px] w-12 bg-brand-red/20" />
                <span className="text-label !text-brand-red">Lifestyle Studio • Hyderabad</span>
              </div>

              <div className="relative">
                <img
                  src="/DD-Title.png"
                  alt="Dhanya Diaries"
                  className="w-full max-w-[500px] h-auto"
                />
              </div>

              <h2 className="text-4xl md:text-6xl font-serif italic text-brand-dark/20 leading-tight">
                Crafting the beauty of <br />
                everyday home stories.
              </h2>
            </div>

            <p className="text-xl md:text-2xl text-brand-dark/60 leading-relaxed font-light max-w-lg">
              Through my kitchen secrets and interior rituals, I invite you to redefine warmth in your own space.
            </p>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-8 pt-4">
              <button className="bg-brand-dark text-white px-14 py-6 rounded-full font-black text-[10px] uppercase tracking-[0.3em] hover:bg-brand-red transition-all duration-500 premium-shadow">
                Enter the Journal
              </button>
              <div className="telugu-signature text-3xl md:text-5xl opacity-80">
                ఇంటి ఆత్మీయత...
              </div>
            </div>
          </div>

          {/* Imagery Column */}
          <div className="lg:col-span-6 relative">
            <div className="editorial-img-wrapper aspect-[3/4] lg:aspect-[4/5] scale-105">
              <img
                src={videos[0]?.thumbnail || "https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=1200&q=1500"}
                className="w-full h-full object-cover animate-pan"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-brand-dark/20 to-transparent" />
            </div>
            {/* Absolute Watermark Decoration */}
            <div className="absolute -bottom-20 -left-20 w-80 h-80 opacity-[0.03] select-none pointer-events-none -rotate-12">
              <img src="/DD-Logo.png" className="w-full h-full object-contain grayscale" />
            </div>
            {/* Floating Quote Card */}
            <div className="absolute bottom-12 -right-6 md:-right-12 p-8 md:p-12 bg-white/90 backdrop-blur-3xl rounded-[3rem] premium-shadow max-w-xs space-y-4 border border-white">
              <span className="text-[8px] font-black uppercase tracking-widest text-brand-red">Kitchen Wisdom</span>
              <p className="text-lg font-serif italic text-brand-dark/80 italic leading-relaxed">
                "వంటలో ప్రేమ ఒక రహస్య వస్తువు."
              </p>
            </div>
          </div>

        </div>
      </section>

      {/* ── STAGGERED EDITORIAL GALLERY ── */}
      <section className="py-60 section-container">
        <div className="text-center mb-40 space-y-6">
          <h2 className="text-7xl md:text-[10rem] font-serif text-brand-dark/5 leading-none tracking-tighter absolute inset-x-0 -mt-20 select-none">ARCHITECTURE</h2>
          <p className="text-label text-brand-red relative z-10">Seasonal Archives</p>
          <h3 className="text-5xl md:text-8xl font-serif text-brand-dark tracking-tighter relative z-10">Journal Editions.</h3>
        </div>

        <div className="grid md:grid-cols-12 gap-12 md:gap-32">
          {/* Entry 1: Large Feature */}
          <div className="md:col-span-7 space-y-10 group">
            <div className="editorial-img-wrapper aspect-video">
              <img src={videos[1]?.thumbnail} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-[2s]" />
            </div>
            <div className="space-y-4 px-4">
              <span className="text-[9px] font-black tracking-[0.4em] text-brand-red/40 uppercase">Volume 01</span>
              <h4 className="text-4xl md:text-5xl font-serif group-hover:text-brand-red transition-colors">{videos[1]?.title}</h4>
            </div>
          </div>

          {/* Entry 2: Elevated Small */}
          <div className="md:col-span-5 md:pt-40 space-y-10 group">
            <div className="editorial-img-wrapper aspect-[4/5]">
              <img src={videos[2]?.thumbnail} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-[2s]" />
            </div>
            <div className="space-y-4 px-4">
              <span className="text-[9px] font-black tracking-[0.4em] text-brand-red/40 uppercase">Volume 02</span>
              <h4 className="text-4xl font-serif group-hover:text-brand-red transition-colors">{videos[2]?.title}</h4>
            </div>
          </div>

          {/* Entry 3 & 4: Symmetrical Row */}
          {videos.slice(3, 5).map((v, i) => (
            <div key={v.id} className="md:col-span-6 space-y-10 group mt-12 md:mt-24">
              <div className="editorial-img-wrapper aspect-[16/10]">
                <img src={v.thumbnail} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-[2s]" />
              </div>
              <div className="space-y-4 px-4">
                <span className="text-[9px] font-black tracking-[0.4em] text-brand-red/40 uppercase">Volume 0{i + 3}</span>
                <h4 className="text-3xl md:text-4xl font-serif group-hover:text-brand-red transition-colors">{v.title}</h4>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── THE STUDIO FOOTER ── */}
      <footer className="bg-brand-dark py-40 text-white overflow-hidden relative">
        {/* Background Watermark */}
        <div className="absolute inset-0 flex items-center justify-center opacity-[0.02] scale-150 rotate-6 pointer-events-none">
          <h2 className="text-[30vw] font-serif font-black tracking-tighter">DHANYA</h2>
        </div>

        <div className="section-container relative z-10 text-center space-y-20">
          <div className="space-y-8">
            <img src="/DD-Logo.png" className="w-20 h-20 mx-auto grayscale invert" />
            <div className="max-w-md mx-auto">
              <img src="/DD-Title.png" className="w-full h-auto invert brightness-200" alt="Dhanya Diaries" />
            </div>
            <p className="telugu-signature text-5xl md:text-7xl !text-white opacity-20 italic">ఇంకా ఎంతో ఉంది...</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-12 pt-20 border-t border-white/5">
            {['Instagram', 'YouTube', 'Email', 'Pinterest'].map(social => (
              <a key={social} href="#" className="text-label !text-white/40 hover:!text-white transition-all text-center">{social}</a>
            ))}
          </div>

          <div className="flex flex-col md:flex-row justify-between items-center gap-8 text-[9px] font-bold text-white/20 uppercase tracking-[0.5em] pt-20">
            <span>&copy; 2026 DHANYA DIARIES</span>
            <div className="flex gap-12">
              <span>Privacy Policy</span>
              <span>Terms Of Living</span>
            </div>
          </div>
        </div>
      </footer>

    </div>
  );
}
