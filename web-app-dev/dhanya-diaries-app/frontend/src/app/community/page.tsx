"use client";

import { useEffect, useState } from "react";

export default function Community() {
    const [isLoaded, setIsLoaded] = useState(false);
    const [pollVote, setPollVote] = useState<number | null>(null);

    useEffect(() => {
        setIsLoaded(true);
    }, []);

    const pollOptions = [
        { id: 1, label: "More Cooking Hacks!", percentage: 45 },
        { id: 2, label: "Cleaning Routines", percentage: 30 },
        { id: 3, label: "Weekly Life Vlogs", percentage: 25 },
    ];

    return (
        <div className={`pt-40 pb-32 transition-opacity duration-1000 ${isLoaded ? "opacity-100" : "opacity-0"}`}>
            <section className="max-w-7xl mx-auto px-6">
                <div className="grid lg:grid-cols-2 gap-24 items-start">

                    {/* LEFT: INTERACTION */}
                    <div className="space-y-16">
                        <div className="space-y-6 text-center lg:text-left">
                            <span className="text-label text-brand-red">Our Circle</span>
                            <h1 className="text-6xl md:text-8xl font-serif">You and Me.</h1>
                            <p className="text-xl text-brand-text/60 leading-relaxed">
                                Join our cozy space where we talk about home, life, and everything in between. Your voice matters here.
                            </p>
                        </div>

                        {/* LIVE POLL */}
                        <div className="soft-card space-y-10 border-none bg-brand-peach/20">
                            <div className="space-y-2">
                                <span className="text-[10px] font-black uppercase tracking-widest text-brand-red">Weekly Poll</span>
                                <h3 className="text-3xl font-serif">What should I film next?</h3>
                            </div>

                            <div className="space-y-4">
                                {pollOptions.map((opt) => (
                                    <button
                                        key={opt.id}
                                        onClick={() => setPollVote(opt.id)}
                                        className={`w-full text-left p-6 rounded-2xl transition-all relative overflow-hidden group border ${pollVote === opt.id ? 'border-brand-red bg-white' : 'border-transparent bg-white/50 hover:bg-white'}`}
                                    >
                                        <div className="relative z-10 flex justify-between items-center">
                                            <span className="font-bold text-sm">{opt.label}</span>
                                            {pollVote && <span className="text-brand-red font-black text-xs">{opt.percentage}%</span>}
                                        </div>
                                        {pollVote && (
                                            <div
                                                className="absolute inset-y-0 left-0 bg-brand-red/5 transition-all duration-1000"
                                                style={{ width: `${opt.percentage}%` }}
                                            />
                                        )}
                                    </button>
                                ))}
                            </div>
                            <p className="text-[10px] font-bold text-center text-brand-text/30 uppercase tracking-widest">
                                {pollVote ? "Thanks for voting!" : "Select an option to see results"}
                            </p>
                        </div>
                    </div>

                    {/* RIGHT: CONNECT */}
                    <div className="space-y-12">
                        <div className="soft-card space-y-8 bg-green-50/30">
                            <h3 className="text-3xl font-serif">Send a Note</h3>
                            <p className="text-sm text-brand-text/60 italic leading-relaxed">
                                "I read every single message. Whether it's a recipe suggestion or just a hello, I'd love to hear from you."
                            </p>
                            <div className="space-y-4">
                                <input type="text" placeholder="Your Name" className="w-full bg-white/80 p-5 rounded-2xl text-sm outline-none" />
                                <textarea placeholder="Message Dhanya..." rows={4} className="w-full bg-white/80 p-5 rounded-2xl text-sm outline-none" />
                                <button className="bg-brand-text text-white w-full py-5 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-brand-red transition-all">
                                    Send Message
                                </button>
                            </div>
                        </div>

                        <div className="grid md:grid-cols-2 gap-8">
                            {['YouTube', 'Instagram'].map(social => (
                                <div key={social} className="soft-card text-center p-10 space-y-4 hover:bg-brand-peach/10 cursor-pointer">
                                    <span className="text-2xl">{social === 'YouTube' ? '📹' : '📸'}</span>
                                    <h4 className="text-xl font-bold">{social}</h4>
                                    <span className="text-[9px] font-black uppercase tracking-widest text-brand-red">Follow Now</span>
                                </div>
                            ))}
                        </div>
                    </div>

                </div>
            </section>
        </div>
    );
}
