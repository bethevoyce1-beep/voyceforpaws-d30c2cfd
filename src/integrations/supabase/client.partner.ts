import { createClient } from "@supabase/supabase-js";

// Self-contained browser Supabase client for the trusted-partner portal.
// Uses the publishable (anon) key — NOT secret; it already ships in the public
// landing page — so partner sign-in works without any build-time env vars. A
// distinct storageKey keeps its auth session separate from any other client.

const SUPABASE_URL = "https://okmukfrhvqkxphzueqww.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_e_OWsyXVeFqgV6EVGAKKTw_sgEV2cTN";

function isNewApiKey(value: string): boolean {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}

// New-style opaque keys are not bearer JWTs — send them as `apikey`, and strip
// an Authorization header that merely repeats the publishable key (a real
// signed-in user JWT is different and is left in place).
function partnerFetch(key: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );
    if (init?.headers) {
      new Headers(init.headers).forEach((value, k) => headers.set(k, value));
    }
    if (isNewApiKey(key) && headers.get("Authorization") === `Bearer ${key}`) {
      headers.delete("Authorization");
    }
    headers.set("apikey", key);
    return fetch(input, { ...init, headers });
  };
}

export const partnerSupabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  global: { fetch: partnerFetch(SUPABASE_PUBLISHABLE_KEY) },
  auth: {
    storage: typeof window !== "undefined" ? window.localStorage : undefined,
    storageKey: "voyce-partner-auth",
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
