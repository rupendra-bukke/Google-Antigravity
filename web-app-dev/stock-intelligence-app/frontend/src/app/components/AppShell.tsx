"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Sidebar from "./Sidebar";
import { useAuth } from "../context/AuthContext";

function FullScreenState({ message }: { message: string }) {
    return (
        <main className="min-h-screen flex items-center justify-center px-6">
            <div className="glass-card border border-white/10 rounded-2xl px-6 py-5 text-center max-w-md">
                <p className="text-sm font-semibold text-brand-300 uppercase tracking-[0.16em]">Trade-Craft</p>
                <p className="text-sm text-gray-300 mt-3">{message}</p>
            </div>
        </main>
    );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();
    const { session, loading, configError } = useAuth();

    const isLoginPage = pathname === "/login";
    const needsLogin = !loading && !session && !isLoginPage;
    const shouldGoHome = !loading && !!session && isLoginPage;

    useEffect(() => {
        if (needsLogin) {
            router.replace("/login");
            return;
        }
        if (shouldGoHome) {
            router.replace("/");
        }
    }, [needsLogin, shouldGoHome, router]);

    if (loading) {
        return <FullScreenState message="Checking your login session..." />;
    }

    if (configError) {
        return <FullScreenState message={configError} />;
    }

    if (needsLogin || shouldGoHome) {
        return <FullScreenState message="Redirecting..." />;
    }

    if (isLoginPage) {
        return <main className="min-h-screen">{children}</main>;
    }

    return (
        <>
            <Sidebar />

            <div className="fixed inset-0 md:ml-64 pointer-events-none flex items-center justify-center -z-10 overflow-hidden">
                <img
                    src="/assets/trade-craft-logo.png"
                    alt="Watermark"
                    className="w-[400px] h-[400px] md:w-[700px] md:h-[700px] object-contain opacity-[0.04] grayscale brightness-200"
                />
            </div>

            <main className="md:ml-64 min-h-screen">{children}</main>
        </>
    );
}
