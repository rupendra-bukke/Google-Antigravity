"use client";

import { useEffect, useState } from "react";

const TIPS = [
    { title: "The 15-Minute Daily Reset", desc: "A simple routine to keep your main living spaces tidy every single day.", icon: "🕒" },
    { title: "Deep Clean: Kitchen Edition", desc: "My step-by-step guide to a sparkling, hygienic kitchen.", icon: "✨" },
    { title: "Natural Cleaning hacks", desc: "Using lemon, vinegar, and baking powder for a chem-free home.", icon: "🍋" },
];

export default function Cleaning() {
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        setIsLoaded(true);
    }, []);

    return (
        <div className={`pt-40 pb-32 transition-opacity duration-1000 ${isLoaded ? "opacity-100" : "opacity-0"}`}>
            <section className="max-w-7xl mx-auto px-6">
                <div className="space-y-6 mb-24 max-w-3xl">
                    <span className="text-label text-blue-400">Home Care</span>
                    <h1 className="text-6xl md:text-8xl font-serif">A Clear Space, <br /> a Clear Mind.</h1>
                    <p className="text-xl text-brand-text/60 leading-relaxed">
                        Efficient cleaning shouldn't feel like a chore. Find my curated routines and natural hacks to keep your home glowing.
                    </p>
                </div>

                {/* GUIDES GRID */}
                <div className="grid md:grid-cols-3 gap-12 mb-32">
                    {TIPS.map((tip) => (
                        <div key={tip.title} className="soft-card soft-card-hover space-y-8 border-none bg-blue-50/50">
                            <div className="w-20 h-20 bg-white rounded-[2rem] flex items-center justify-center text-4xl shadow-sm">
                                {tip.icon}
                            </div>
                            <div className="space-y-4">
                                <h3 className="text-3xl font-serif">{tip.title}</h3>
                                <p className="text-sm text-brand-text/60 leading-relaxed">{tip.desc}</p>
                            </div>
                            <button
                                onClick={() => alert("Your companion checklist is preparing for download! Check your downloads folder in a moment.")}
                                className="bg-brand-text text-white w-full py-5 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-brand-red transition-all"
                            >
                                Download Checklist
                            </button>
                        </div>
                    ))}
                </div>

                {/* BEFORE/AFTER SECTION */}
                <div className="space-y-16">
                    <h3 className="text-4xl font-serif text-center">Transformations</h3>
                    <div className="grid md:grid-cols-2 gap-12">
                        {/* BEFORE CARD */}
                        <div className="space-y-6">
                            <div className="aspect-video rounded-[3.5rem] overflow-hidden bg-gray-100 relative group shadow-sm">
                                <img
                                    src="https://images.unsplash.com/photo-1595111000631-f52554e2f9f1?q=80&w=1200&auto=format&fit=crop"
                                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000"
                                    alt="Cluttered Pantry - Before"
                                />
                                <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                                <div className="absolute top-8 left-8 bg-brand-text text-white px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] shadow-lg">Before</div>
                            </div>
                            <div className="space-y-2 text-center">
                                <p className="text-[10px] font-black uppercase tracking-[0.4em] text-brand-red/60">Stage One</p>
                                <p className="text-lg font-serif text-brand-text/40">Pantry Overload</p>
                            </div>
                        </div>

                        {/* AFTER CARD */}
                        <div className="space-y-6">
                            <div className="aspect-video rounded-[3.5rem] overflow-hidden bg-gray-100 relative group shadow-sm">
                                <img
                                    src="https://images.unsplash.com/photo-1584622781564-1d9876a13d00?q=80&w=1200&auto=format&fit=crop"
                                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000"
                                    alt="Organized Pantry - After"
                                />
                                <div className="absolute inset-0 bg-brand-red/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                                <div className="absolute top-8 left-8 bg-green-500 text-white px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] shadow-lg flex items-center gap-2">
                                    After <span className="animate-pulse">✨</span>
                                </div>
                            </div>
                            <div className="space-y-2 text-center">
                                <p className="text-[10px] font-black uppercase tracking-[0.4em] text-green-600/60">Final Result</p>
                                <p className="text-lg font-serif text-brand-text/80">Minimalist Organization</p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}
