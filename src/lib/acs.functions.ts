import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";

// ============================================================
// Shelter status model — plain-language, grouped for non-technical users.
//
// The scraper writes a machine `status_key` and (usually) a human
// `public_status` label. We prefer the stored `public_status` for display and
// fall back to this mapping by `status_key`. Sections are ordered most-urgent
// first; `euthanized` renders in its own memorial section at the bottom.
//
// `left` = the animal is no longer on the shelter's list (outcome unknown).
// Those rows are EXCLUDED from the app view entirely. Any status_key we don't
// recognize maps to `unknown` — a visible tripwire so a new shelter format
// never hides a dog.
//
// NOT EVERY SHELTER PUBLISHES THE SAME THINGS, and this table is where that
// stops being an abstraction. San Antonio prints a per-animal euthanasia date,
// so its tiers (`immediate`, `scheduled`, `highrisk`) are read off that date.
// Cleveland never publishes a date, an outcome, or a reason — so a key whose
// meaning depends on a deadline is simply false there, and the four Cleveland
// keys below (`pulled`, `unlisted`, `stray_hold`, `in_foster`) describe which
// of the city's two published lists an animal is on, and where the city says
// it sleeps. Nothing more.
//
// Each entry's `meaning` is shown to the public as a statement of fact about a
// real animal. Before reusing a key for a new shelter, read its `meaning` out
// loud and ask whether that shelter actually publishes what it claims. If it
// doesn't, add a key rather than borrowing one.
// ============================================================

