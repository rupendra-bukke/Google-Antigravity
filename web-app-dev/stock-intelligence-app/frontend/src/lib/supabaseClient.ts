import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const supabasePublishableKey = (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)?.trim();

function looksLikePlaceholder(value: string | undefined): boolean {
    if (!value) return true;
    const normalized = value.toLowerCase();
    return (
        normalized.includes("your_project_id") ||
        normalized.includes("your_token") ||
        normalized.includes("xxx") ||
        normalized === "https://.supabase.co"
    );
}

function buildConfigError(): string | null {
    if (!supabaseUrl || !supabasePublishableKey) {
        return "Missing Supabase env vars on Vercel: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY), then redeploy.";
    }
    if (looksLikePlaceholder(supabaseUrl) || looksLikePlaceholder(supabasePublishableKey)) {
        return "Supabase env vars look like placeholders. Replace them with real values from Supabase Dashboard → Project Settings → API, then redeploy on Vercel.";
    }
    if (!supabaseUrl.startsWith("https://") || !supabaseUrl.includes(".supabase.co")) {
        return "NEXT_PUBLIC_SUPABASE_URL must look like https://YOUR_PROJECT_REF.supabase.co";
    }
    return null;
}

export const supabaseConfigError = buildConfigError();

export const supabase =
    supabaseUrl && supabasePublishableKey && !supabaseConfigError
        ? createClient(supabaseUrl, supabasePublishableKey, {
              auth: {
                  persistSession: true,
                  autoRefreshToken: true,
              },
          })
        : null;

export function formatAuthError(message: string): string {
    const normalized = message.trim().toLowerCase();

    if (
        normalized === "load failed" ||
        normalized.includes("failed to fetch") ||
        normalized.includes("networkerror") ||
        normalized.includes("network request failed")
    ) {
        return "Cannot reach Supabase from the browser. Check Vercel env vars, redeploy, and add https://trade-craft-rb.vercel.app in Supabase → Authentication → URL Configuration.";
    }

    if (normalized.includes("invalid login credentials")) {
        return "Invalid email or password. Confirm the user exists in Supabase → Authentication → Users.";
    }

    return message;
}
