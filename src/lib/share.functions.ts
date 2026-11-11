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

// Reporter's after-the-fact corrections/additions — what the AI missed or got
// wrong. Saved on the shared report so the PUBLIC card reflects them for
// everyone, even after the link was already shared.
export type ReporterAdded = {
  animal?: string;      // "Dog" | "Cat" | "Puppy" | "Kitten" | "Other"
  breed?: string;       // reporter's breed correction (AI breed is a guess)
  situation?: string;   // one of the "what's happening" options
  witnessed?: string[]; // things a photo can't show (hit by car, trapped, abuse)
  note?: string;        // free text
} | null;

// Structured "where / who / how to help" metadata on a shared rescue card.
// Stored in the shared_reports.case_meta jsonb column. Everything is optional —
// a card with no case_meta renders exactly as before. Populated from a pasted
// post (see extractPost) or by the reporter; the AI is never allowed to invent
// any of it.
export type CaseMeta = {
  origin?: {
    shelter_name?: string | null;
    city?: string | null;
    state?: string | null;
    address?: string | null;
  } | null;
  rescue?: {
    name?: string | null;
    url?: string | null;
    email?: string | null;
    facebook?: string | null;
    phone?: string | null;
  } | null;
  source_url?: string | null; // where the original post came from
  deadline?: string | null;   // e.g. "today", or an ISO date
  ask?: string | null;        // e.g. "foster", "adopt", "transport"
} | null;

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
  reporter_added?: ReporterAdded;
  case_meta?: CaseMeta;
};

// Fold the reporter's corrections into the AI assessment so the card's FACTS
// update (not just an annotation): animal type overrides species/age, and the
// chosen situation drives the honest headline.
export function mergeReporterAdded(data: Assessment, ra: ReporterAdded): Assessment {
  if (!ra) return data;
  const d = { ...data } as Assessment;
  const a = (ra.animal || "").trim().toLowerCase();
  if (a === "dog") d.species = "dog";
  else if (a === "cat") d.species = "cat";
  else if (a === "puppy") { d.species = "dog"; d.age = "puppy"; }
  else if (a === "kitten") { d.species = "cat"; d.age = "kitten"; }
  if (ra.breed && ra.breed.trim()) d.breed = ra.breed.trim();
  if (ra.situation) d.suggested_situation = ra.situation;
  return d;
}

// A single readable line summarizing the reporter's corrections.
export function reporterAddedSummary(ra: ReporterAdded): string {
  if (!ra) return "";
  return [
    ra.animal,
    ra.breed && ra.breed.trim() ? `breed: ${ra.breed.trim()}` : "",
    ra.situation,
    ra.witnessed && ra.witnessed.length ? `saw: ${ra.witnessed.join(", ")}` : "",
    (ra.note || "").trim(),
  ].filter(Boolean).join(" · ");
}

// Persist a rescue card the reporter chose to share, returning a short slug so
// the app can build a public permalink (/r/<id>) that shows the exact animal.
// A client-supplied `editToken` is stored (secret) so the reporter can later
// update this same card with corrections that reach everyone.
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
      editToken?: string;
      caseMeta?: unknown;
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
      editToken: o.editToken ? String(o.editToken).slice(0, 64) : null,
      // Optional structured case metadata (origin shelter, coordinating rescue,
      // source URL, deadline, ask). Backward compatible — null when absent.
      caseMeta: (o.caseMeta ?? null) as Record<string, unknown> | null,
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
        edit_token: data.editToken,
        case_meta: data.caseMeta,
      },
    });
    if (error) return { id: null, error: error.message };
    return { id: (id as string) ?? null };
  });

// Save the reporter's corrections onto an already-shared card. Gated by the
// secret editToken the creator holds — so only they can change their card, and
// the public /r/<id> page then reflects it for everyone. Can carry the
// reporter's corrections and/or updated case metadata; each is applied only
// when present, so updating one never wipes the other.
export const updateSharedReport = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => {
    const o = (input ?? {}) as { id?: string; editToken?: string; reporterAdded?: unknown; caseMeta?: unknown };
    return {
      id: String(o.id ?? "").trim(),
      editToken: String(o.editToken ?? "").trim(),
      reporterAdded: (o.reporterAdded ?? null) as Record<string, unknown> | null,
      caseMeta: (o.caseMeta ?? null) as Record<string, unknown> | null,
    };
  })
  .handler(async ({ data }): Promise<{ ok: boolean; error?: string }> => {
    if (!data.id || !data.editToken) return { ok: false, error: "missing" };
    const sb = serverClient();
    // Only send keys that were actually provided, so a reporter-corrections
    // update doesn't null out case_meta and vice versa.
    const p: Record<string, unknown> = { id: data.id, edit_token: data.editToken };
    if (data.reporterAdded !== null) p.reporter_added = data.reporterAdded;
    if (data.caseMeta !== null) p.case_meta = data.caseMeta;
    const { data: res, error } = await sb.rpc("update_shared_report", { p });
    if (error) return { ok: false, error: error.message };
    return (res ?? { ok: true }) as { ok: boolean; error?: string };
  });

// Analytics: log every real (non-sample) test the app runs — the small image
// plus the AI read — so we can see what people are photographing and how Voyce
// is doing. Fire-and-forget from the client; never blocks the report.
export const logReportEvent = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => {
    const o = (input ?? {}) as Record<string, unknown>;
    const s = (k: string) => (typeof o[k] === "string" ? (o[k] as string) : null);
    return {
      image: s("image"),
      mission: s("mission"),
      species: s("species"),
      breed: s("breed"),
      size: s("size"),
      color: s("color"),
      status: s("status"),
      visible_condition: s("visible_condition"),
      ai_confidence: s("ai_confidence"),
      suggested_situation: s("suggested_situation"),
      authenticity: s("authenticity"),
      observations: Array.isArray(o.observations) ? (o.observations as unknown[]).map(String) : [],
    };
  })
  .handler(async ({ data }): Promise<{ ok: boolean }> => {
    try {
      const sb = serverClient();
      await sb.rpc("log_report_event", { p: data });
      return { ok: true };
    } catch {
      return { ok: false };
    }
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
