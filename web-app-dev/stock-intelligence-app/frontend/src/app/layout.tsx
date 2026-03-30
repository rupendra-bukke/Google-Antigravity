import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import AppShell from "./components/AppShell";
import { AuthProvider } from "./context/AuthContext";
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
                <AuthProvider>
                    <SymbolProvider>
                        <AppShell>{children}</AppShell>
                    </SymbolProvider>
                </AuthProvider>
            </body>
        </html>
    );
}
