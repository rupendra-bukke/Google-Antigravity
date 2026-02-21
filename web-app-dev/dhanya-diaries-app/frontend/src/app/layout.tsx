import type { Metadata } from "next";
import { Playfair_Display, Outfit } from "next/font/google";
import "./globals.css";

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair"
});

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit"
});

export const metadata: Metadata = {
  title: "Dhanya Diaries | Lifestyle, Cooking & Home Tips",
  description: "Join Dhanya on her journey through lifestyle, cooking hacks, and home organization tips.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${playfair.variable} ${outfit.variable} font-sans antialiased overflow-x-hidden`}>
        {/* -- Minimalist Editorial Header -- */}
        <header className="fixed top-0 inset-x-0 z-50 pt-8 px-6 md:px-12 pointer-events-none">
          <div className="max-w-7xl mx-auto flex items-center justify-between pointer-events-auto">

            <div className="flex items-center gap-6 group">
              <img src="/DD-Logo.png" alt="Logo" className="w-16 h-16 object-contain logo-glow transition-transform group-hover:scale-110" />
              <div className="hidden lg:block border-l border-gray-100 h-10 pl-6">
                <span className="font-serif text-2xl font-black text-[#1a1515] tracking-tighter">Dhanya.diaries</span>
              </div>
            </div>

            <nav className="hidden xl:flex items-center gap-12 bg-white/50 backdrop-blur-md px-10 py-4 rounded-full border border-gray-50 shadow-sm">
              <a href="#" className="nav-link !text-brand-red">Journal</a>
              <a href="#" className="nav-link">Kitchen</a>
              <a href="#" className="nav-link">Home Styling</a>
              <a href="#" className="nav-link">Vlogs</a>
            </nav>

            <button className="bg-[#1a1515] text-white text-[10px] font-black px-8 py-4 rounded-xl hover:bg-brand-red transition-all uppercase tracking-[0.2em] shadow-xl">
              Subscribe
            </button>
          </div>
        </header>

        <main className="min-h-screen">
          {children}
        </main>

        {/* -- Simple Footer -- */}
        <footer className="py-12 px-6 border-t border-[#eee]">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <img src="/DD-Logo.png" alt="Logo" className="w-8 h-8 opacity-50 grayscale" />
              <p className="text-xs text-gray-400 font-medium">© 2026 Dhanya.diaries. All rights reserved.</p>
            </div>
            <div className="flex gap-6 text-xs text-gray-500 font-semibold uppercase tracking-widest">
              <a href="#" className="hover:text-brand-primary transition-colors">Instagram</a>
              <a href="#" className="hover:text-brand-primary transition-colors">YouTube</a>
              <a href="#" className="hover:text-brand-primary transition-colors">Contact</a>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
