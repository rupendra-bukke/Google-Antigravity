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
      <body className={`${playfair.variable} ${outfit.variable} font-sans antialiased`}>
        {/* -- Floating Header -- */}
        <header className="fixed top-0 inset-x-0 z-50 py-4 px-6 md:px-12">
          <div className="max-w-7xl mx-auto flex items-center justify-between glass-nav rounded-2xl py-3 px-6">
            <div className="flex items-center gap-3">
              <img src="/DD-Logo.png" alt="Logo" className="w-10 h-10 object-contain" />
              <span className="font-serif text-xl font-bold tracking-tight text-brand-primary">Dhanya.diaries</span>
            </div>

            <nav className="hidden md:flex items-center gap-8 text-sm font-semibold uppercase tracking-widest text-[#555]">
              <a href="#" className="nav-link">Home</a>
              <a href="#" className="nav-link">Recipes</a>
              <a href="#" className="nav-link">Home Tips</a>
              <a href="#" className="nav-link">Vlogs</a>
            </nav>

            <button className="bg-brand-primary text-white text-xs font-bold px-5 py-2.5 rounded-full hover:shadow-lg hover:shadow-brand-primary/30 transition-all active:scale-95 uppercase tracking-widest">
              Subscribe
            </button>
          </div>
        </header>

        <main className="pt-24 min-h-screen">
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
