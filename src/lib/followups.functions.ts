import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { normalizeStatusKey } from "@/lib/acs.functions";

// ============================================================
// Accountability trail — server functions.
//
// This is the "what happened AFTER the shelter" layer. It never touches the
// acs_animals feed or the scraper; it reads the same rows plus a separate
// acs_followups table and derives, per animal, whether it made it out, is in
// foster, was confirmed euthanized, came back (returned), or has gone dark with
// no follow-up ("unaccounted for").
// ============================================================

// How long after an animal leaves the list we wait before, with no follow-up
// recorded, it is publicly flagged "unaccounted for".
export const UNACCOUNTED_AFTER_DAYS = 14;

export type FollowupOutcome =
  | "pulled"
  | "in_foster"
  | "adopted"
  | "reclaimed"
  | "transferred"
  | "passed"
  | "returned"
  | "unknown";

export type Followup = {
  id: string;
  animal_id: string;
  outcome: FollowupOutcome;
  partner_name: string | null;
  note: string | null;
  photo_url: string | null;
  occurred_on: string;
  created_at: string;
  created_by: string;
};

// A single scannable state per animal for the public trail + filters.
export type OutcomeState =
  | "at_risk" // still on the list, not a foster hold
  | "foster" // currently on an ACS foster hold / foster pending
  | "made_it_out" // left the list, not euthanized (safe, or with a positive follow-up)
  | "in_memoriam" // confirmed euthanized by ACS
  | "unaccounted"; // left the list, not euthanized, no follow-up past the grace window

export type OutcomeAnimal = {
  id: string;
  name: string;
  breed: string | null;
  thumb: string | null;
  photos: string[];
  status_key: string | null;
  public_status: string | null;
  pet_search_url: string | null;
  story: string | null;
  list_date: string | null;
  left_at: string | null;
  euth_date: string | null;
  times_listed: number;
  returned: boolean;
  state: OutcomeState;
  days_since_left: number | null;
  latest_outcome: FollowupOutcome | null;
  followups: Followup[];
};

export type OutcomeSummary = {
  total: number;
  at_risk: number;
  foster: number;
  made_it_out: number;
  in_memoriam: number;
  unaccounted: number;
  returned: number;
};

export type OutcomesResult = {
  animals: OutcomeAnimal[];
  summary: OutcomeSummary;
  shelter_name: string;
  generated_at: string;
};

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

function normalizePhotos(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.filter((p): p is string => typeof p === "string" && p.trim().length > 0);
  }
  if (typeof raw === "string" && raw.trim().length > 0) return [raw.trim()];
  return [];
}

