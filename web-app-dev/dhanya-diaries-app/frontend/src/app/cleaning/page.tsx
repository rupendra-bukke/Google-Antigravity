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
                        <div className="space-y-6">
                            <div className="aspect-video rounded-[3rem] overflow-hidden bg-gray-100 relative group">
                                <img src="https://images.unsplash.com/photo-1581578731548-c64695cc6954?auto=format&fit=crop&w=800&q=80" className="w-full h-full object-cover" alt="Before" />
                                <div className="absolute top-6 left-6 bg-brand-text text-white px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest">Before</div>
                            </div>
                            <p className="text-center text-[10px] font-black uppercase tracking-[0.3em] text-brand-text/30">Pantry Overload</p>
                        </div>
                        <div className="space-y-6">
                            <div className="aspect-video rounded-[3rem] overflow-hidden bg-gray-100 relative group">
                                <img src="https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=800&q=80" className="w-full h-full object-cover" alt="After" />
                                <div className="absolute top-6 left-6 bg-green-500 text-white px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest">After ✨</div>
                            </div>
                            <p className="text-center text-[10px] font-black uppercase tracking-[0.3em] text-brand-text/30">Minimalist Organization</p>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}
