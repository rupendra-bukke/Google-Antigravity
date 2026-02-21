"use client";

import { useEffect, useState } from "react";
import { getLatestVideos, YouTubeVideo } from "@/lib/youtube";

export default function Vlogs() {
    const [isLoaded, setIsLoaded] = useState(false);
    const [videos, setVideos] = useState<YouTubeVideo[]>([]);

    useEffect(() => {
        setIsLoaded(true);
        async function loadData() {
            const vids = await getLatestVideos(10);
            setVideos(vids);
        }
        loadData();
    }, []);

    return (
        <div className={`pt-40 pb-32 transition-opacity duration-1000 ${isLoaded ? "opacity-100" : "opacity-0"}`}>
            <section className="max-w-7xl mx-auto px-6">
                <div className="space-y-6 mb-24 text-center max-w-2xl mx-auto">
                    <span className="text-label text-green-500">Life Stories</span>
                    <h1 className="text-6xl md:text-8xl font-serif">A Peek into <br /> My World.</h1>
                    <p className="text-xl text-brand-text/60 leading-relaxed italic">
                        Vlogs, travel stories, and quiet moments that don't fit into a recipe or a guide.
                    </p>
                </div>

                {/* FEED LAYOUT */}
                <div className="grid gap-24">
                    {videos.map((v, i) => (
                        <div key={v.id} className={`grid lg:grid-cols-12 gap-12 items-center ${i % 2 !== 0 ? 'lg:direction-rtl' : ''}`}>
                            <div className={`lg:col-span-8 ${i % 2 !== 0 ? 'lg:order-2' : ''}`}>
                                <div className="soft-card p-4 h-full">
                                    <div className="aspect-video rounded-[2.5rem] overflow-hidden">
                                        <iframe
                                            src={`https://www.youtube.com/embed/${v.id}`}
                                            className="w-full h-full border-none"
                                            title={v.title}
                                            allowFullScreen
                                        ></iframe>
                                    </div>
                                </div>
                            </div>
                            <div className={`lg:col-span-4 space-y-6 text-center lg:text-left ${i % 2 !== 0 ? 'lg:order-1' : ''}`}>
                                <span className="text-[10px] font-bold text-brand-red opacity-40 uppercase tracking-[0.5em]">Episode #{videos.length - i}</span>
                                <h2 className="text-4xl font-serif leading-tight">{v.title}</h2>
                                <p className="text-brand-text/50 font-medium">Published on {v.publishedAt}</p>
                                <div className="pt-4">
                                    <button className="text-[10px] font-black uppercase tracking-widest text-brand-text/40 hover:text-brand-red flex items-center gap-2 mx-auto lg:mx-0">
                                        Share this Story <span>⟡</span>
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
