import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";

// ============================================================
// ACS status model — plain-language, grouped for non-technical users.
//
// The scraper writes a machine `status_key` and (usually) a human
// `public_status` label. We prefer the stored `public_status` for display and
// fall back to this mapping by `status_key`. Sections are ordered most-urgent
// first; `euthanized` renders in its own memorial section at the bottom.
//
// `left` = the animal is no longer on ACS's list (outcome unknown). Those rows
// are EXCLUDED from the app view entirely. Any status_key we don't recognize
// maps to `unknown` — a visible tripwire so a new ACS format never hides a dog.
// ============================================================

export type AcsStatusKey =
  | "euthanasia"
  | "b6spt"
  | "office_crit"
  | "outside_crit"
  | "immediate"
  | "scheduled"
  | "highrisk"
  | "atrisk"
  | "office"
  | "adopthold"
  | "adoption"
  | "foster"
  | "watch"
  | "secured"
  | "euthanized"
  | "unknown"
  | "left";

export type AcsSectionId =
  | "euthanasia_now"
  | "critical_now"
  | "critical_office"
  | "critical_outside"
  | "critical_today"
  | "on_the_clock"
  | "high_risk"
  | "urgent"
  | "office"
  | "acs_adoption_hold"
  | "rescue_hold"
  | "acs_foster_hold"
  | "foster_pending"
  | "secured"
  | "in_memoriam"
  | "unknown";

export type AcsStatusMeta = {
  key: Exclude<AcsStatusKey, "left">;
  /** Section this status rolls up into. */
  section: AcsSectionId;
  /** Friendly badge label (used when the row has no stored public_status). */
  label: string;
  /** Plain-language meaning of this status. */
  meaning: string;
  /** What a reader can do about it. */
  action: string;
  /** Urgency rank — lower is more urgent; used for ordering. */
  rank: number;
};

// Ordered most-urgent first.
export const ACS_STATUS_MODEL: Record<Exclude<AcsStatusKey, "left">, AcsStatusMeta> = {
  euthanasia: {
    key: "euthanasia",
    section: "euthanasia_now",
    label: "Euthanasia in progress",
    meaning: "In the euthanasia room right now.",
    action: "Email or call ACS immediately.",
    rank: 0,
  },
  b6spt: {
    key: "b6spt",
    section: "critical_now",
    label: "Critical · save now",
    meaning: "Moved to a euthanasia-prep kennel (B6-SPT).",
    action: "Email or call ACS immediately to foster or rescue.",
    rank: 1,
  },
  office_crit: {
    key: "office_crit",
    section: "critical_office",
    label: "Critical · Office",
    meaning: "In an office kennel and marked for euthanasia today.",
    action: "Email or call ACS immediately.",
    rank: 2,
  },
  outside_crit: {
    key: "outside_crit",
    section: "critical_outside",
    label: "Critical (OUTSIDE3) · save now",
    meaning: "In an outdoor kennel (OUTSIDE3) and marked for euthanasia.",
    action: "Email or call ACS immediately to foster or rescue.",
    rank: 2.5,
  },
  immediate: {
    key: "immediate",
    section: "critical_today",
    label: "Critical · euthanasia date set · save today",
    meaning: "On today's euthanasia list.",
    action: "Email ACS before the deadline to foster or rescue.",
    rank: 3,
  },
  scheduled: {
    key: "scheduled",
    section: "on_the_clock",
    label: "Euthanasia date set",
    meaning: "A euthanasia date is set (not today).",
    action: "Foster, rescue, or adopt before the date.",
    rank: 4,
  },
  highrisk: {
    key: "highrisk",
    section: "high_risk",
    label: "High risk",
    meaning: "The capacity euthanasia date has passed — eligible for euthanasia now.",
    action: "Foster, rescue, or adopt as soon as possible.",
    rank: 4.5,
  },
  atrisk: {
    key: "atrisk",
    section: "urgent",
    label: "At risk",
    meaning: "Could be euthanized if the shelter fills.",
    action: "Adopt, foster, or share.",
    rank: 5,
  },
  office: {
    key: "office",
    section: "office",
    label: "Office",
    meaning: "In an office kennel — not marked for euthanasia right now.",
    action: "Keep an eye on them; adopt, foster, or share.",
    rank: 6,
  },
  adopthold: {
    key: "adopthold",
    section: "acs_adoption_hold",
    label: "ACS Adoption Hold",
    meaning: "Someone is adopting them.",
    action: "Share as backup in case the adoption falls through.",
    rank: 7,
  },
  adoption: {
    key: "adoption",
    section: "rescue_hold",
    label: "ACS Rescue Hold",
    meaning: "A rescue partner has placed a hold to pull them.",
    action: "Share as backup in case the hold falls through.",
    rank: 8,
  },
  foster: {
    key: "foster",
    section: "acs_foster_hold",
    label: "ACS Foster Hold",
    meaning: "An ACS foster hold is in place.",
    action: "Share as backup in case the hold falls through.",
    rank: 9,
  },
  watch: {
    key: "watch",
    section: "foster_pending",
    label: "Foster Pending",
    meaning: "A family is coming, but it isn't confirmed yet.",
    action: "Keep watching in case plans change.",
    rank: 10,
  },
  secured: {
    key: "secured",
    section: "secured",
    label: "Secured",
    meaning: "Placement confirmed — they're safe.",
    action: "Celebrate and share the good news.",
    rank: 11,
  },
  euthanized: {
    key: "euthanized",
    section: "in_memoriam",
    label: "In Memoriam",
    meaning: "Confirmed euthanized. Remembered here.",
    action: "Share their story so it doesn't happen again.",
    rank: 12,
  },
  unknown: {
    key: "unknown",
    section: "unknown",
    label: "Unknown",
    meaning: "A status Voyce didn't recognize — check the ACS record.",
    action: "Open the ACS record to see the exact status.",
    rank: 13,
  },
};

