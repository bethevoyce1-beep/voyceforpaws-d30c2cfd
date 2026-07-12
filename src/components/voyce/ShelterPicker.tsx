import { useEffect, useMemo, useState } from "react";
import {
  listAcsAnimals,
  ACS_STATUS_MODEL,
  normalizeStatusKey,
  statusLabel,
  type AcsAnimal,
  type AcsListResult,
  type AcsSectionId,
  type AcsStatusMeta,
} from "@/lib/acs.functions";
import {
  deadlineForAnimal,
  useEuthCountdown,
  urgencyFor,
  formatCountdown,
} from "@/lib/acs.timer";
import { BrandHeader } from "@/components/voyce/BrandHeader";

const GOLD = "#FFDF3B";
const GOLD_DEEP = "#C9871A";
const PAPER = "#FAF7F1";
const INK = "#1A1611";

type Props = {
  onPick: (animal: AcsAnimal) => void;
  onBack: () => void;
  onTakePhoto: () => void;
};

// ============================================================
// Section presentation — ordered most-urgent first. Each section carries a
// plain-language header, the action a reader can take, and a badge style.
// ============================================================
type SectionDef = {
  id: AcsSectionId;
  title: string;
  action: string;
  badgeBg: string;
  badgeText: string;
  accent: string; // left border / header tint
};

const SECTIONS: SectionDef[] = [
  {
    id: "critical_now",
    title: "Critical · final minutes",
    action: "In the euthanasia room now — email or call ACS immediately.",
    badgeBg: "#7F1D1D",
    badgeText: "#FFFFFF",
    accent: "#7F1D1D",
  },
  {
    id: "critical_today",
    title: "Critical · today",
    action: "On today's euthanasia list — email ACS before the deadline to foster or rescue.",
    badgeBg: "#FECACA",
    badgeText: "#7F1D1D",
    accent: "#DC2626",
  },
  {
    id: "on_the_clock",
    title: "On the clock",
    action: "A euthanasia date is set — foster, rescue, or adopt before the date.",
    badgeBg: "#FED7AA",
    badgeText: "#9A3412",
    accent: "#F97316",
  },
  {
    id: "urgent",
    title: "Urgent",
    action: "Could be euthanized if the shelter fills — adopt, foster, or share.",
    badgeBg: "#FDE68A",
    badgeText: "#78350F",
    accent: "#F59E0B",
  },
  {
    id: "acs_adoption_hold",
    title: "ACS Adoption Hold",
    action: "Someone is adopting them — share as backup in case it falls through.",
    badgeBg: "#FBCFE8",
    badgeText: "#9D174D",
    accent: "#DB2777",
  },
  {
    id: "rescue_hold",
    title: "ACS Rescue Hold",
    action: "A rescue partner placed a hold to pull them — share as backup.",
    badgeBg: "#BAE6FD",
    badgeText: "#075985",
    accent: "#0EA5E9",
  },
  {
    id: "acs_foster_hold",
    title: "ACS Foster Hold",
    action: "An ACS foster hold is in place — share as backup.",
    badgeBg: "#C7F9E5",
    badgeText: "#065F46",
    accent: "#10B981",
  },
  {
    id: "foster_pending",
    title: "Foster Pending",
    action: "A family is coming, but it isn't confirmed yet — keep watching in case plans change.",
    badgeBg: "#DBEAFE",
    badgeText: "#1E40AF",
    accent: "#3B82F6",
  },
  {
    id: "secured",
    title: "Secured",
    action: "Placement confirmed — they're safe. Celebrate and share.",
    badgeBg: "#D1FAE5",
    badgeText: "#065F46",
    accent: "#22C55E",
  },
  {
    id: "in_memoriam",
    title: "In Memoriam",
    action: "Confirmed euthanized. Remembered here.",
    badgeBg: "#E5E7EB",
    badgeText: "#374151",
    accent: "#9CA3AF",
  },
];

