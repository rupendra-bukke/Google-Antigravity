"use client";

import { useEffect, useState } from "react";

export default function Community() {
    const [isLoaded, setIsLoaded] = useState(false);
    const [pollVote, setPollVote] = useState<number | null>(null);
    const [messageStatus, setMessageStatus] = useState<'idle' | 'sending' | 'sent'>('idle');

    useEffect(() => {
        setIsLoaded(true);
        // Load existing vote from local storage
        const savedVote = localStorage.getItem('dhanya-poll-vote');
        if (savedVote) setPollVote(parseInt(savedVote));
    }, []);

    const handlePollVote = (id: number) => {
        setPollVote(id);
        localStorage.setItem('dhanya-poll-vote', id.toString());
    };

    const handleSendMessage = (e: React.FormEvent) => {
        e.preventDefault();
        setMessageStatus('sending');
        // Simulate API call
        setTimeout(() => {
            setMessageStatus('sent');
        }, 1500);
    };

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
                        <div className="soft-card space-y-10 border-none bg-brand-red/[0.03]">
                            <div className="space-y-2">
                                <span className="text-[10px] font-black uppercase tracking-widest text-brand-red">Weekly Poll</span>
                                <h3 className="text-3xl font-serif">What should I film next?</h3>
                            </div>

                            <div className="space-y-4">
                                {pollOptions.map((opt) => (
                                    <button
                                        key={opt.id}
                                        onClick={() => handlePollVote(opt.id)}
                                        className={`w-full text-left p-6 rounded-2xl transition-all relative overflow-hidden group border ${pollVote === opt.id ? 'border-brand-red bg-white shadow-lg' : 'border-transparent bg-white/50 hover:bg-white'}`}
                                    >
                                        <div className="relative z-10 flex justify-between items-center">
                                            <span className={`font-bold text-sm ${pollVote === opt.id ? 'text-brand-red' : ''}`}>{opt.label}</span>
                                            {pollVote && <span className="text-brand-red font-black text-xs">{opt.id === pollVote ? opt.percentage + 1 : opt.percentage}%</span>}
                                        </div>
                                        {pollVote && (
                                            <div
                                                className="absolute inset-y-0 left-0 bg-brand-red/5 transition-all duration-1000"
                                                style={{ width: `${opt.id === pollVote ? opt.percentage + 1 : opt.percentage}%` }}
                                            />
                                        )}
                                    </button>
                                ))}
                            </div>
                            <p className="text-[10px] font-bold text-center text-brand-text/30 uppercase tracking-widest">
                                {pollVote ? "Thanks for being part of the process! ✨" : "Select an option to see results"}
                            </p>
                        </div>
                    </div>

                    {/* RIGHT: CONNECT */}
                    <div className="space-y-12">
                        <div className="soft-card space-y-8 bg-white shadow-2xl border-none">
                            <h3 className="text-3xl font-serif">Send a Note</h3>

                            {messageStatus === 'sent' ? (
                                <div className="py-12 text-center space-y-6 animate-reveal">
                                    <div className="w-16 h-16 bg-brand-red/10 text-brand-red rounded-full flex items-center justify-center text-2xl mx-auto">💌</div>
                                    <div className="space-y-2">
                                        <h4 className="text-xl font-bold">Message Delivered!</h4>
                                        <p className="text-sm text-brand-text/60 italic">"I've received your note and can't wait to read it. Thank you for reaching out!"</p>
                                    </div>
                                    <button onClick={() => setMessageStatus('idle')} className="text-[10px] font-black uppercase tracking-widest text-brand-red hover:underline">Send another note</button>
                                </div>
                            ) : (
                                <>
                                    <p className="text-sm text-brand-text/60 italic leading-relaxed">
                                        "I read every single message. Whether it's a recipe suggestion or just a hello, I'd love to hear from you."
                                    </p>
                                    <form onSubmit={handleSendMessage} className="space-y-4">
                                        <input required type="text" placeholder="Your Name" className="w-full bg-brand-red/[0.03] p-5 rounded-2xl text-sm outline-none focus:ring-2 ring-brand-red/10" />
                                        <textarea required placeholder="Message Dhanya..." rows={4} className="w-full bg-brand-red/[0.03] p-5 rounded-2xl text-sm outline-none focus:ring-2 ring-brand-red/10" />
                                        <button
                                            disabled={messageStatus === 'sending'}
                                            type="submit"
                                            className="bg-brand-text text-white w-full py-5 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-brand-red transition-all shadow-xl active:scale-95 disabled:opacity-50"
                                        >
                                            {messageStatus === 'sending' ? 'Sending...' : 'Send Message'}
                                        </button>
                                    </form>
                                </>
                            )}
                        </div>

                        <div className="grid md:grid-cols-2 gap-8">
                            <a href="https://www.youtube.com/channel/UC_UoV11Yx2u66CaBsvHPJiw" target="_blank" rel="noopener noreferrer" className="soft-card text-center p-10 space-y-4 hover:bg-brand-peach/10 cursor-pointer block">
                                <span className="text-2xl">📹</span>
                                <h4 className="text-xl font-bold">YouTube</h4>
                                <span className="text-[9px] font-black uppercase tracking-widest text-brand-red">Follow Now</span>
                            </a>
                            <a href="https://www.instagram.com/dhanya.diaries" target="_blank" rel="noopener noreferrer" className="soft-card text-center p-10 space-y-4 hover:bg-brand-peach/10 cursor-pointer block">
                                <span className="text-2xl">📸</span>
                                <h4 className="text-xl font-bold">Instagram</h4>
                                <span className="text-[9px] font-black uppercase tracking-widest text-brand-red">Follow Now</span>
                            </a>
                        </div>
                    </div>

                </div>
            </section>
        </div>
    );
}
