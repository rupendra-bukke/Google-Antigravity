import type { Metadata } from "next";
import { Playfair_Display, Outfit, Fredoka } from "next/font/google";
import "./globals.css";

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair"
});

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit"
});

const fredoka = Fredoka({
  subsets: ["latin"],
  variable: "--font-fredoka",
  weight: ["700"]
});

export const metadata: Metadata = {
  title: "Dhanya Diaries | Lifestyle, Cooking & Home Tips",
  description: "Join Dhanya on her journey through lifestyle, cooking hacks, and home organization tips.",
};

import Header from "@/components/Header";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${playfair.variable} ${outfit.variable} ${fredoka.variable} font-sans antialiased overflow-x-hidden`}>
        <Header />
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
