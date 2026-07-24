import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";

// Standalone Supabase client (mirrors acs.functions.ts / share.functions.ts).
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

export type NetworkResponse = {
  id: string;
  created_at: string;
  subject_type: string;
  subject_id: string;
  animal_name: string | null;
  responder_name: string;
  kind: string;
  detail: string | null;
};

// A rescuer/foster/etc. responds to a specific animal — logged to the shared
// "How the network is responding" feed so everyone watching that animal sees
// the pack step up in real time.
export const addNetworkResponse = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => {
    const o = (input ?? {}) as Record<string, unknown>;
    const s = (k: string) => (typeof o[k] === "string" ? (o[k] as string) : "");
    return {
      subjectType: s("subjectType") || "acs",
      subjectId: s("subjectId"),
      animalName: s("animalName") || null,
      responderName: s("responderName") || "Someone",
      kind: s("kind") || "other",
      detail: s("detail") || null,
    };
  })
  .handler(async ({ data }): Promise<{ ok: boolean; error?: string }> => {
    if (!data.subjectId) return { ok: false, error: "Missing animal." };
    const sb = serverClient();
    const { data: res, error } = await sb.rpc("add_network_response", {
      p: {
        subject_type: data.subjectType,
        subject_id: data.subjectId,
        animal_name: data.animalName,
        responder_name: data.responderName,
        kind: data.kind,
        detail: data.detail,
      },
    });
    if (error) return { ok: false, error: error.message };
    return (res ?? { ok: true }) as { ok: boolean; error?: string };
  });

// Live feed of responses for one animal (newest first).
export const listNetworkResponses = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => {
    const o = (input ?? {}) as { subjectType?: string; subjectId?: string };
    return {
      subjectType: String(o.subjectType ?? "acs").trim() || "acs",
      subjectId: String(o.subjectId ?? "").trim(),
    };
  })
  .handler(async ({ data }): Promise<NetworkResponse[]> => {
    if (!data.subjectId) return [];
    const sb = serverClient();
    const { data: rows, error } = await sb.rpc("list_network_responses", {
      p_subject_type: data.subjectType,
      p_subject_id: data.subjectId,
    });
    if (error || !rows) return [];
    return rows as NetworkResponse[];
  });
