import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Assessment } from "@/lib/analyze.functions";

// Standalone Supabase client (mirrors acs.functions.ts / notifications.functions.ts).
// The publishable key is not secret — it ships in the landing page HTML.
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

export type SharedReport = {
  id: string;
  created_at: string;
  image: string | null;
  data: Assessment;
  mission: string | null;
  situation: string | null;
  location: { lat?: number; lon?: number; label?: string } | null;
  note: string | null;
  loc_privacy: "exact" | "area" | "hidden" | string | null;
  views: number;
};

// Persist a rescue card the reporter chose to share, returning a short slug so
// the app can build a public permalink (/r/<id>) that shows the exact animal.
export const createSharedReport = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => {
    const o = (input ?? {}) as {
      image?: string;
      data?: unknown;
      mission?: string;
      situation?: string;
      location?: unknown;
      note?: string;
      locPrivacy?: string;
    };
    const priv = o.locPrivacy === "exact" || o.locPrivacy === "hidden" ? o.locPrivacy : "area";
    return {
      image: o.image ? String(o.image) : null,
      data: (o.data ?? {}) as Record<string, unknown>,
      mission: o.mission ? String(o.mission) : null,
      situation: o.situation ? String(o.situation) : null,
      location: (o.location ?? null) as Record<string, unknown> | null,
      note: o.note ? String(o.note).slice(0, 600) : null,
      locPrivacy: priv,
    };
  })
  .handler(async ({ data }): Promise<{ id: string | null; error?: string }> => {
    const sb = serverClient();
    const { data: id, error } = await sb.rpc("create_shared_report", {
      p: {
        image: data.image,
        data: data.data,
        mission: data.mission,
        situation: data.situation,
        location: data.location,
        note: data.note,
        loc_privacy: data.locPrivacy,
      },
    });
    if (error) return { id: null, error: error.message };
    return { id: (id as string) ?? null };
  });

// Fetch a shared rescue card for the public /r/<id> page (also bumps views).
export const getSharedReport = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => {
    const o = (input ?? {}) as { id?: string };
    return { id: String(o.id ?? "").trim() };
  })
  .handler(async ({ data }): Promise<SharedReport | null> => {
    if (!data.id) return null;
    const sb = serverClient();
    const { data: row, error } = await sb.rpc("get_shared_report", { p_id: data.id });
    if (error || !row) return null;
    return row as SharedReport;
  });
