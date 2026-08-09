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
        if (result.error) setError(result.error);
        setSubmitting(false);
    };

    return (
        <div className="min-h-screen flex items-center justify-center px-4 py-8">
            <div className="w-full max-w-sm">
                <div className="border border-terminal-border border-t-2 border-t-bb-orange bg-terminal-panel p-5">
                    <p className="text-[9px] font-mono font-bold text-bb-orange uppercase tracking-[0.25em]">
                        Trade-Craft Terminal
                    </p>
                    <h1 className="text-lg font-mono font-bold text-white uppercase mt-1">Sign In</h1>
                    <p className="text-[11px] text-terminal-muted mt-1">
                        Authenticate to access market intelligence.
                    </p>

                    <form onSubmit={handleSubmit} className="mt-4 space-y-3">
                        <div>
                            <label className="section-label block mb-1">Email</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                autoComplete="email"
                                className="w-full border border-terminal-border bg-terminal-bg px-2 py-2 text-[12px] font-mono text-white outline-none focus:border-bb-orange"
                            />
                        </div>
                        <div>
                            <label className="section-label block mb-1">Password</label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                autoComplete="current-password"
                                className="w-full border border-terminal-border bg-terminal-bg px-2 py-2 text-[12px] font-mono text-white outline-none focus:border-bb-orange"
                            />
                        </div>
                        {(error || configError) && (
                            <p className="text-[11px] font-mono text-bb-red border border-bb-red/30 bg-bb-red/10 px-2 py-1.5">
                                {error || configError}
                            </p>
                        )}
                        <button
                            type="submit"
                            disabled={loading || submitting || !!configError}
                            className="w-full btn-primary py-2 disabled:cursor-not-allowed"
                        >
                            {submitting ? "AUTH..." : "Sign In"}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
