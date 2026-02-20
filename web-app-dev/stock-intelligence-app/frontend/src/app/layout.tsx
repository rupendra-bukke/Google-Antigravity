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
            <body className={`${inter.variable} font-sans`}>
                <SymbolProvider>
                    <Sidebar />
                    <main className="md:ml-64 min-h-screen p-4 md:p-8">{children}</main>
                </SymbolProvider>
            </body>
        </html>
    );
}
