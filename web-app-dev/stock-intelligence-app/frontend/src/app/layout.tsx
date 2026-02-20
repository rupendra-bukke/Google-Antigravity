import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Sidebar from "./components/Sidebar";
import { SymbolProvider } from "./context/SymbolContext";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
    title: "Stock Intelligence Dashboard",
    description: "Real-time intraday analysis for NIFTY 50, Bank NIFTY, SENSEX",
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
                            src="/rb-logo.png"
                            alt="Watermark"
                            className="w-[400px] h-[400px] md:w-[700px] md:h-[700px] object-contain opacity-[0.06] grayscale brightness-200"
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
