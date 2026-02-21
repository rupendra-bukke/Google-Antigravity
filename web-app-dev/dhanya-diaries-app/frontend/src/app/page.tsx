"use client";

import { useEffect, useState } from "react";

export default function Home() {
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setIsLoaded(true);
  }, []);

  return (
    <div className={`space-y-24 pb-24 transition-opacity duration-1000 ${isLoaded ? "opacity-100" : "opacity-0"}`}>

      {/* ── HERO SECTION ── */}
      <section className="relative px-6 md:px-12 overflow-hidden">
        <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-12 items-center">
          <div className="space-y-8 animate-fade-up">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-primary/10 border border-brand-primary/20 text-[10px] font-black text-brand-primary uppercase tracking-[0.2em]">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-primary"></span>
              </span>
              New Vlog Out Now
            </div>

            <h1 className="text-5xl md:text-7xl font-serif text-[#2d2d2d] leading-[1.1]">
              Sharing the <span className="text-brand-primary italic">Art of Living</span> & Cooking.
            </h1>

            <p className="text-lg text-gray-600 max-w-lg leading-relaxed font-medium">
              Join me as I explore simple lifestyle hacks, delicious kitchen experiments, and the beauty of an organized home.
            </p>

            <div className="flex flex-wrap gap-4 pt-4">
              <button className="bg-brand-primary text-white font-bold px-8 py-4 rounded-2xl hover:shadow-2xl hover:shadow-brand-primary/40 transition-all active:scale-95 text-sm uppercase tracking-widest">
                Explore Recipes
              </button>
              <button className="bg-white text-brand-primary border-2 border-brand-primary/10 font-bold px-8 py-4 rounded-2xl hover:bg-brand-primary/5 transition-all text-sm uppercase tracking-widest">
                Latest Vlogs
              </button>
            </div>
          </div>

          <div className="relative animate-fade-up" style={{ animationDelay: "0.2s" }}>
            <div className="aspect-[4/5] rounded-[3rem] overflow-hidden shadow-2xl relative z-10">
              <div className="absolute inset-0 bg-gradient-to-tr from-brand-secondary/20 to-transparent pointer-events-none" />
              {/* Replace with actual image later */}
              <div className="w-full h-full bg-[#eee] flex items-center justify-center">
                <img
                  src="/DD-Logo.png"
                  alt="Feature"
                  className="w-48 h-48 object-contain opacity-20 grayscale"
                />
              </div>
            </div>
            {/* Decorative Elements */}
            <div className="absolute -top-6 -right-6 w-32 h-32 bg-brand-secondary/20 rounded-full blur-3xl -z-10" />
            <div className="absolute -bottom-10 -left-10 w-48 h-48 bg-brand-accent/20 rounded-full blur-3xl -z-10" />
          </div>
        </div>
      </section>

      {/* ── CATEGORY GRID ── */}
      <section className="px-6 md:px-12">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
            <div className="space-y-3">
              <p className="text-brand-primary font-bold uppercase tracking-[0.3em] text-[10px]">What I Share</p>
              <h2 className="text-4xl font-serif text-[#2d2d2d]">Browse Categories</h2>
            </div>
            <p className="text-gray-500 max-w-xs text-sm font-medium leading-relaxed">
              Find everything from quick 5-minute snacks to deep-cleaning home organization tips.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { title: "Gourmet Cooking", icon: "🍳", color: "bg-emerald-50", text: "Healthy & Tasty" },
              { title: "Home Styling", icon: "🏠", color: "bg-orange-50", text: "Cozy & Clean" },
              { title: "Vlogs & Life", icon: "🎥", color: "bg-indigo-50", text: "Daily Stories" },
            ].map((cat, i) => (
              <div key={i} className={`group p-8 rounded-[2.5rem] ${cat.color} hover:shadow-2xl hover:shadow-gray-200 transition-all cursor-pointer border border-transparent hover:border-white`}>
                <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-3xl shadow-sm group-hover:scale-110 transition-transform mb-6">
                  {cat.icon}
                </div>
                <h3 className="text-2xl font-serif mb-2">{cat.title}</h3>
                <p className="text-sm text-gray-500 font-semibold uppercase tracking-widest">{cat.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── LATEST VLOGS (YOUTUBE FEEL) ── */}
      <section className="px-6 md:px-12 bg-white py-24">
        <div className="max-w-7xl mx-auto">
          <div className="text-center space-y-4 mb-20">
            <h2 className="text-5xl font-serif text-[#2d2d2d]">From the Channel</h2>
            <div className="flex items-center justify-center gap-2 text-brand-primary font-bold tracking-widest text-xs uppercase">
              <img src="/DD-Logo.png" className="w-6 h-6 object-contain" />
              Dhanya.diaries
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
            {[1, 2, 3].map((v) => (
              <div key={v} className="space-y-4 group cursor-pointer">
                <div className="aspect-video bg-gray-100 rounded-[2rem] overflow-hidden relative shadow-lg">
                  <div className="absolute inset-0 bg-black/20 group-hover:bg-black/0 transition-colors flex items-center justify-center">
                    <div className="w-12 h-12 bg-white/90 rounded-full flex items-center justify-center shadow-md scale-0 group-hover:scale-100 transition-transform duration-300">
                      <div className="w-0 h-0 border-t-[6px] border-t-transparent border-l-[10px] border-l-brand-primary border-b-[6px] border-b-transparent ml-1" />
                    </div>
                  </div>
                </div>
                <div className="px-2 space-y-2">
                  <h4 className="text-xl font-serif leading-tight group-hover:text-brand-primary transition-colors">
                    How to organize your small kitchen for maximum space.
                  </h4>
                  <p className="text-[11px] text-gray-400 font-bold uppercase tracking-widest flex items-center gap-2">
                    <span>Vlog #42</span>
                    <span className="w-1 h-1 rounded-full bg-gray-300" />
                    <span>8 Min Watch</span>
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-16 text-center">
            <button className="inline-flex items-center gap-3 font-bold text-gray-400 hover:text-brand-primary transition-colors tracking-widest uppercase text-xs">
              View All Videos
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </button>
          </div>
        </div>
      </section>

      {/* ── NEWSLETTER / DIARY SIGNUP ── */}
      <section className="px-6 md:px-12">
        <div className="max-w-7xl mx-auto">
          <div className="bg-brand-secondary/30 rounded-[3.5rem] p-12 md:p-24 relative overflow-hidden flex flex-col items-center text-center">
            <img
              src="/DD-Logo.png"
              className="absolute -top-20 -right-20 w-80 h-80 object-contain opacity-5 grayscale pointer-events-none"
            />

            <h2 className="text-4xl md:text-6xl font-serif text-[#2d2d2d] mb-6 z-10">
              Get the <span className="italic">Secret Tips</span> First.
            </h2>
            <p className="text-gray-600 max-w-md mb-10 font-medium z-10 leading-relaxed">
              I share weekly kitchen hacks and home styling ideas that I don't always post on YouTube. Subscribe to my digital diary!
            </p>

            <div className="w-full max-w-md flex flex-col md:flex-row gap-3 z-10">
              <input
                type="email"
                placeholder="Your email address"
                className="flex-1 px-6 py-4 rounded-2xl bg-white border border-transparent focus:border-brand-primary outline-none text-sm transition-all"
              />
              <button className="bg-brand-primary text-white font-bold px-8 py-4 rounded-2xl shadow-lg shadow-brand-primary/20 hover:shadow-xl transition-all active:scale-95 text-xs uppercase tracking-widest">
                Join Now
              </button>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}
