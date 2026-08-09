"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Sidebar from "./Sidebar";
import { useAuth } from "../context/AuthContext";

function FullScreenState({ message }: { message: string }) {
    return (
        <main className="min-h-screen flex items-center justify-center px-6 bg-surface-950">
            <div className="glass-card border-gold-500/15 rounded-2xl px-6 py-5 text-center max-w-md shadow-terminal-gold">
                <p className="text-sm font-semibold text-gold-400 uppercase tracking-[0.16em]">Trade-Craft</p>
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
            <main className="md:ml-[17.5rem] min-h-screen">{children}</main>
        </>
    );
}
