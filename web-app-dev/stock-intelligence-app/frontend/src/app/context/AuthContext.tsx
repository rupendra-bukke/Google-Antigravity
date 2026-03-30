"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase, supabaseConfigError } from "@/lib/supabaseClient";

interface AuthContextValue {
    session: Session | null;
    user: User | null;
    loading: boolean;
    configError: string | null;
    signIn: (email: string, password: string) => Promise<{ error: string | null }>;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;

        if (!supabase) {
            setLoading(false);
            return;
        }

        supabase.auth
            .getSession()
            .then(({ data }) => {
                if (!isMounted) return;
                setSession(data.session ?? null);
                setLoading(false);
            })
            .catch(() => {
                if (!isMounted) return;
                setLoading(false);
            });

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, nextSession) => {
            setSession(nextSession);
            setLoading(false);
        });

        return () => {
            isMounted = false;
            subscription.unsubscribe();
        };
    }, []);

    const value = useMemo<AuthContextValue>(
        () => ({
            session,
            user: session?.user ?? null,
            loading,
            configError: supabaseConfigError,
            signIn: async (email: string, password: string) => {
                if (!supabase) {
                    return {
                        error:
                            supabaseConfigError ||
                            "Supabase client is not configured. Check env vars.",
                    };
                }

                const { error } = await supabase.auth.signInWithPassword({ email, password });
                return { error: error?.message ?? null };
            },
            signOut: async () => {
                if (!supabase) return;
                await supabase.auth.signOut();
            },
        }),
        [session, loading]
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error("useAuth must be used inside AuthProvider");
    }
    return context;
}