/**
 * Resolve a raw status_key to a known key. Anything unrecognized becomes
 * `unknown` (a visible tripwire), NOT silently folded into another tier.
 */
export function normalizeStatusKey(raw: string | null | undefined): AcsStatusKey {
  const k = (raw ?? "").trim().toLowerCase();
  if (
    k === "euthanasia" ||
    k === "b6spt" ||
    k === "office_crit" ||
    k === "outside_crit" ||
    k === "immediate" ||
    k === "scheduled" ||
    k === "highrisk" ||
    k === "atrisk" ||
    k === "office" ||
    k === "adopthold" ||
    k === "adoption" ||
    k === "foster" ||
    k === "watch" ||
    k === "secured" ||
    k === "euthanized" ||
    k === "left"
  ) {
    return k;
  }
  return "unknown";
}

/** Urgency rank for ordering. `left` is not shown, so it sorts last. */
export function statusRank(key: AcsStatusKey): number {
  if (key === "left") return 99;
  return ACS_STATUS_MODEL[key].rank;
}

/** Best display label — stored public_status wins, else the mapping. */
export function statusLabel(a: Pick<AcsAnimal, "public_status" | "status_key">): string {
  const stored = (a.public_status ?? "").trim();
  if (stored) return stored;
  const key = normalizeStatusKey(a.status_key);
  if (key === "left") return "No longer listed";
  return ACS_STATUS_MODEL[key].label;
}

// ============================================================
// Row + result types — mirror the real acs_animals table.
// ============================================================

export type AcsAnimal = {
  id: string;
  name: string;
  breed: string | null;
  color: string | null;
  age: string | null;
  age_raw: string | null;
  sex: string | null;
  weight: number | null;
  kennel: string | null;
  days: number | null;
  risk_since: string | null;
  euth_date: string | null;
  due_out: string | null;
  status: string | null;
  status_key: string | null;
  public_status: string | null;
  story: string | null;
  pet_search_url: string | null;
  thumb: string | null;
  photos: string[] | null;
  list_url: string | null;
  list_date: string | null;
  last_listed_at: string | null;
  updated_at: string | null;
};

export type AcsCounts = Partial<Record<Exclude<AcsStatusKey, "left">, number>>;

export type AcsListResult = {
  animals: AcsAnimal[];
  total: number;
  counts: AcsCounts;
  shelter_name: string;
  last_pulled_at: string | null;
  last_checked_at: string | null;
};

const SELECT_COLUMNS = [
  "id",
  "name",
  "breed",
  "color",
  "age",
  "age_raw",
  "sex",
  "weight",
  "kennel",
  "days",
  "risk_since",
  "euth_date",
  "due_out",
  "status",
  "status_key",
  "public_status",
  "story",
  "pet_search_url",
  "thumb",
  "photos",
  "list_url",
  "list_date",
  "last_listed_at",
  "updated_at",
].join(", ");

// The Supabase project URL + publishable (anon) key are NOT secret — the
// landing page ships them in plain HTML. Fall back to them so the reader works
// even when the host hasn't set SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY env
// vars (which caused a "supabaseUrl is required" crash in the deployed app).
const FALLBACK_SUPABASE_URL = "https://okmukfrhvqkxphzueqww.supabase.co";
const FALLBACK_SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_e_OWsyXVeFqgV6EVGAKKTw_sgEV2cTN";

