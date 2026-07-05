import { createServerFn } from "@tanstack/react-start";

// Server-side "Add media" (July 5, 2026): Lovable's security migration
// removed anonymous INSERT on acs_animal_media (it was a spam vector).
// The app has no user accounts, so the insert now goes through this server
// function — same pattern as network signups — with the same validation
// rules the database policy enforces.

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
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // The animal must actually exist — same check the DB policy makes.
    const { data: animal, error: findErr } = await supabaseAdmin
      .from("acs_animals")
      .select("id")
      .eq("id", data.animalId)
      .maybeSingle();
    if (findErr) throw new Error(findErr.message);
    if (!animal) throw new Error("Animal not found");

    const { error } = await supabaseAdmin.from("acs_animal_media").insert({
      animal_id: data.animalId,
      source: data.source,
      url: data.url,
      credit: data.credit ?? null,
      note: data.note ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
