import type { Metadata } from "next";
import { Playfair_Display, Outfit, Fredoka } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

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
        <Footer />
      </body>
    </html>
  );
}