function serverClient() {
  const url = process.env.SUPABASE_URL || FALLBACK_SUPABASE_URL;
  const key =
    process.env.SUPABASE_PUBLISHABLE_KEY || FALLBACK_SUPABASE_PUBLISHABLE_KEY;
  return createClient(url, key, {
    auth: {
      storage: undefined,
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

// `photos` is a jsonb column — normalize whatever shape comes back into a
// clean string[] so the UI never has to guess.
function normalizePhotos(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.filter((p): p is string => typeof p === "string" && p.trim().length > 0);
  }
  if (typeof raw === "string" && raw.trim().length > 0) {
    return [raw.trim()];
  }
  return [];
}

export const listAcsAnimals = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => {
    // `shelterId` is kept for call-site compatibility but no longer filters —
    // the acs_animals table is single-shelter (San Antonio ACS) today.
    const o = (input ?? {}) as { shelterId?: string; limit?: number };
    return {
      shelterId: o.shelterId || "san_antonio_acs",
      limit: typeof o.limit === "number" ? o.limit : undefined,
    };
  })
  .handler(async ({ data }): Promise<AcsListResult> => {
    const sb = serverClient();

    const { data: rows, error } = await sb
      .from("acs_animals")
      .select(SELECT_COLUMNS);

    if (error) throw new Error(error.message);

    // The most recent scraper run stamps acs_pull_debug every run (even when
    // nothing changed), so it is the honest "last checked" heartbeat — distinct
    // from `last_pulled_at` (max updated_at), which only moves when data changes.
    let last_checked_at: string | null = null;
    try {
      const { data: dbg } = await sb
        .from("acs_pull_debug")
        .select("created_at")
        .order("created_at", { ascending: false })
        .limit(1);
      if (Array.isArray(dbg) && dbg[0] && typeof dbg[0].created_at === "string") {
        last_checked_at = dbg[0].created_at;
      }
    } catch {
      // Heartbeat is best-effort — never fail the list over it.
    }

    const all: AcsAnimal[] = (rows ?? []).map((r) => {
      const row = r as Record<string, unknown>;
      return {
        id: String(row.id),
        name: (row.name as string | null) ?? "Unnamed",
        breed: (row.breed as string | null) ?? null,
        color: (row.color as string | null) ?? null,
        age: (row.age as string | null) ?? null,
        age_raw: (row.age_raw as string | null) ?? null,
        sex: (row.sex as string | null) ?? null,
        weight: (row.weight as number | null) ?? null,
        kennel: (row.kennel as string | null) ?? null,
        days: (row.days as number | null) ?? null,
        risk_since: (row.risk_since as string | null) ?? null,
        euth_date: (row.euth_date as string | null) ?? null,
        due_out: (row.due_out as string | null) ?? null,
        status: (row.status as string | null) ?? null,
        status_key: (row.status_key as string | null) ?? null,
        public_status: (row.public_status as string | null) ?? null,
        story: (row.story as string | null) ?? null,
        pet_search_url: (row.pet_search_url as string | null) ?? null,
        thumb: (row.thumb as string | null) ?? null,
        photos: normalizePhotos(row.photos),
        list_url: (row.list_url as string | null) ?? null,
        list_date: (row.list_date as string | null) ?? null,
        last_listed_at: (row.last_listed_at as string | null) ?? null,
        updated_at: (row.updated_at as string | null) ?? null,
      };
    });

    // Exclude `left` rows (manually confirmed no-longer-listed / positive exit).
    const visibleAll = all.filter((a) => normalizeStatusKey(a.status_key) !== "left");

    // Supabase accumulates every day's animals (old rows are never deleted), so
    // counting all of them inflates totals and grows a stale In Memoriam list.
    // Match the public board: keep only the NEWEST list date — the current
    // at-risk list, including today's outcomes (e.g. today's euthanized). Older
    // rows stay in the database but are not shown or counted here.
    //
    // EXCEPTION: `unknown` rows are a persistent follow-up tripwire — a dog that
    // vanished from ACS without a written outcome. Those must stay visible
    // regardless of when they were last listed, so they can be chased down
    // (email ACS) and resolved, instead of silently disappearing from the board.
    const newestListDate = visibleAll.reduce<string | null>((acc, a) => {
      if (!a.list_date) return acc;
      return !acc || a.list_date > acc ? a.list_date : acc;
    }, null);
    const visible = newestListDate
      ? visibleAll.filter(
          (a) =>
            a.list_date === newestListDate ||
            normalizeStatusKey(a.status_key) === "unknown",
        )
      : visibleAll;

    // Order by urgency rank, then days at shelter descending.
    visible.sort((x, y) => {
      const rx = statusRank(normalizeStatusKey(x.status_key));
      const ry = statusRank(normalizeStatusKey(y.status_key));
      if (rx !== ry) return rx - ry;
      return (y.days ?? 0) - (x.days ?? 0);
    });

    // Count per status_key (visible rows only).
    const counts: AcsCounts = {};
    for (const a of visible) {
      const key = normalizeStatusKey(a.status_key);
      if (key === "left") continue;
      counts[key] = (counts[key] ?? 0) + 1;
    }

    // Newest updated_at across ALL rows = last time the scraper CHANGED data.
    const last = all.reduce<string | null>((acc, a) => {
      if (!a.updated_at) return acc;
      if (!acc || a.updated_at > acc) return a.updated_at;
      return acc;
    }, null);

    const animals =
      typeof data.limit === "number" ? visible.slice(0, data.limit) : visible;

    return {
      animals,
      total: visible.length,
      counts,
      shelter_name: "San Antonio ACS",
      last_pulled_at: last,
      last_checked_at,
    };
  });
