import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabasePublishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabaseConfigError =
    !supabaseUrl || !supabasePublishableKey
        ? "Missing Supabase env vars: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY)."
        : null;

export const supabase =
    supabaseUrl && supabasePublishableKey
        ? createClient(supabaseUrl, supabasePublishableKey, {
              auth: {
                  persistSession: true,
                  autoRefreshToken: true,
              },
          })
        : null;
