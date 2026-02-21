"use client";

import { useEffect, useState } from "react";
import { getLatestVideos, getChannelStats, YouTubeVideo, ChannelStats } from "@/lib/youtube";

const CATEGORIES = [
  { name: "Cooking", icon: "🍳", color: "bg-orange-50", text: "Traditional & Modern Recipes" },
  { name: "Cleaning", icon: "🧼", color: "bg-blue-50", text: "Home Organization & Routines" },
  { name: "Vlogs", icon: "🍵", color: "bg-green-50", text: "Daily Life & Travel Stories" },
];

const QUOTES = [
  "A clean home is a happy home.",
  "Cook with love, and the food will taste better.",
  "Beauty lies in the simplest of rituals.",
  "Your home is a reflection of your soul.",
  "Small steps every day lead to big changes."
];

export default function Home() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [videos, setVideos] = useState<YouTubeVideo[]>([]);
  const [stats, setStats] = useState<ChannelStats | null>(null);
  const [currentQuote, setCurrentQuote] = useState(0);
  const [status, setStatus] = useState<'idle' | 'signed-up'>('idle');

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

    const quoteInterval = setInterval(() => {
      setCurrentQuote((prev) => (prev + 1) % QUOTES.length);
    }, 5000);
    return () => clearInterval(quoteInterval);
  }, []);

  return (
    <div className={`transition-opacity duration-1000 ${isLoaded ? "opacity-100" : "opacity-0"}`}>

      {/* ── HERO SECTION: WARM GREETING ── */}
      <section className="relative min-h-screen flex items-center pt-32 pb-20 px-6 md:px-12 bg-brand-red/[0.03]">
        <div className="max-w-7xl mx-auto w-full grid lg:grid-cols-2 gap-12 items-center">

          <div className="space-y-10 order-2 lg:order-1 text-center lg:text-left">
            <div className="space-y-4">
              <span className="text-[11px] font-black uppercase tracking-[0.5em] text-brand-red inline-block">Welcome to my world</span>
              <img
                src="/DD-Title.png"
                alt="Dhanya Diaries"
                className="w-[85%] max-w-[300px] md:max-w-md mx-auto lg:mx-0 h-auto"
              />
              <p className="text-xl md:text-2xl text-brand-text/60 font-serif italic leading-relaxed">
                Celebrating the quiet beauty of everyday living, <br className="hidden md:block" /> one diary entry at a time.
              </p>
            </div>

            {/* LIVE STATS: ANINMATED */}
            <div className="flex flex-col sm:flex-row items-center gap-8 justify-center lg:justify-start">
              <div className="bg-white px-10 py-6 rounded-[2rem] shadow-sm border border-brand-peach relative group overflow-hidden">
                <div className="absolute top-0 right-0 w-2 h-2 bg-green-500 rounded-full m-4 animate-pulse" />
                <span className="text-[9px] font-black uppercase tracking-[0.3em] text-brand-text/40 block mb-1">Fan Family</span>
                <span className="text-4xl font-serif text-brand-text font-black animate-count">
                  {stats?.subscriberCount || "25,400"}+
                </span>
                <p className="text-[10px] font-bold text-brand-red mt-1 uppercase tracking-widest">Lives Touched</p>
              </div>

              <LinkButton href="/community" text="Join Community" />
            </div>

            <p className="telugu-text text-3xl md:text-5xl lg:text-3xl xl:text-5xl text-brand-text/20 leading-none">
              ఇంటి ఆత్మీయత...
            </p>
          </div>

          <div className="relative order-1 lg:order-2">
            <div className="aspect-square md:aspect-[4/5] rounded-[4rem] overflow-hidden shadow-2xl animate-float">
              <img
                src={videos[0]?.thumbnail || "https://images.unsplash.com/photo-1516062423079-7ca13cdc7f5a?auto=format&fit=crop&w=1200&q=80"}
                className="w-full h-full object-cover"
                alt="Creator"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-brand-peach/40 to-transparent" />
            </div>
            {/* Decal */}
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-white rounded-full flex items-center justify-center p-8 shadow-xl hidden md:flex border-8 border-brand-peach">
              <img src="/DD-Logo.png" className="w-full h-full object-contain" />
            </div>
          </div>

        </div>
      </section>

      {/* ── LATEST VIDEOS: AUTO-FETCHED ── */}
      <section className="section-spacing bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-end gap-8 mb-16 px-4">
            <div className="space-y-4">
              <span className="text-label text-brand-red">The Journal</span>
              <h2 className="text-5xl md:text-7xl font-serif">Recent Entries.</h2>
            </div>
            <a href="/vlogs" className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-text/40 hover:text-brand-red transition-colors flex items-center gap-2">
              View all Stories <span>→</span>
            </a>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-10">
            {videos.slice(0, 6).map((v) => (
              <a key={v.id} href={`https://youtube.com/watch?v=${v.id}`} className="soft-card soft-card-hover group block space-y-6">
                <div className="aspect-video rounded-[1.5rem] overflow-hidden relative">
                  <img src={v.thumbnail} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000" />
                  <div className="absolute inset-0 bg-brand-red/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                    <span className="bg-white/90 p-4 rounded-full text-brand-red shadow-xl">▶</span>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-[1px] bg-brand-red/30" />
                    <span className="text-[9px] font-black tracking-widest text-brand-red uppercase">YouTube Video</span>
                  </div>
                  <h4 className="text-xl md:text-2xl font-serif leading-tight text-brand-text">{v.title}</h4>
                </div>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* ── CATEGORIES: SOFT CARDS ── */}
      <section className="section-spacing bg-brand-peach/20">
        <div className="max-w-7xl mx-auto px-6">
          <h3 className="text-center text-label !text-brand-text/30 mb-16">Pick Your Journey</h3>
          <div className="grid md:grid-cols-3 gap-12">
            {CATEGORIES.map((cat) => (
              <a key={cat.name} href={cat.name === "Cooking" ? "/recipes" : `/${cat.name.toLowerCase()}`} className="soft-card soft-card-hover group text-center space-y-8 flex flex-col items-center">
                <div className={`w-24 h-24 ${cat.color} rounded-full flex items-center justify-center text-4xl group-hover:scale-110 transition-transform`}>
                  {cat.icon}
                </div>
                <div className="space-y-2">
                  <h4 className="text-3xl font-serif">{cat.name}</h4>
                  <p className="text-sm text-brand-text/60 px-4 leading-relaxed">{cat.text}</p>
                </div>
                <span className="text-[9px] font-black uppercase tracking-widest text-brand-red opacity-0 group-hover:opacity-100 transition-opacity">Explore ⟡</span>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* ── DYNAMIC QUOTE ── */}
      <section className="py-40 bg-white relative overflow-hidden text-center">
        <div className="section-container relative z-10">
          <div className="text-6xl text-brand-peach mb-8 opacity-40">“</div>
          <p className="text-4xl md:text-6xl font-serif italic text-brand-text/80 leading-snug animate-reveal transition-all duration-1000">
            {QUOTES[currentQuote]}
          </p>
          <div className="text-6xl text-brand-peach mt-8 opacity-40 rotate-180">“</div>
        </div>
        {/* Decorative Leaves */}
        <div className="absolute top-20 left-10 text-6xl opacity-10 rotate-12">🌿</div>
        <div className="absolute bottom-20 right-10 text-6xl opacity-10 -rotate-12">🍂</div>
      </section>

      {/* ── EMAIL CTA: INTERACTIVE ── */}
      <section className="section-spacing bg-brand-red/[0.02]">
        <div className="max-w-3xl mx-auto px-6 text-center soft-card !bg-white border-none space-y-10 group relative overflow-hidden shadow-2xl">
          {/* Background Decoration */}
          <div className="absolute -top-10 -left-10 w-40 h-40 bg-brand-red/5 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-1000" />

          {status !== 'signed-up' ? (
            <>
              <div className="space-y-4 relative z-10">
                <h3 className="text-4xl md:text-5xl font-serif">A little love in your inbox.</h3>
                <p className="text-brand-text/60 max-w-md mx-auto">Join my email list for exclusive recipes, checklists, and a little bit of daily warmth.</p>
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setStatus('signed-up');
                }}
                className="flex flex-col sm:flex-row gap-4 max-w-md mx-auto relative z-10"
              >
                <input
                  type="email"
                  required
                  placeholder="Your email address"
                  className="flex-1 bg-brand-red/[0.03] px-8 py-5 rounded-2xl outline-none focus:ring-2 ring-brand-red/20 text-sm font-medium"
                />
                <button
                  type="submit"
                  className="bg-brand-text text-white px-10 py-5 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-brand-red transition-all shadow-xl active:scale-95"
                >
                  Sign Up
                </button>
              </form>
            </>
          ) : (
            <div className="py-10 space-y-6 animate-reveal relative z-10">
              <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-3xl mx-auto mb-4 scale-110">✓</div>
              <h3 className="text-4xl font-serif">You're in the family!</h3>
              <p className="text-brand-text/60 italic">Check your inbox soon for some warm surprises. 🌸</p>
              <button onClick={() => setStatus('idle')} className="text-[10px] font-black uppercase tracking-widest text-brand-red/40 hover:text-brand-red">Not you? Reset</button>
            </div>
          )}
          <p className="text-[9px] font-bold text-brand-text/20 uppercase tracking-[0.4em] relative z-10">Safe and warm • Verified by Dhanya</p>
        </div>
      </section>

    </div>
  );
}

function LinkButton({ href, text }: { href: string; text: string }) {
  return (
    <a href={href} className="bg-brand-red text-white px-12 py-6 rounded-[2rem] font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-brand-red/20 hover:scale-105 transition-all active:scale-95">
      {text}
    </a>
  );
}
