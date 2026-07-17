import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";

// "Add media" (July 17, 2026): switched off the service-role admin client so
// the feature works without a hosting secret. Inserts now use the public
// (publishable) key and are guarded by a scoped RLS policy on
// acs_animal_media — the insert only succeeds for a valid source, a real
// http(s) link, and an animal_id that actually exists. Same validation the
// server function enforces below.

const ALLOWED_SOURCES = [
  "facebook",
  "youtube",
  "web",
  "instagram",
  "tiktok",
  "x",
  "other",
] as const;
export type MediaSource = (typeof ALLOWED_SOURCES)[number];

// The Supabase project URL + publishable (anon) key are NOT secret — the
// landing page ships them in plain HTML. Fall back to them so writes work even
// when the host hasn't set SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY env vars.
const FALLBACK_SUPABASE_URL = "https://okmukfrhvqkxphzueqww.supabase.co";
const FALLBACK_SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_e_OWsyXVeFqgV6EVGAKKTw_sgEV2cTN";

function publicClient() {
  const url = process.env.SUPABASE_URL || FALLBACK_SUPABASE_URL;
  const key =
    process.env.SUPABASE_PUBLISHABLE_KEY || FALLBACK_SUPABASE_PUBLISHABLE_KEY;
  return createClient(url, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

export const addAnimalMedia = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => {
    const o = (input ?? {}) as {
      animalId?: string;
      source?: string;
      url?: string;
      credit?: string;
      note?: string;
    };
    const animalId = String(o.animalId ?? "").trim();
    const source = String(o.source ?? "").trim() as MediaSource;
    const url = String(o.url ?? "").trim();
    const credit = o.credit ? String(o.credit).trim().slice(0, 200) : undefined;
    const note = o.note ? String(o.note).trim().slice(0, 500) : undefined;

    if (!animalId) throw new Error("Missing animal");
    if (!ALLOWED_SOURCES.includes(source)) throw new Error("Invalid source");
    if (!/^https?:\/\//i.test(url) || url.length > 2048) {
      throw new Error("Paste a full link starting with http:// or https://");
    }
    return { animalId, source, url, credit, note };
  })
  .handler(async ({ data }) => {
    const sb = publicClient();

    // The animal must actually exist — same check the RLS policy enforces.
    const { data: animal, error: findErr } = await sb
      .from("acs_animals")
      .select("id")
      .eq("id", data.animalId)
      .maybeSingle();
    if (findErr) throw new Error(findErr.message);
    if (!animal) throw new Error("Animal not found");

    const { error } = await sb.from("acs_animal_media").insert({
      animal_id: data.animalId,
      source: data.source,
      url: data.url,
      credit: data.credit ?? null,
      note: data.note ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
