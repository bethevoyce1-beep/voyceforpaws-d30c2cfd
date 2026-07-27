import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

// =============================================================
// Browser-only auth client for Voyce for Paws accounts (Supabase Auth).
// Persists the session in localStorage and captures the session from the
// email-confirmation redirect. Only call these from the client (browser).
// =============================================================

const SUPABASE_URL = "https://okmukfrhvqkxphzueqww.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_e_OWsyXVeFqgV6EVGAKKTw_sgEV2cTN";

let _client: SupabaseClient | null = null;

export function authClient(): SupabaseClient {
  if (typeof window === "undefined") {
    throw new Error("authClient() is browser-only");
  }
  if (!_client) {
    _client = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: "pkce",
      },
    });
  }
  return _client;
}

export type VoyceUser = {
  id: string;
  email: string | null;
  name: string;
};

export async function signUpEmail(name: string, email: string, password: string) {
  const emailRedirectTo = `${window.location.origin}/auth/login`;
  return authClient().auth.signUp({
    email,
    password,
    options: { data: { name }, emailRedirectTo },
  });
}

export async function signInEmail(email: string, password: string) {
  return authClient().auth.signInWithPassword({ email, password });
}

// One-tap social sign-in (Google / Apple / Facebook). Redirects to the provider
// and comes back to /auth/login, where detectSessionInUrl + PKCE capture the
// session and the page sends the user into the app. Enable each provider in
// Supabase first.
export async function signInWithProvider(provider: "google" | "apple" | "facebook") {
  const redirectTo = `${window.location.origin}/auth/login`;
  return authClient().auth.signInWithOAuth({ provider, options: { redirectTo } });
}

export async function signOut() {
  return authClient().auth.signOut();
}

export async function currentUser(): Promise<VoyceUser | null> {
  const { data } = await authClient().auth.getSession();
  const u: User | undefined = data.session?.user;
  if (!u) return null;
  const meta = (u.user_metadata ?? {}) as { name?: string };
  return { id: u.id, email: u.email ?? null, name: meta.name || (u.email ?? "").split("@")[0] || "Friend" };
}
