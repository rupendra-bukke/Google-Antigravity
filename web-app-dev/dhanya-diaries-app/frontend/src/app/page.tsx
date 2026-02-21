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

      {/* ── DESIGNER HERO ── */}
      <section className="relative min-h-[90vh] flex items-center px-6 md:px-12 pt-20">
        <div className="max-w-7xl mx-auto w-full grid lg:grid-cols-12 gap-12 items-center">

          <div className="lg:col-span-6 space-y-10 z-20 animate-fade-up">
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <span className="h-[1px] w-12 bg-brand-primary"></span>
                <p className="text-[11px] font-bold uppercase tracking-[0.4em] text-brand-primary">Premiering Season 04</p>
              </div>
              <h1 className="text-6xl md:text-8xl leading-[0.95] font-serif text-[#2d1a1a]">
                The Art of <br />
                <span className="italic font-light pl-6 text-brand-primary">Warm</span> Home.
              </h1>
            </div>

            <p className="text-lg text-gray-500 max-w-md font-medium leading-relaxed">
              Exploring the intersection of gourmet flavors, organized spaces, and the quiet beauty of a digital diary.
            </p>

            <div className="flex gap-6 items-center">
              <button className="bg-brand-primary text-white px-10 py-5 rounded-full font-bold text-xs uppercase tracking-widest hover:bg-[#c62828] transition-all shadow-2xl shadow-brand-primary/20">
                Watch Latest
              </button>
              <div className="flex -space-x-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="w-10 h-10 rounded-full border-2 border-white bg-brand-accent overflow-hidden">
                    <img src={`https://i.pravatar.cc/100?img=${i + 10}`} alt="fan" />
                  </div>
                ))}
                <div className="pl-6 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  Joined by {stats?.subscriberCount || "5K"}+ others
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-6 relative">
            <div className="relative aspect-[4/5] rounded-[4rem] overflow-hidden shadow-[0_50px_100px_-20px_rgba(229,57,53,0.1)] group animate-fade-up" style={{ animationDelay: "0.2s" }}>
              <img
                src={videos[0]?.thumbnail || "https://images.unsplash.com/photo-1588196749597-9ff075ee6b5b?auto=format&fit=crop&w=1200&q=80"}
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-[2s]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-brand-primary/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="absolute bottom-10 left-10 text-white opacity-0 group-hover:opacity-100 translate-y-4 group-hover:translate-y-0 transition-all duration-500">
                <p className="text-[10px] font-bold uppercase tracking-widest mb-1">Featured Video</p>
                <h3 className="text-xl font-serif max-w-xs">{videos[0]?.title || "Spices of India: My Favorites"}</h3>
              </div>
            </div>

            {/* Floating Mini Card */}
            <div className="absolute -bottom-10 -right-6 md:-right-12 glass-nav p-8 rounded-[2.5rem] shadow-2xl max-w-[240px] hidden md:block animate-fade-up border-brand-primary/10" style={{ animationDelay: "0.4s" }}>
              <p className="text-[10px] font-black uppercase tracking-widest text-brand-primary mb-3">Kitchen Logic</p>
              <h4 className="text-sm font-serif italic leading-relaxed text-[#2d1a1a]">
                "Slow-cooking your red chilies in oil releases a vibrant sunset hue instantly."
              </h4>
            </div>
          </div>
        </div>
      </section>

      {/* ── EDITORIAL GRID (ASIMMETRIC) ── */}
      <section className="px-6 md:px-12 py-32 bg-white/40">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-12 gap-16">

            <div className="lg:col-span-4 space-y-12">
              <div className="sticky top-32 space-y-6">
                <h2 className="text-5xl font-serif text-[#2d1a1a]">Journal <br /> Archives</h2>
                <p className="text-gray-400 font-medium leading-relaxed">
                  A curated collection of my most loved recipes and home organization systems.
                </p>
                <div className="flex flex-col gap-4 pt-4">
                  {['Kitchen Magic', 'Room Styling', 'Daily Vlogs'].map((btn) => (
                    <button key={btn} className="w-full text-left py-4 border-b border-brand-primary/10 hover:border-brand-primary hover:text-brand-primary transition-all font-bold text-xs uppercase tracking-[0.2em]">
                      {btn}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="lg:col-span-8 grid md:grid-cols-2 gap-8">
              {videos.slice(1, 5).map((v, i) => (
                <a key={v.id} href={`https://youtube.com/watch?v=${v.id}`} className={`editorial-card group ${i === 1 ? 'md:mt-12' : ''} ${i === 2 ? 'md:-mt-12' : ''}`}>
                  <div className="aspect-[3/4] overflow-hidden">
                    <img src={v.thumbnail} className="w-full h-full object-cover group-hover:scale-105 transition-all duration-700" />
                  </div>
                  <div className="p-8 space-y-3">
                    <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-[0.2em] text-brand-primary/40">
                      <span>Episode {stats?.videoCount ? parseInt(stats.videoCount) - i : 100}</span>
                      <span>{v.publishedAt}</span>
                    </div>
                    <h3 className="text-xl font-serif leading-[1.2] group-hover:text-brand-primary transition-colors line-clamp-2">
                      {v.title}
                    </h3>
                  </div>
                </a>
              ))}
            </div>

          </div>
        </div>
      </section>

      {/* ── SIGNATURE SECTION ── */}
      <section className="px-6 md:px-12 py-32 bg-[#fffcfb]">
        <div className="max-w-4xl mx-auto text-center space-y-10">
          <img src="/DD-Logo.png" className="w-24 h-24 mx-auto transition-transform hover:scale-110 duration-700" />
          <h2 className="text-5xl md:text-7xl font-serif text-[#2d1a1a]">
            Bringing a <span className="text-brand-primary italic">warm glow</span> <br /> to your home.
          </h2>
          <p className="text-xl text-gray-500 font-medium tracking-wide">
            Keep discovering new tricks every week.
          </p>
          <button className="bg-brand-primary text-white px-12 py-6 rounded-full font-bold text-sm uppercase tracking-widest shadow-2xl shadow-brand-primary/30 hover:scale-105 transition-transform">
            Watch on YouTube
          </button>
        </div>
      </section>

    </div>
  );
}