const SECTION_BY_ID = SECTIONS.reduce<Record<AcsSectionId, SectionDef>>(
  (acc, s) => {
    acc[s.id] = s;
    return acc;
  },
  {} as Record<AcsSectionId, SectionDef>,
);

// Filter chips. `all` shows everything; each other chip maps to one or more
// sections. Critical folds the two most-urgent tiers into one scannable chip;
// Foster covers both the ACS Foster Hold and Foster Pending tiers.
type ChipDef = { id: string; label: string; sections: AcsSectionId[] | "all" };
const CHIPS: ChipDef[] = [
  { id: "all", label: "All", sections: "all" },
  { id: "critical", label: "Critical", sections: ["critical_now", "critical_today"] },
  { id: "ontheclock", label: "On the clock", sections: ["on_the_clock"] },
  { id: "urgent", label: "Urgent", sections: ["urgent"] },
  { id: "adoption", label: "Adoption Hold", sections: ["acs_adoption_hold"] },
  { id: "rescue", label: "Rescue Hold", sections: ["rescue_hold"] },
  { id: "foster", label: "Foster", sections: ["acs_foster_hold", "foster_pending"] },
  { id: "secured", label: "Secured", sections: ["secured"] },
  { id: "memoriam", label: "In Memoriam", sections: ["in_memoriam"] },
];

// `left` rows are filtered out server-side and never reach the UI, but the type
// includes it — fall back to the `atrisk` meta so lookups stay type-safe.
function metaOf(a: AcsAnimal): AcsStatusMeta {
  const key = normalizeStatusKey(a.status_key);
  return key === "left" ? ACS_STATUS_MODEL.atrisk : ACS_STATUS_MODEL[key];
}

function sectionOf(a: AcsAnimal): AcsSectionId {
  return metaOf(a).section;
}

// Which rows get the live euthanasia timer/urgency badge.
function showsTimer(a: AcsAnimal): boolean {
  const key = normalizeStatusKey(a.status_key);
  return key === "b6spt" || key === "immediate" || key === "scheduled";
}

function firstPhoto(a: AcsAnimal): string | null {
  if (a.thumb && a.thumb.trim()) return a.thumb.trim();
  if (a.photos && a.photos.length > 0) return a.photos[0];
  return null;
}

function specLine(a: AcsAnimal): string {
  return [a.breed, a.age, a.sex, a.color].filter(Boolean).join(" · ");
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

// Graceful photo placeholder — a paw glyph on a soft gold tile. Never breaks
// layout when thumb/photos are empty (the common case right now).
function PhotoThumb({ a }: { a: AcsAnimal }) {
  const src = firstPhoto(a);
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div
        className="grid h-[60px] w-[60px] flex-none place-items-center rounded-lg text-[22px]"
        style={{ background: "linear-gradient(135deg, #FFF3C4 0%, #F5E3A0 100%)", color: GOLD_DEEP }}
        aria-hidden
      >
        🐾
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={a.name}
      width={60}
      height={60}
      loading="lazy"
      onError={() => setFailed(true)}
      className="h-[60px] w-[60px] flex-none rounded-lg object-cover"
    />
  );
}