function daysBetween(fromIso: string | null, to: number): number | null {
  if (!fromIso) return null;
  const t = new Date(fromIso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.floor((to - t) / (1000 * 60 * 60 * 24));
}

// The follow-up outcomes that count as a positive, confirmed placement.
const POSITIVE_OUTCOMES: FollowupOutcome[] = ["adopted", "reclaimed", "transferred"];

export const listOutcomes = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => {
    const o = (input ?? {}) as { shelterId?: string };
    return { shelterId: o.shelterId || "san_antonio_acs" };
  })
  .handler(async (): Promise<OutcomesResult> => {
    const sb = serverClient();
    const now = Date.now();

    const [{ data: animalRows, error: aErr }, { data: fuRows, error: fErr }] =
      await Promise.all([
        sb
          .from("acs_animals")
          .select(
            "id, name, breed, thumb, photos, status_key, public_status, pet_search_url, story, list_date, left_at, euth_date, times_listed, returned",
          ),
        sb
          .from("acs_followups")
          .select(
            "id, animal_id, outcome, partner_name, note, photo_url, occurred_on, created_at, created_by",
          )
          .order("occurred_on", { ascending: true }),
      ]);

    if (aErr) throw new Error(aErr.message);
    if (fErr) throw new Error(fErr.message);

    // Group follow-ups by animal.
    const byAnimal = new Map<string, Followup[]>();
    for (const r of fuRows ?? []) {
      const row = r as Record<string, unknown>;
      const fu: Followup = {
        id: String(row.id),
        animal_id: String(row.animal_id),
        outcome: (row.outcome as FollowupOutcome) ?? "unknown",
        partner_name: (row.partner_name as string | null) ?? null,
        note: (row.note as string | null) ?? null,
        photo_url: (row.photo_url as string | null) ?? null,
        occurred_on: String(row.occurred_on),
        created_at: String(row.created_at),
        created_by: (row.created_by as string) ?? "admin",
      };
      const arr = byAnimal.get(fu.animal_id) ?? [];
      arr.push(fu);
      byAnimal.set(fu.animal_id, arr);
    }

    const animals: OutcomeAnimal[] = (animalRows ?? []).map((r) => {
      const row = r as Record<string, unknown>;
      const id = String(row.id);
      const key = normalizeStatusKey(row.status_key as string | null);
      const left_at = (row.left_at as string | null) ?? null;
      const times_listed = (row.times_listed as number | null) ?? 1;
      const returned = Boolean(row.returned) || times_listed > 1;
      const followups = byAnimal.get(id) ?? [];
      const latest = followups.length > 0 ? followups[followups.length - 1] : null;
      const latest_outcome = latest ? latest.outcome : null;
      const days_since_left = daysBetween(left_at, now);

      // Derive the single public state.
      let state: OutcomeState;
      if (key === "euthanized" || latest_outcome === "passed") {
        state = "in_memoriam";
      } else if (left_at) {
        // Left the list and not euthanized.
        const hasPositive =
          latest_outcome !== null &&
          (POSITIVE_OUTCOMES.includes(latest_outcome) || latest_outcome === "in_foster" || latest_outcome === "pulled");
        if (hasPositive) {
          state = latest_outcome === "in_foster" ? "foster" : "made_it_out";
        } else if ((days_since_left ?? 0) > UNACCOUNTED_AFTER_DAYS) {
          state = "unaccounted";
        } else {
          // Recently left, still inside the grace window — treat as made it out
          // for now (no accusation yet); it flips to unaccounted after the window.
          state = "made_it_out";
        }
      } else if (key === "foster" || key === "watch") {
        state = "foster";
      } else {
        state = "at_risk";
      }

      return {
        id,
        name: (row.name as string | null) ?? "Unnamed",
        breed: (row.breed as string | null) ?? null,
        thumb: (row.thumb as string | null) ?? null,
        photos: normalizePhotos(row.photos),
        status_key: (row.status_key as string | null) ?? null,
        public_status: (row.public_status as string | null) ?? null,
        pet_search_url: (row.pet_search_url as string | null) ?? null,
        story: (row.story as string | null) ?? null,
        list_date: (row.list_date as string | null) ?? null,
        left_at,
        euth_date: (row.euth_date as string | null) ?? null,
        times_listed,
        returned,
        state,
        days_since_left,
        latest_outcome,
        followups,
      };
    });

    // Order: most urgent accountability first — unaccounted, then memoriam,
    // then fosters, then still-at-risk, then made it out (most recent first).
    const stateRank: Record<OutcomeState, number> = {
      unaccounted: 0,
      in_memoriam: 1,
      foster: 2,
      at_risk: 3,
      made_it_out: 4,
    };
    animals.sort((x, y) => {
      if (stateRank[x.state] !== stateRank[y.state]) return stateRank[x.state] - stateRank[y.state];
      return (y.left_at ?? y.list_date ?? "").localeCompare(x.left_at ?? x.list_date ?? "");
    });

    const summary: OutcomeSummary = {
      total: animals.length,
      at_risk: animals.filter((a) => a.state === "at_risk").length,
      foster: animals.filter((a) => a.state === "foster").length,
      made_it_out: animals.filter((a) => a.state === "made_it_out").length,
      in_memoriam: animals.filter((a) => a.state === "in_memoriam").length,
      unaccounted: animals.filter((a) => a.state === "unaccounted").length,
      returned: animals.filter((a) => a.returned).length,
    };

    return {
      animals,
      summary,
      shelter_name: "San Antonio ACS",
      generated_at: new Date().toISOString(),
    };
  });

// ============================================================
// Admin write — Phase 1 only. Gated by an ADMIN_FOLLOWUP_SECRET env var so only
// someone with the passphrase can post an update. Phase 2 replaces this with
// per-partner logins + moderation.
// ============================================================
const VALID_OUTCOMES: FollowupOutcome[] = [
  "pulled",
  "in_foster",
  "adopted",
  "reclaimed",
  "transferred",
  "passed",
  "returned",
  "unknown",
];

export const addFollowup = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => {
    const o = (input ?? {}) as {
      secret?: string;
      animal_id?: string;
      outcome?: string;
      partner_name?: string;
      note?: string;
      photo_url?: string;
      occurred_on?: string;
    };
    if (!o.animal_id || typeof o.animal_id !== "string") {
      throw new Error("animal_id required");
    }
    const outcome = (o.outcome ?? "").trim() as FollowupOutcome;
    if (!VALID_OUTCOMES.includes(outcome)) {
      throw new Error("Invalid outcome");
    }
    return {
      secret: typeof o.secret === "string" ? o.secret : "",
      animal_id: o.animal_id,
      outcome,
      partner_name: typeof o.partner_name === "string" ? o.partner_name.slice(0, 120) : null,
      note: typeof o.note === "string" ? o.note.slice(0, 800) : null,
      photo_url: typeof o.photo_url === "string" && o.photo_url.startsWith("http") ? o.photo_url.slice(0, 500) : null,
      occurred_on:
        typeof o.occurred_on === "string" && /^\d{4}-\d{2}-\d{2}$/.test(o.occurred_on)
          ? o.occurred_on
          : null,
    };
  })
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const expected = process.env.ADMIN_FOLLOWUP_SECRET;
    if (!expected) {
      throw new Error(
        "Follow-up posting isn't enabled yet — set ADMIN_FOLLOWUP_SECRET in the app's environment to turn it on.",
      );
    }
    if (data.secret !== expected) {
      throw new Error("Wrong passphrase — this update was not saved.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const insertRow: Record<string, unknown> = {
      animal_id: data.animal_id,
      outcome: data.outcome,
      partner_name: data.partner_name,
      note: data.note,
      photo_url: data.photo_url,
      created_by: "admin",
    };
    if (data.occurred_on) insertRow.occurred_on = data.occurred_on;

    const { error } = await supabaseAdmin.from("acs_followups").insert(insertRow);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
