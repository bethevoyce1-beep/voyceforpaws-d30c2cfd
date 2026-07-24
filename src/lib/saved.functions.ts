import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Assessment } from "@/lib/analyze.functions";

// Standalone Supabase client (mirrors share.functions.ts). Publishable key is
// safe to ship in the client.
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

export type SavedReport = {
  id: string;
  created_at: string;
  image: string | null;
  data: Assessment | null;
  mission: string | null;
  situation: string | null;
  location: { lat?: number; lon?: number; label?: string } | null;
  note: string | null;
  loc_privacy: string | null;
};

// Recent saved rescue cards, newest first — powers the "Saved cards" gallery.
export const listSharedReports = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => {
    const o = (input ?? {}) as { limit?: number };
    const n = Number(o.limit);
    return { limit: Number.isFinite(n) && n > 0 ? Math.min(Math.floor(n), 100) : 40 };
  })
  .handler(async ({ data }): Promise<SavedReport[]> => {
    const sb = serverClient();
    const { data: rows, error } = await sb.rpc("list_shared_reports", { p_limit: data.limit });
    if (error || !rows) return [];
    return rows as SavedReport[];
  });
