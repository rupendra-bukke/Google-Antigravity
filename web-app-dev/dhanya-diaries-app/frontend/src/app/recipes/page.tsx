"use client";

import { useEffect, useState } from "react";
import { getLatestVideos, YouTubeVideo } from "@/lib/youtube";

export default function Recipes() {
    const [isLoaded, setIsLoaded] = useState(false);
    const [videos, setVideos] = useState<YouTubeVideo[]>([]);

    useEffect(() => {
        setIsLoaded(true);
        async function loadData() {
            const vids = await getLatestVideos(6);
            setVideos(vids);
        }
        loadData();
    }, []);

    return (
        <div className={`pt-40 pb-32 transition-opacity duration-1000 ${isLoaded ? "opacity-100" : "opacity-0"}`}>
            <section className="max-w-7xl mx-auto px-6">
                <div className="space-y-6 mb-20">
                    <span className="text-label text-brand-red">Kitchen Wisdom</span>
                    <h1 className="text-6xl md:text-8xl font-serif">Recipes from <br /> my Heart.</h1>
                    <p className="text-xl text-brand-text/60 max-w-2xl leading-relaxed">
                        Simple, soul-touching recipes passed down through generations, optimized for the modern kitchen.
                    </p>
                </div>

                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-12">
                    {videos.slice(0, 6).map((v) => (
                        <div key={v.id} className="soft-card soft-card-hover group h-full flex flex-col">
                            <div className="aspect-video rounded-[2rem] overflow-hidden mb-8 relative">
                                <iframe
                                    src={`https://www.youtube.com/embed/${v.id}`}
                                    className="w-full h-full border-none"
                                    title={v.title}
                                    allowFullScreen
                                ></iframe>
                            </div>
                            <div className="space-y-4 flex-1">
                                <div className="flex items-center gap-4 text-[9px] font-black uppercase text-brand-text/40 tracking-widest">
                                    <span>⏱ {Math.floor(Math.random() * 30 + 15)} mins</span>
                                    <span>•</span>
                                    <span className="text-brand-red">Level: Easy</span>
                                </div>
                                <h3 className="text-3xl font-serif leading-tight">{v.title}</h3>
                                <p className="text-sm text-brand-text/60 line-clamp-2">
                                    This recipe focuses on the balance of spices and the warmth of slow-cooked ingredients.
                                </p>
                                <div className="pt-6 border-t border-brand-peach/50 flex justify-between items-center">
                                    <button
                                        onClick={() => alert("The full step-by-step guide is loading! Get your apron ready.")}
                                        className="text-[10px] font-black uppercase tracking-widest text-brand-red hover:underline"
                                    >
                                        Full Details
                                    </button>
                                    <button
                                        className="text-xl opacity-20 hover:opacity-100 focus:opacity-100 transition-opacity active:scale-125"
                                        onClick={(e) => {
                                            const target = e.currentTarget;
                                            target.classList.toggle('opacity-100');
                                            target.classList.toggle('text-brand-red');
                                            target.classList.toggle('opacity-20');
                                        }}
                                    >
                                        ❤
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
}