export type AcsStatusKey =
  | "euthanasia"
  | "b6spt"
  | "office_crit"
  | "outside_crit"
  | "immediate"
  | "scheduled"
  | "highrisk"
  | "pulled"
  | "atrisk"
  | "unlisted"
  | "stray_hold"
  | "in_foster"
  | "at_acs"
  | "office"
  | "adopthold"
  | "adoption"
  | "foster"
  | "foster_care"
  | "watch"
  | "foster_family_pending"
  | "secured"
  | "euthanized"
  | "following_up"
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
  | "off_adoption_list"
  | "urgent"
  | "unlisted"
  | "stray_hold"
  | "in_foster"
  | "still_at_acs"
  | "office"
  | "acs_adoption_hold"
  | "rescue_hold"
  | "acs_foster_hold"
  | "foster_pending"
  | "secured"
  | "in_memoriam"
  | "following_up"
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
    label: "Critical · save today",
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
  // Cleveland. The shelter advertised this animal for adoption, then stopped,
  // and it is still in the shelter's custody at the kennel. Cleveland publishes
  // no euthanasia dates and no outcomes, so this transition is the strongest
  // warning the city gives. It is read by comparing two published lists: the
  // animal is absent from Adoptable Pets but present, as "Animal in Custody",
  // on the Found Pets list.
  pulled: {
    key: "pulled",
    section: "off_adoption_list",
    label: "Off the adoption list",
    meaning: "The shelter took them off its adoption list but still has them. No reason is published.",
    action: "Ask the shelter about them. Adopt, foster, or rescue.",
    rank: 4.6,
  },
  atrisk: {
    key: "atrisk",
    section: "urgent",
    label: "At risk",
    meaning: "Could be euthanized if the shelter fills.",
    action: "Adopt, foster, or share.",
    rank: 5,
  },
  // Cleveland. Past any stray hold, and never put on the adoption list. Not a
  // withdrawal - see `pulled` for that - the shelter simply has not listed
  // them, and publishes no reason either way. Reported by the city as "Animal
  // in Custody", like every other animal it holds.
  //
  // NOT NAMED `in_custody`: every animal on this board is in the shelter's
  // custody, the 117 on the adoption list included. A key by that name reads
  // like the umbrella and means a subset of 29.
  unlisted: {
    key: "unlisted",
    section: "unlisted",
    label: "New intake · not yet listed",
    meaning: "In the shelter's care but not on its adoption list. The shelter does not publish why.",
    action: "Ask the shelter about them. Adopt, foster, or rescue.",
    rank: 5.5,
  },
  // San Antonio, from the ACS listing ("I'm located at: ACS Campus ..."): off
  // the capacity list but still in a kennel at the shelter. Still in ACS's
  // care, so it counts under "All".
  at_acs: {
    key: "at_acs",
    section: "still_at_acs",
    label: "Still at ACS · off the at-risk list",
    meaning: "Off ACS's at-risk list, but ACS's listing still shows them at the shelter.",
    action: "Adopt, foster, or rescue: email ACS with their ID.",
    rank: 5.6,
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
  // Cleveland. Inside the legal window for an owner to reclaim a stray. The
  // hold end is DERIVED - Ohio Revised Code 955.16 gives three days - because
  // the city publishes an intake date but never a hold end. Say so when shown.
  stray_hold: {
    key: "stray_hold",
    section: "stray_hold",
    label: "New · stray hold",
    meaning: "Recently found. Their owner still has time to claim them.",
    action: "If they are yours, call the shelter. Otherwise watch for the hold to end.",
    rank: 9.5,
  },
  // Cleveland. Living in a foster home rather than the kennel, and not on the
  // adoption list. Distinct from `foster` above, which is San Antonio's formal
  // foster HOLD - a placement in progress. This is simply where the animal
  // sleeps, read from the city's own Location field.
  //
  // Only for animals NOT on the adoption list. A fostered animal that IS
  // listed stays under `atrisk`, because adoptable is the fact a reader can
  // act on; that it sleeps in a foster home is shown on the card instead.
  // Today that is 34 animals here, against 13 under this key.
  in_foster: {
    key: "in_foster",
    section: "in_foster",
    label: "In a foster home · unavailable",
    meaning: "In the shelter's care, living in a foster home rather than the kennel.",
    action: "Not on the adoption list. Ask the shelter about them.",
    rank: 9.75,
  },
  // San Antonio, from the animal's ACS PetSearch page after it leaves the
  // capacity list ("I'm located at: Foster Care"). Filed under the ACS Foster
  // Hold chip, but a different fact from `foster` above: `foster` is a hold
  // printed on the capacity list, this is where ACS's own listing says the
  // animal lives now. ACS still lists these animals for adoption, so they are
  // NOT Secured. See resolve_unknowns() in acs-pull/pull_acs.py.
  foster_care: {
    key: "foster_care",
    section: "acs_foster_hold",
    label: "ACS Foster Hold",
    meaning: "Living with an ACS foster family, per ACS's listing. Still available for adoption.",
    action: "Email ACS Foster (acsfoster@sanantonio.gov) to meet them or adopt.",
    rank: 9.1,
  },
  watch: {
    key: "watch",
    section: "foster_pending",
    label: "Foster Pending",
    meaning: "A family is coming, but it isn't confirmed yet.",
    action: "Keep watching in case plans change.",
    rank: 10,
  },
  // San Antonio, from the ACS listing: "Foster Family Pending - I may have a
  // foster home soon, but I'm still available for adoption."
  foster_family_pending: {
    key: "foster_family_pending",
    section: "foster_pending",
    label: "Foster Pending",
    meaning: "ACS's listing says a foster family may take them soon. Still available for adoption.",
    action: "Email ACS Adoptions (acsadoptions@sanantonio.gov) to adopt or ask.",
    rank: 10.1,
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
  following_up: {
    key: "following_up",
    section: "following_up",
    label: "Following up with ACS",
    meaning: "Off ACS's list, and ACS has removed their listing page. ACS doesn't publish what happened.",
    action: "Ask ACS with their ID if you know them.",
    rank: 12.5,
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
    k === "pulled" ||
    k === "atrisk" ||
    k === "unlisted" ||
    k === "stray_hold" ||
    k === "in_foster" ||
    k === "at_acs" ||
    k === "office" ||
    k === "adopthold" ||
    k === "adoption" ||
    k === "foster" ||
    k === "foster_care" ||
    k === "watch" ||
    k === "foster_family_pending" ||
    k === "secured" ||
    k === "euthanized" ||
    k === "following_up" ||
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


/**
 * The words to show for an animal's pill: the shelter's own first, the shared
 * table only as a fallback.
 *
 * Why the order matters. ACS_STATUS_MODEL is shared across every shelter, and
 * its `meaning` for `atrisk` reads "Could be euthanized if the shelter fills."
 * That is true in San Antonio, which publishes a capacity euthanasia date. It
 * is an assertion nobody has made in Cleveland, which publishes no dates and
 * no outcomes at all - there, the same key means "the city is advertising this
 * dog for adoption" and the shelter has written exactly that in status_guide.
 *
 * `meaning` is shown to the public as a statement of fact about a real animal,
 * so where a shelter has said what its own words mean, those win.
 */
export function pillFor(
  a: Pick<AcsAnimal, "public_status" | "status_key">,
  guide: Record<string, ShelterPill> | null | undefined,
): ShelterPill {
  const key = normalizeStatusKey(a.status_key);
  const own = guide?.[key];
  if (own?.label) return own;
  const stored = (a.public_status ?? "").trim();
  if (key === "left") {
    return { label: stored || "No longer listed", means: "No longer on the shelter's list." };
  }
  const meta = ACS_STATUS_MODEL[key];
  return { label: stored || meta.label, means: meta.meaning, action: meta.action };
}

/**
 * The urgent overlay, if a named source has flagged this animal.
 *
 * Deliberately separate from the pill. These animals are usually still ON the
 * adoption list, and swapping their pill for "Urgent" would drop them out of
 * the view people browse to adopt - the same error that nearly hid 34 dogs who
 * were in foster care AND adoptable. Render this beside the pill, never over
 * it, and always with `source`: it is a volunteer group's judgement, not the
 * shelter's, and a reader is entitled to weigh it as such.
 */
export function urgentFor(
  a: Pick<AcsAnimal, "urgent_flag" | "urgent_source" | "urgent_note">,
  guide?: Record<string, ShelterPill> | null,
): { label: string; source: string; note: string | null } | null {
  if (!a.urgent_flag) return null;
  const source = (a.urgent_source ?? "").trim() || "a rescue group";
  return {
    label: guide?.urgent?.label ?? `Urgent · flagged by ${source}`,
    source,
    note: a.urgent_note ?? guide?.urgent?.note ?? null,
  };
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
  /**
   * This one animal's situation, in a sentence. Where `public_status` is the
   * pill every animal in that state shares, this is what is true of THIS one:
   * "we emailed the shelter about this dog on Oct 12 and have not been told
   * anything." It is how one pill can cover several situations honestly.
   */
  status_text: string | null;
  story: string | null;
  pet_search_url: string | null;
  thumb: string | null;
  photos: string[] | null;
  list_url: string | null;
  list_date: string | null;
  last_listed_at: string | null;
  updated_at: string | null;
  // Cleveland and any other shelter that publishes custody rather than dates.
  intake_date: string | null;
  hold_until: string | null;
  custody_location: string | null;
  // Flagged urgent by a named outside source (Cleveland: CLE Pups). Rides
  // ALONGSIDE status_key - these animals are usually still on the adoption
  // list, and replacing their pill would hide them from anyone searching to
  // adopt. Always render the source with it; it is not the shelter's word.
  urgent_flag: boolean;
  urgent_source: string | null;
  urgent_note: string | null;
};

export type AcsCounts = Partial<Record<Exclude<AcsStatusKey, "left">, number>>;

/** One pill, in the shelter's own words. See `shelters.status_guide`. */
export type ShelterPill = {
  label: string;
  means: string;
  note?: string;
  action?: string;
  /**
   * Show this state's animals UNDER another state's chip, naming that state's
   * status_key. The animals keep their own status_key, their own section, their
   * own heading and their own explanation — they just stop having a chip of
   * their own.
   *
   * Cleveland: `pulled` sets this to `unknown`. A dog off the adoption list and
   * a dog gone from every list are different facts and the headings still say
   * so, but a reader looking for "we don't know" should find both in one place.
   */
  merge_into?: string | null;
  /**
   * Heading above this state's group of cards, when it should differ from the
   * pill. Needed wherever `merge_into` is set: several states then share one
   * pill name, and the heading is the only place left to say them apart.
   */
  section_title?: string | null;
  /**
   * Optional shorter label for the filter chip row only. Card badges and
   * section headers always use `label`. Cleveland's full wording
   * ("Off the adoption list - still at the shelter") is correct on a card and
   * long in a chip; set `short` in shelters.status_guide to shorten the chip
   * without touching what a reader sees on the animal.
   */
  short?: string | null;
};

/**
 * One of the three headline numbers on a shelter's board, from
 * `shelters.stat_tiles`. A tile's value is the sum of `counts` across every
 * status_key it lists.
 *
 * NULL in the database means "use the built-in San Antonio tiles". That is
 * every shelter but Cleveland today, so their boards are unaffected.
 */
export type ShelterStatTile = { label: string; keys: string[] };

export type AcsListResult = {
  animals: AcsAnimal[];
  total: number;
  counts: AcsCounts;
  shelter_name: string;
  last_pulled_at: string | null;
  last_checked_at: string | null;
  /**
   * Per-shelter wording for each status_key, from shelters.status_guide.
   *
   * ACS_STATUS_MODEL below is the fallback, and it is a SHARED table - its
   * `meaning` for `atrisk` talks about a euthanasia date, which is true in San
   * Antonio and false in Cleveland. Where a shelter has written its own words,
   * those are the honest ones and they win. Render from this first.
   */
  status_guide: Record<string, ShelterPill>;
  /** The shelter's own description of itself and of what it does not publish. */
  about_text: string | null;
  risk_label: string | null;
  risk_blurb: string | null;
  risk_note: string | null;
  /**
   * The shelter's own three headline tiles, or null to use the defaults.
   * San Antonio's defaults (CRITICAL / DATE SET / IN MEMORIAM) count statuses
   * Cleveland does not publish, so they read 0 there and always would.
   */
  stat_tiles: ShelterStatTile[] | null;
};

// A shelter the board can switch between.
export type AcsShelter = {
  shelter_id: string;
  name: string;
  short_name: string | null;
  city: string | null;
  state: string | null;
  status: string | null;
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
  "status_text",
  "story",
  "pet_search_url",
  "thumb",
  "photos",
  "list_url",
  "list_date",
  "last_listed_at",
  "updated_at",
  "intake_date",
  "hold_until",
  "custody_location",
  "urgent_flag",
  "urgent_source",
  "urgent_note",
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

// The app historically passed "san_antonio_acs"; the shelters table slug is
// "acs_san_antonio". Accept either and normalize to the real slug.
function resolveShelterSlug(shelterId: string | undefined): string {
  const s = (shelterId ?? "").trim();
  if (!s || s === "san_antonio_acs" || s === "acs_san_antonio") return "acs_san_antonio";
  return s;
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

// Shelters the board can switch between (live + preview). Powers the switcher.
export const listShelters = createServerFn({ method: "GET" })
  .handler(async (): Promise<AcsShelter[]> => {
    const sb = serverClient();
    const { data, error } = await sb
      .from("shelters")
      .select("shelter_id, name, short_name, city, state, status")
      .neq("status", "archived")
      .order("status", { ascending: true })
      .order("name", { ascending: true });
    if (error) return [];
    return (data ?? []).map((r) => {
      const row = r as Record<string, unknown>;
      return {
        shelter_id: String(row.shelter_id),
        name: String(row.name),
        short_name: (row.short_name as string | null) ?? null,
        city: (row.city as string | null) ?? null,
        state: (row.state as string | null) ?? null,
        status: (row.status as string | null) ?? null,
      };
    });
  });

export const listAcsAnimals = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => {
    // `shelterId` selects which shelter's at-risk list to load. Defaults to
    // San Antonio for backward compatibility with existing call sites.
    const o = (input ?? {}) as { shelterId?: string; limit?: number };
    return {
      shelterId: o.shelterId || "acs_san_antonio",
      limit: typeof o.limit === "number" ? o.limit : undefined,
    };
  })
  .handler(async ({ data }): Promise<AcsListResult> => {
    const sb = serverClient();
    const slug = resolveShelterSlug(data.shelterId);

    const { data: rows, error } = await sb
      .from("acs_animals")
      .select(SELECT_COLUMNS)
      .eq("shelter_id", slug);

    if (error) throw new Error(error.message);

    // Shelter display name + the shelter's own wording (falls back gracefully).
    let shelter_name = "San Antonio ACS";
    let status_guide: Record<string, ShelterPill> = {};
    let about_text: string | null = null;
    let risk_label: string | null = null;
    let risk_blurb: string | null = null;
    let risk_note: string | null = null;
    let stat_tiles: ShelterStatTile[] | null = null;
    try {
      const { data: sh } = await sb
        .from("shelters")
        .select("name, short_name, status_guide, about_text, risk_label, risk_blurb, risk_note, stat_tiles")
        .eq("shelter_id", slug)
        .limit(1);
      if (Array.isArray(sh) && sh[0]) {
        const s = sh[0] as {
          name?: string; short_name?: string | null;
          status_guide?: Record<string, ShelterPill> | null;
          about_text?: string | null; risk_label?: string | null;
          risk_blurb?: string | null; risk_note?: string | null;
          stat_tiles?: ShelterStatTile[] | null;
        };
        shelter_name = (s.short_name && s.short_name.trim()) || s.name || shelter_name;
        status_guide = s.status_guide ?? {};
        about_text = s.about_text ?? null;
        risk_label = s.risk_label ?? null;
        risk_blurb = s.risk_blurb ?? null;
        risk_note = s.risk_note ?? null;
        stat_tiles =
          Array.isArray(s.stat_tiles) && s.stat_tiles.length > 0
            ? s.stat_tiles
            : null;
      }
    } catch {
      // Name is best-effort.
    }

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
        status_text: (row.status_text as string | null) ?? null,
        story: (row.story as string | null) ?? null,
        pet_search_url: (row.pet_search_url as string | null) ?? null,
        thumb: (row.thumb as string | null) ?? null,
        photos: normalizePhotos(row.photos),
        list_url: (row.list_url as string | null) ?? null,
        list_date: (row.list_date as string | null) ?? null,
        last_listed_at: (row.last_listed_at as string | null) ?? null,
        updated_at: (row.updated_at as string | null) ?? null,
        intake_date: (row.intake_date as string | null) ?? null,
        hold_until: (row.hold_until as string | null) ?? null,
        custody_location: (row.custody_location as string | null) ?? null,
        urgent_flag: row.urgent_flag === true,
        urgent_source: (row.urgent_source as string | null) ?? null,
        urgent_note: (row.urgent_note as string | null) ?? null,
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
    //
    // Same for the states read off an animal's ACS listing after it leaves the
    // capacity list (in foster care, foster pending, still at the campus).
    // Their list_date is by definition older than today's, and they are the
    // answer to an Unknown, so they must stay reachable under their chips.
    const KEEP_WHEN_OFF_LIST: ReadonlySet<string> = new Set([
      "unknown",
      "foster_care",
      "foster_family_pending",
      "at_acs",
    ]);
    const newestListDate = visibleAll.reduce<string | null>((acc, a) => {
      if (!a.list_date) return acc;
      return !acc || a.list_date > acc ? a.list_date : acc;
    }, null);
    const visible = newestListDate
      ? visibleAll.filter(
          (a) =>
            a.list_date === newestListDate ||
            KEEP_WHEN_OFF_LIST.has(normalizeStatusKey(a.status_key)),
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
      shelter_name,
      last_pulled_at: last,
      last_checked_at,
      status_guide,
      about_text,
      risk_label,
      risk_blurb,
      risk_note,
      stat_tiles,
    };
  });

// Follow a single animal — records the follower (email + cadence) via the
// follow_animal RPC (granted to anon). The notify-follows worker emails them
// when this animal's status_key changes. cadence: "instant" | "daily".
export const followAnimal = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => {
    const o = (input ?? {}) as { animalId?: string; email?: string; name?: string; cadence?: string; channels?: string[] };
    return {
      animalId: String(o.animalId ?? "").trim(),
      email: String(o.email ?? "").trim(),
      name: o.name ? String(o.name).trim() : null,
      cadence: o.cadence === "daily" ? "daily" : "instant",
      channels: Array.isArray(o.channels) ? o.channels.map(String) : null,
    };
  })
  .handler(async ({ data }): Promise<{ ok: boolean; error?: string; cadence?: string }> => {
    if (!data.animalId || !data.email) return { ok: false, error: "Missing animal or email." };
    const sb = serverClient();
    const { data: res, error } = await sb.rpc("follow_animal", {
      p_animal_id: data.animalId,
      p_email: data.email,
      p_name: data.name,
      p_cadence: data.cadence,
      p_channels: data.channels,
    });
    if (error) return { ok: false, error: error.message };
    return (res ?? { ok: true }) as { ok: boolean; error?: string; cadence?: string };
  });

// Store a browser push subscription for an email (called after the user grants
// notification permission in the Follow popup). Routes through save_push_subscription.
export const savePushSubscription = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => {
    const o = (input ?? {}) as { email?: string; endpoint?: string; p256dh?: string; auth?: string; ua?: string };
    return {
      email: String(o.email ?? "").trim(),
      endpoint: String(o.endpoint ?? ""),
      p256dh: String(o.p256dh ?? ""),
      auth: String(o.auth ?? ""),
      ua: o.ua ? String(o.ua) : null,
    };
  })
  .handler(async ({ data }): Promise<{ ok: boolean; error?: string }> => {
    if (!data.email || !data.endpoint) return { ok: false, error: "Missing subscription." };
    const sb = serverClient();
    const { data: res, error } = await sb.rpc("save_push_subscription", {
      p_email: data.email, p_endpoint: data.endpoint, p_p256dh: data.p256dh, p_auth: data.auth, p_ua: data.ua,
    });
    if (error) return { ok: false, error: error.message };
    return (res ?? { ok: true }) as { ok: boolean; error?: string };
  });
