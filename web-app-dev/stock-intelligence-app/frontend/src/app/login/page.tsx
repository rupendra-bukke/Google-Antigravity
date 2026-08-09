"use client";

import { FormEvent, useState } from "react";
import { useAuth } from "../context/AuthContext";

export default function LoginPage() {
    const { signIn, loading, configError } = useAuth();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setSubmitting(true);
        setError(null);

        const result = await signIn(email.trim(), password);
        if (result.error) {
            setError(result.error);
        }

        setSubmitting(false);
    };

    return (
        <div className="min-h-screen flex items-center justify-center px-4 py-12">
            <div className="w-full max-w-md">
                <div className="text-center mb-6">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl border border-gold-500/30 shadow-terminal-gold overflow-hidden mb-4">
                        <img src="/assets/trade-craft-logo.png" alt="Trade-Craft" className="w-full h-full object-cover" />
                    </div>
                    <p className="text-[10px] font-bold text-gold-400 uppercase tracking-[0.22em]">Trade-Craft Terminal</p>
                    <h1 className="text-2xl md:text-3xl font-display font-black text-gradient-gold mt-2">Sign in</h1>
                    <p className="text-sm text-gray-400 mt-2">
                        Access your intraday dashboard, watchlist, and checkpoint history.
                    </p>
                </div>

                <div className="glass-card border-gold-500/15 p-6 md:p-7 shadow-terminal-gold">
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="section-label mb-2 block">Email</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(event) => setEmail(event.target.value)}
                                required
                                autoComplete="email"
                                placeholder="you@example.com"
                                className="w-full rounded-xl border border-white/10 bg-surface-950/80 px-3 py-2.5 text-sm text-white outline-none focus:border-gold-500/50 focus:ring-1 focus:ring-gold-500/20"
                            />
                        </div>

                        <div>
                            <label className="section-label mb-2 block">Password</label>
                            <input
                                type="password"
                                value={password}
                                onChange={(event) => setPassword(event.target.value)}
                                required
                                autoComplete="current-password"
                                placeholder="Enter your password"
                                className="w-full rounded-xl border border-white/10 bg-surface-950/80 px-3 py-2.5 text-sm text-white outline-none focus:border-gold-500/50 focus:ring-1 focus:ring-gold-500/20"
                            />
                        </div>

                        {(error || configError) && (
                            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2.5">
                                <p className="text-xs text-rose-300">{error || configError}</p>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading || submitting || !!configError}
                            className="w-full btn-gold py-2.5 text-sm disabled:cursor-not-allowed"
                        >
                            {submitting ? "Signing in..." : "Sign In"}
                        </button>
                    </form>

                    <p className="text-[11px] text-gray-500 mt-5 text-center">
                        Need access? Ask admin to add your email in Supabase users.
                    </p>
                </div>
            </div>
        </div>
    );
}
