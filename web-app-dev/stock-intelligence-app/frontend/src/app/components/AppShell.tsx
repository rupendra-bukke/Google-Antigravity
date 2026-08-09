"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Sidebar from "./Sidebar";
import { useAuth } from "../context/AuthContext";

function FullScreenState({ message }: { message: string }) {
    return (
        <main className="min-h-screen flex items-center justify-center px-4 bg-terminal-bg">
            <div className="border border-terminal-border border-t-2 border-t-bb-orange bg-terminal-panel px-6 py-4 max-w-md text-center">
                <p className="text-[10px] font-mono font-bold text-bb-orange uppercase tracking-widest">Trade-Craft</p>
                <p className="text-sm text-terminal-text mt-2 font-mono">{message}</p>
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
        if (needsLogin) router.replace("/login");
        else if (shouldGoHome) router.replace("/");
    }, [needsLogin, shouldGoHome, router]);

    if (loading) return <FullScreenState message="Checking session..." />;
    if (configError) return <FullScreenState message={configError} />;
    if (needsLogin || shouldGoHome) return <FullScreenState message="Redirecting..." />;
    if (isLoginPage) return <main className="min-h-screen bg-terminal-bg">{children}</main>;

    return (
        <>
            <Sidebar />
            <main className="md:ml-52 min-h-screen bg-terminal-bg">{children}</main>
        </>
    );
}
