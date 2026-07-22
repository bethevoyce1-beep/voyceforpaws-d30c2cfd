import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";

// Standalone Supabase client (mirrors acs.functions.ts). The publishable key is
// not secret — it ships in the landing page HTML — so it's a safe fallback.
const FALLBACK_SUPABASE_URL = "https://okmukfrhvqkxphzueqww.supabase.co";
const FALLBACK_SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_e_OWsyXVeFqgV6EVGAKKTw_sgEV2cTN";

function serverClient() {
  const url = process.env.SUPABASE_URL || FALLBACK_SUPABASE_URL;
  const key =
    process.env.SUPABASE_PUBLISHABLE_KEY || FALLBACK_SUPABASE_PUBLISHABLE_KEY;
  return createClient(url, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

// In-app "Your alerts" feed. The notify-follows worker logs every alert to the
// notifications table; these read/clear it for the header bell.
export type AcsNotification = {
  id: string;
  email: string;
  animal_id: string | null;
  animal_name: string | null;
  title: string;
  body: string | null;
  url: string | null;
  kind: string;
  created_at: string;
  read_at: string | null;
};

export const getNotifications = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => {
    const o = (input ?? {}) as { email?: string };
    return { email: String(o.email ?? "").trim() };
  })
  .handler(async ({ data }): Promise<AcsNotification[]> => {
    if (!data.email) return [];
    const sb = serverClient();
    const { data: rows, error } = await sb.rpc("get_notifications", { p_email: data.email });
    if (error) return [];
    return (rows ?? []) as AcsNotification[];
  });

export const markNotificationsRead = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => {
    const o = (input ?? {}) as { email?: string };
    return { email: String(o.email ?? "").trim() };
  })
  .handler(async ({ data }): Promise<{ ok: boolean }> => {
    if (!data.email) return { ok: false };
    const sb = serverClient();
    const { error } = await sb.rpc("mark_notifications_read", { p_email: data.email });
    return { ok: !error };
  });
