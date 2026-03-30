import { supabase, supabaseConfigError } from "./supabaseClient";

export async function authedFetch(input: RequestInfo | URL, init?: RequestInit) {
    if (!supabase) {
        throw new Error(supabaseConfigError || "Supabase is not configured.");
    }

    const { data, error } = await supabase.auth.getSession();
    if (error) {
        throw new Error(error.message || "Unable to validate current login session.");
    }

    const accessToken = data.session?.access_token;
    if (!accessToken) {
        throw new Error("Session expired. Please login again.");
    }

    const headers = new Headers(init?.headers || {});
    headers.set("Authorization", `Bearer ${accessToken}`);

    return fetch(input, {
        ...init,
        headers,
    });
}
