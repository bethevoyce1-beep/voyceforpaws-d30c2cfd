import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";

// Standalone Supabase client (mirrors notifications.functions.ts). The publishable
// key is not secret — it ships in the landing page HTML — so it's a safe fallback.
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

// Rescue-pull request from the animal detail card. A rescue / organization that
// can pull a dog submits their details; Voyce coordinates the follow-up. Calls
// the submit_rescue_pull(p jsonb) RPC (granted to anon), which returns
// { ok: true, id } or { ok: false, error }.
export const submitRescuePull = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => {
    const o = (input ?? {}) as {
      animal_id?: string;
      animal_name?: string;
      org_name?: string;
      is_501c3?: string;
      website?: string;
      contact_name?: string;
      contact_email?: string;
      contact_phone?: string;
      note?: string;
    };
    return {
      animal_id: String(o.animal_id ?? "").trim(),
      animal_name: String(o.animal_name ?? "").trim(),
      org_name: String(o.org_name ?? "").trim(),
      is_501c3: o.is_501c3 === "yes" ? "yes" : "no",
      website: o.website ? String(o.website).trim() : null,
      contact_name: o.contact_name ? String(o.contact_name).trim() : null,
      contact_email: o.contact_email ? String(o.contact_email).trim() : null,
      contact_phone: o.contact_phone ? String(o.contact_phone).trim() : null,
      note: o.note ? String(o.note).trim() : null,
    };
  })
  .handler(
    async ({ data }): Promise<{ ok: boolean; id?: string; error?: string }> => {
      if (!data.org_name)
        return { ok: false, error: "Organization / rescue name is required." };
      const sb = serverClient();
      const { data: res, error } = await sb.rpc("submit_rescue_pull", {
        p: { ...data, source: "app" },
      });
      if (error) return { ok: false, error: error.message };
      return (res ?? { ok: true }) as { ok: boolean; id?: string; error?: string };
    },
  );
