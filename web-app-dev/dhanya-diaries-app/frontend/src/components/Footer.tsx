"use client";

import Link from "next/link";

export default function Footer() {
    return (
        <footer className="bg-brand-red/[0.02] pt-32 pb-20 px-6 mt-20 border-t border-brand-red/10">
            <div className="max-w-7xl mx-auto space-y-24">

                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-16">
                    {/* Brand Info */}
                    <div className="lg:col-span-2 space-y-8">
                        <Link href="/" className="flex items-center gap-4">
                            <img src="/DD-Logo.png" alt="Logo" className="w-12 h-12 grayscale opacity-40 hover:grayscale-0 transition-all cursor-pointer" />
                            <div className="h-8">
                                <img src="/DD-Title.png" alt="Dhanya Diaries" className="h-full w-auto opacity-30" />
                            </div>
                        </Link>
                        <p className="text-brand-text/50 font-medium leading-relaxed max-w-sm italic">
                            A cozy corner of the internet dedicated to home, heart, and the simple joys of lifestyle creation. Joining you in every season of life.
                        </p>
                    </div>

                    {/* Quick Links */}
                    <div className="space-y-6">
                        <h4 className="text-[11px] font-black uppercase tracking-[0.4em] text-brand-red">Chapters</h4>
                        <nav className="flex flex-col gap-4 text-sm font-medium text-brand-text/60">
                            <Link href="/recipes" className="hover:text-brand-red transition-colors">Recipes</Link>
                            <Link href="/cleaning" className="hover:text-brand-red transition-colors">Cleaning Tips</Link>
                            <Link href="/vlogs" className="hover:text-brand-red transition-colors">Lifestyle Vlogs</Link>
                            <Link href="/community" className="hover:text-brand-red transition-colors">Community</Link>
                        </nav>
                    </div>

                    {/* Social Links */}
                    <div className="space-y-6">
                        <h4 className="text-[11px] font-black uppercase tracking-[0.4em] text-brand-red">Connect</h4>
                        <nav className="flex flex-col gap-4 text-sm font-medium text-brand-text/60">
                            <a href="https://www.youtube.com/channel/UC_UoV11Yx2u66CaBsvHPJiw" target="_blank" rel="noopener noreferrer" className="hover:text-brand-red transition-colors">YouTube</a>
                            <a href="https://www.instagram.com/dhanya.diaries" target="_blank" rel="noopener noreferrer" className="hover:text-brand-red transition-colors">Instagram</a>
                            <a href="#" className="hover:text-brand-red transition-colors">Facebook</a>
                            <a href="#" className="hover:text-brand-red transition-colors">WhatsApp Community</a>
                        </nav>
                    </div>
                </div>

                {/* Bottom Bar */}
                <div className="pt-12 border-t border-brand-text/5 flex flex-col md:flex-row justify-between items-center gap-8 text-[10px] font-black uppercase tracking-[0.3em] text-brand-text/20">
                    <span>&copy; 2026 Dhanya Diaries Studio</span>
                    <div className="flex gap-12">
                        <Link href="#" className="hover:text-brand-text transition-colors">Privacy</Link>
                        <Link href="#" className="hover:text-brand-text transition-colors">Terms</Link>
                        <Link href="#" className="hover:text-brand-text transition-colors">Support</Link>
                    </div>
                    <div className="flex items-center gap-2">
                        <span>Made with</span>
                        <span className="text-brand-red">♥</span>
                        <span>for you</span>
                    </div>
                </div>

            </div>
        </footer>
    );
}
