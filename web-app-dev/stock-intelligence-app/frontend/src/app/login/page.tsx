"use client";

import { FormEvent, useState } from "react";
import { useAuth } from "../context/AuthContext";
import TradeCraftBrand from "../components/TradeCraftBrand";

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
        if (result.error) setError(result.error);
        setSubmitting(false);
    };

    return (
        <div className="flex min-h-screen items-center justify-center px-4 py-10">
            <div className="w-full max-w-md rounded-3xl border border-terminal-border bg-terminal-panel/95 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.45)] md:p-8">
                <TradeCraftBrand size="md" />
                <h1 className="mt-6 text-2xl font-semibold text-white">Sign in</h1>
                <p className="mt-1 text-sm text-terminal-muted">
                    Your market desk for NSE indices, checkpoints, and the daily brief.
                </p>

                <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                    <div>
                        <label className="section-label mb-1.5 block">Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            autoComplete="email"
                            className="w-full rounded-xl border border-terminal-border bg-terminal-bg px-3 py-2.5 text-sm text-white outline-none focus:border-bb-orange"
                        />
                    </div>
                    <div>
                        <label className="section-label mb-1.5 block">Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            autoComplete="current-password"
                            className="w-full rounded-xl border border-terminal-border bg-terminal-bg px-3 py-2.5 text-sm text-white outline-none focus:border-bb-orange"
                        />
                    </div>
                    {(error || configError) && (
                        <p className="rounded-xl border border-bb-red/40 bg-bb-red/10 px-3 py-2 text-sm text-bb-red">
                            {error || configError}
                        </p>
                    )}
                    <button
                        type="submit"
                        disabled={loading || submitting || !!configError}
                        className="btn-primary w-full py-2.5 text-sm disabled:cursor-not-allowed"
                    >
                        {submitting ? "Signing in..." : "Sign in"}
                    </button>
                </form>
            </div>
        </div>
    );
}