// Small live euthanasia badge for a list row — an escalating urgency chip with
// a ticking countdown, layered on top of the category pill. b6spt shows the
// "in progress" state (no numeric timer); immediate/scheduled tick down.
function RowTimerBadge({ a }: { a: AcsAnimal }) {
  const inRoom = normalizeStatusKey(a.status_key) === "b6spt";
  const target = useMemo(() => (inRoom ? null : deadlineForAnimal(a)), [a, inRoom]);
  const { msLeft, hasTarget } = useEuthCountdown(target);

  const chip = inRoom
    ? { label: "In progress — act now", bg: "#7F1D1D", text: "#FFFFFF", pulse: true }
    : urgencyFor(msLeft);
  const countdown = !inRoom && hasTarget ? formatCountdown(msLeft) : null;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9.5px] font-bold leading-tight ${
        chip.pulse ? "motion-safe:animate-pulse" : ""
      }`}
      style={{ background: chip.bg, color: chip.text }}
      role="status"
      aria-live="polite"
    >
      <span>{chip.label}</span>
      {countdown && <span className="tabular-nums">⏳ {countdown}</span>}
    </span>
  );
}

function AnimalRow({ a, onPick }: { a: AcsAnimal; onPick: (a: AcsAnimal) => void }) {
  const [showNote, setShowNote] = useState(false);
  const meta = metaOf(a);
  const section = SECTION_BY_ID[meta.section];
  const badge = statusLabel(a);
  const spec = specLine(a);
  const note = (a.story ?? "").trim();
  const euth = (a.euth_date ?? "").trim();
  const hasContext = !!note || !!euth;
  const hasTimer = showsTimer(a);

  return (
    <div
      className="rounded-xl border border-border bg-white shadow-sm"
      style={{ borderLeft: `4px solid ${section.accent}` }}
    >
      <button
        onClick={() => onPick(a)}
        className="group flex w-full items-center gap-3 rounded-xl p-2.5 text-left transition hover:-translate-y-px hover:shadow-md active:scale-[0.99]"
      >
        <PhotoThumb a={a} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-1.5">
            <span className="font-serif text-[15px] font-semibold leading-tight" style={{ color: INK }}>
              {a.name}
            </span>
            {a.kennel && (
              <span className="text-[10.5px] text-muted-foreground">· kennel {a.kennel}</span>
            )}
          </div>
          {spec && <div className="truncate text-[12px] text-muted-foreground">{spec}</div>}
          {typeof a.days === "number" && (
            <div className="mt-0.5 text-[11px]" style={{ color: GOLD_DEEP }}>
              {a.days} days at shelter
            </div>
          )}
          {hasTimer && (
            <div className="mt-1">
              <RowTimerBadge a={a} />
            </div>
          )}
        </div>
        <span
          className="flex-none rounded-full px-2.5 py-1 text-center text-[10px] font-bold leading-tight tracking-wide"
          style={{ background: section.badgeBg, color: section.badgeText }}
        >
          {badge}
        </span>
      </button>

      <div className="flex flex-wrap items-center gap-2 border-t border-border/60 px-2.5 py-2">
        {a.pet_search_url && (
          <a
            href={a.pet_search_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="rounded-full border border-[#D9D2C2] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#1A1611] transition active:scale-95"
          >
            🔗 View on ACS
          </a>
        )}
        {hasContext && (
          <button
            onClick={() => setShowNote((v) => !v)}
            className="rounded-full border border-[#D9D2C2] bg-white px-2.5 py-1 text-[11px] font-semibold text-muted-foreground transition active:scale-95"
            aria-expanded={showNote}
          >
            {showNote ? "Hide ACS note" : "See ACS's exact note"}
          </button>
        )}
        <span className="ml-auto text-[10.5px] italic text-muted-foreground">
          {meta.meaning}
        </span>
      </div>

      {showNote && hasContext && (
        <div className="mx-2.5 mb-2.5 rounded-lg bg-[#FFFBEB] px-3 py-2 text-[12px] leading-snug text-[#3A2A07] ring-1 ring-[#F3E5B6]">
          {euth && (
            <p className="font-semibold">
              ACS euth date: <span className="font-normal">{euth}</span>
            </p>
          )}
          {note && <p className={euth ? "mt-1" : ""}>{note}</p>}
        </div>
      )}
    </div>
  );
}

export function ShelterPicker({ onPick, onBack, onTakePhoto }: Props) {
  const [state, setState] = useState<{ loading: boolean; error: string | null; data: AcsListResult | null }>(
    { loading: true, error: null, data: null },
  );
  const [chip, setChip] = useState<string>("all");

  useEffect(() => {
    let alive = true;
    // No limit — the reader returns all non-`left` rows; we group them below.
    listAcsAnimals({ data: { shelterId: "san_antonio_acs" } })
      .then((d) => {
        if (alive) setState({ loading: false, error: null, data: d });
      })
      .catch((e) => {
        if (alive)
          setState({
            loading: false,
            error: e instanceof Error ? e.message : "Failed to load shelter list.",
            data: null,
          });
      });
    return () => {
      alive = false;
    };
  }, []);

  const d = state.data;

  // Group visible animals into sections (already urgency-ordered by the reader).
  const grouped = useMemo(() => {
    const map = new Map<AcsSectionId, AcsAnimal[]>();
    for (const a of d?.animals ?? []) {
      const sid = sectionOf(a);
      const arr = map.get(sid) ?? [];
      arr.push(a);
      map.set(sid, arr);
    }
    return map;
  }, [d]);

  const activeChip = CHIPS.find((c) => c.id === chip) ?? CHIPS[0];
  const visibleSections = SECTIONS.filter((s) => {
    if (activeChip.sections !== "all" && !activeChip.sections.includes(s.id)) return false;
    return (grouped.get(s.id)?.length ?? 0) > 0;
  });

  const shownCount = visibleSections.reduce(
    (n, s) => n + (grouped.get(s.id)?.length ?? 0),
    0,
  );

  // "All" mirrors the public board's "on the list" total: only animals actively
  // facing euthanasia. Holds, Secured, and In Memoriam appear in their own pills
  // but are not part of the "All / on list" count.
  const ON_LIST_SECTIONS: AcsSectionId[] = [
    "critical_now",
    "critical_today",
    "on_the_clock",
    "urgent",
    "foster_pending",
  ];
  // Per-chip live counts — shown on each filter pill, including 0 for empty
  // categories. Each chip sums the animal groups for its section(s).
  const chipCount = (c: ChipDef): number => {
    const sections = c.sections === "all" ? ON_LIST_SECTIONS : c.sections;
    return sections.reduce((n, sid) => n + (grouped.get(sid)?.length ?? 0), 0);
  };

  return (
    <div style={{ minHeight: "100dvh", background: PAPER }}>
      <BrandHeader />

      <main className="mx-auto w-full max-w-[420px] px-4 pt-3 pb-12" style={{ color: INK }}>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-3 py-1 text-[12px] font-medium text-muted-foreground"
          >
            ← Change mission
          </button>
          <button
            onClick={onTakePhoto}
            className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] font-bold"
            style={{ background: GOLD, borderColor: GOLD, color: "#3A2A07" }}
          >
            📷 Take a Photo
          </button>
        </div>

        <p className="mb-3 text-center text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          AI is advisory — not a diagnosis
        </p>

        {/* Live auto-feed banner */}
        <div className="mb-4 rounded-2xl px-4 py-3" style={{ background: "#1A1611", color: "#F4ECD8" }}>
          <div className="flex items-center gap-2">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ background: "#22C55E", boxShadow: "0 0 0 4px rgba(34,197,94,0.25)" }}
              aria-hidden
            />
            <span className="text-[11px] font-bold tracking-[0.18em]" style={{ color: "#FFE9A8" }}>
              LIVE · AUTO-FEED ACTIVE
            </span>
          </div>
          <div className="mt-1 text-[13px]" style={{ color: "#F4ECD8" }}>
            <span className="font-semibold">{d?.shelter_name ?? "San Antonio ACS"}</span>
            <span style={{ color: "#B8AC92" }}> · last pull {fmtDate(d?.last_pulled_at ?? null)}</span>
          </div>
        </div>

        {/* Stats row — the three at-risk tiers a reader acts on most */}
        <div className="mb-4 grid grid-cols-3 gap-2">
          {[
            { label: "CRITICAL", value: (d?.counts.b6spt ?? 0) + (d?.counts.immediate ?? 0) },
            { label: "ON THE CLOCK", value: d?.counts.scheduled ?? 0 },
            { label: "IN MEMORIAM", value: d?.counts.euthanized ?? 0 },
          ].map((s) => (
            <div key={s.label} className="rounded-xl px-2 py-3 text-center" style={{ background: "#1A1611" }}>
              <div className="font-serif text-[22px] font-bold leading-none" style={{ color: GOLD }}>
                {s.value}
              </div>
              <div className="mt-1 text-[10px] font-semibold tracking-[0.12em]" style={{ color: "#B8AC92" }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>

        {/* Filter chips */}
        <div className="mb-4 flex flex-wrap gap-1.5" role="tablist" aria-label="Filter animals by status">
          {CHIPS.map((c) => {
            const active = c.id === chip;
            return (
              <button
                key={c.id}
                role="tab"
                aria-selected={active}
                onClick={() => setChip(c.id)}
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold transition active:scale-95"
                style={
                  active
                    ? { background: GOLD, color: "#3A2A07" }
                    : { background: "#FFFFFF", color: "#6B5832", border: "1px solid #E3DAC4" }
                }
              >
                <span>{c.label}</span>
                {d && (
                  <span
                    className="rounded-full px-1.5 text-[10px] font-bold leading-[1.45] tabular-nums"
                    style={
                      active
                        ? { background: "rgba(58,42,7,0.18)", color: "#3A2A07" }
                        : { background: "#F1EAD6", color: "#6B5832" }
                    }
                  >
                    {chipCount(c)}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* States */}
        {state.loading && (
          <div className="space-y-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-[92px] animate-pulse rounded-xl bg-muted/50" />
            ))}
          </div>
        )}
        {state.error && (
          <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {state.error}
          </div>
        )}
        {!state.loading && !state.error && shownCount === 0 && (
          <div className="rounded-xl border border-border bg-white p-4 text-center text-sm text-muted-foreground">
            No animals in this view right now.
          </div>
        )}

        {/* Grouped sections */}
        {!state.loading && !state.error && (
          <div className="space-y-6">
            {visibleSections.map((s) => {
              const rows = grouped.get(s.id) ?? [];
              return (
                <section key={s.id} aria-label={s.title}>
                  <div className="mb-2">
                    <div className="flex items-baseline justify-between gap-2">
                      <h2
                        className="font-serif text-[15px] font-bold leading-tight"
                        style={{ color: s.accent }}
                      >
                        {s.title}
                      </h2>
                      <span className="text-[11px] font-semibold text-muted-foreground">{rows.length}</span>
                    </div>
                    <p className="text-[11.5px] leading-snug text-muted-foreground">{s.action}</p>
                  </div>
                  <div className="space-y-2">
                    {rows.map((a) => (
                      <AnimalRow key={a.id} a={a} onPick={onPick} />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}

        {/* 4-step explainer */}
        <div className="mt-8">
          <div className="mb-3 text-[10.5px] font-bold tracking-[0.16em] text-muted-foreground">
            HOW THIS WORKS
          </div>
          <ol className="space-y-3">
            {[
              { n: 1, t: "Shelter publishes list", b: "Capacity euthanasia / at-risk, updated daily." },
              { n: 2, t: "Voyce ingests it", b: "A scheduled job pulls and parses every animal." },
              { n: 3, t: "Cards auto-generate", b: "One card per animal, grouped by how urgent it is." },
              { n: 4, t: "Pack gets alerted", b: "Rescues, fosters & adopters in range." },
            ].map((step) => (
              <li key={step.n} className="flex items-start gap-3">
                <span
                  className="mt-0.5 flex h-7 w-7 flex-none items-center justify-center rounded-full font-serif text-[13px] font-bold"
                  style={{ background: GOLD, color: "#3A2A07" }}
                >
                  {step.n}
                </span>
                <div>
                  <div className="font-serif text-[14px] font-semibold" style={{ color: INK }}>
                    {step.t}
                  </div>
                  <div className="text-[12.5px] text-muted-foreground">{step.b}</div>
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-4 text-center text-[12px] italic text-muted-foreground">
            No human had to upload these. Voyce's daily scheduled task ingests each partner shelter's at-risk list and turns each animal into a rescue card.
          </p>
        </div>
      </main>
    </div>
  );
}
