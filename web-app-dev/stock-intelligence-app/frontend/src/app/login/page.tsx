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
            <div className="w-full max-w-md rounded-2xl border border-brand-500/30 bg-[#0f172ae0] p-6 md:p-7 shadow-2xl">
                <div className="text-center">
                    <p className="text-[0.72rem] font-extrabold text-brand-300 uppercase tracking-[0.18em]">Trade-Craft</p>
                    <h1 className="text-2xl md:text-3xl font-black text-white mt-2">Sign In</h1>
                    <p className="text-sm text-gray-400 mt-2">
                        Login with your account to access dashboard and watchlist.
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                    <div>
                        <label className="block text-xs font-semibold text-gray-300 uppercase tracking-[0.12em] mb-2">
                            Email
                        </label>
                        <input
                            type="email"
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                            required
                            autoComplete="email"
                            placeholder="you@example.com"
                            className="w-full rounded-xl border border-white/15 bg-[#0b1225] px-3 py-2.5 text-sm text-white outline-none focus:border-brand-400"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-gray-300 uppercase tracking-[0.12em] mb-2">
                            Password
                        </label>
                        <input
                            type="password"
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                            required
                            autoComplete="current-password"
                            placeholder="Enter your password"
                            className="w-full rounded-xl border border-white/15 bg-[#0b1225] px-3 py-2.5 text-sm text-white outline-none focus:border-brand-400"
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
                        className="w-full rounded-xl border border-brand-500/40 bg-brand-500/20 px-3 py-2.5 text-sm font-bold text-brand-200 disabled:opacity-60"
                    >
                        {submitting ? "Signing in..." : "Sign In"}
                    </button>
                </form>

                <p className="text-[11px] text-gray-500 mt-5 text-center">
                    If you need access, ask admin to add your email in Supabase users.
                </p>
            </div>
        </div>
    );
}
