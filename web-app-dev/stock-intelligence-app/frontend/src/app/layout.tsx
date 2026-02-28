import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Sidebar from "./components/Sidebar";
import { SymbolProvider } from "./context/SymbolContext";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
    title: "Trade-Craft",
    description: "Nifty 50 Intraday Intelligence Dashboard — real-time market signals, 7-checkpoint timeline & 10–20 min forecasts.",
    manifest: "/manifest.json",
    appleWebApp: {
        capable: true,
        statusBarStyle: "black-translucent",
        title: "Trade-Craft",
    },
    other: {
        "mobile-web-app-capable": "yes",
        "apple-mobile-web-app-capable": "yes",
        "apple-mobile-web-app-status-bar-style": "black-translucent",
        "theme-color": "#d4af37",
        "msapplication-TileColor": "#0f172a",
    },
    icons: {
        icon: "/icons/icon-192.png",
        apple: "/icons/icon-192.png",
        shortcut: "/icons/icon-192.png",
    },
    viewport: {
        width: "device-width",
        initialScale: 1,
        minimumScale: 1,
    },
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en" className="dark">
            <body className={`${inter.variable} font-sans relative`}>
                <SymbolProvider>
                    {/* -- Global Sidebar -- */}
                    <Sidebar />

                    {/* -- Background Watermark (Global) -- */}
                    <div className="fixed inset-0 md:ml-64 pointer-events-none flex items-center justify-center -z-10 overflow-hidden">
                        <img
                            src="/assets/trade-craft-logo.png"
                            alt="Watermark"
                            className="w-[400px] h-[400px] md:w-[700px] md:h-[700px] object-contain opacity-[0.04] grayscale brightness-200"
                        />
                    </div>

                    <main className="md:ml-64 min-h-screen">
                        {children}
                    </main>
                </SymbolProvider>
            </body>
        </html>
    );
}
