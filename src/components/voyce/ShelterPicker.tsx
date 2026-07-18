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
  formatDeadlineClock,
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
// Section presentation — one per status, ordered most-urgent first. Each
// carries a plain-language header, the action a reader can take, and a badge
// style. Colors are kept close to the earlier board taxonomy.
// ============================================================
type SectionDef = {
  id: AcsSectionId;
  title: string;
  action: string;
  badgeBg: string;
  badgeText: string;
  accent: string;
};

const SECTIONS: SectionDef[] = [
  {
    id: "euthanasia_now",
    title: "Euthanasia in progress",
    action: "In the euthanasia room now — email or call ACS immediately.",
    badgeBg: "#501313",
    badgeText: "#F7C1C1",
    accent: "#501313",
  },
  {
    id: "critical_now",
    title: "SOS (B6-SPT) · save now",
    action: "Moved to a euthanasia-prep kennel (B6-SPT) — act now.",
    badgeBg: "#791F1F",
    badgeText: "#F7C1C1",
    accent: "#791F1F",
  },
  {
    id: "critical_office",
    title: "Critical · Office",
    action: "In an office kennel and marked for euthanasia today — act now.",
    badgeBg: "#A32D2D",
    badgeText: "#FCEBEB",
    accent: "#A32D2D",
  },
  {
    id: "critical_outside",
    title: "Critical (OUTSIDE3) · save now",
    action: "In an outdoor kennel (OUTSIDE3) and marked for euthanasia — act now.",
    badgeBg: "#8F2525",
    badgeText: "#F7C1C1",
    accent: "#8F2525",
  },
  {
    id: "critical_today",
    title: "High risk · save today",
    action: "On today's euthanasia list — email ACS before the deadline to foster or rescue.",
    badgeBg: "#F09595",
    badgeText: "#501313",
    accent: "#C8362B",
  },
  {
    id: "on_the_clock",
    title: "Euthanasia date set",
    action: "A euthanasia date is set — foster, rescue, or adopt before the date.",
    badgeBg: "#FED7AA",
    badgeText: "#9A3412",
    accent: "#F97316",
  },
  {
    id: "urgent",
    title: "At risk",
    action: "Could be euthanized if the shelter fills — adopt, foster, or share.",
    badgeBg: "#FDE68A",
    badgeText: "#78350F",
    accent: "#F59E0B",
  },
  {
    id: "office",
    title: "Office",
    action: "In an office kennel — not marked for euthanasia right now. Keep an eye out.",
    badgeBg: "#F1EFE8",
    badgeText: "#444441",
    accent: "#B4B2A9",
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
  {
    id: "unknown",
    title: "Unknown",
    action: "A status Voyce didn't recognize — open the ACS record to check.",
    badgeBg: "#F1EFE8",
    badgeText: "#5F5E5A",
    accent: "#B4B2A9",
  },
];

const SECTION_BY_ID = SECTIONS.reduce<Record<AcsSectionId, SectionDef>>(
  (acc, s) => {
    acc[s.id] = s;
    return acc;
  },
  {} as Record<AcsSectionId, SectionDef>,
);

// Filter chips — one per section, always shown (even at count 0). `all` shows
// every animal.
type ChipDef = { id: string; label: string; sections: AcsSectionId[] | "all" };
const CHIPS: ChipDef[] = [
  { id: "all", label: "All", sections: "all" },
  { id: "euthanasia_now", label: "Euthanasia in progress", sections: ["euthanasia_now"] },
  { id: "critical_now", label: "SOS (B6-SPT) · save now", sections: ["critical_now"] },
  { id: "critical_office", label: "Critical · Office", sections: ["critical_office"] },
  { id: "critical_outside", label: "Critical (OUTSIDE3) · save now", sections: ["critical_outside"] },
  { id: "critical_today", label: "High risk · save today", sections: ["critical_today"] },
  { id: "on_the_clock", label: "Euthanasia date set", sections: ["on_the_clock"] },
  { id: "urgent", label: "At risk", sections: ["urgent"] },
  { id: "office", label: "Office", sections: ["office"] },
  { id: "adoption", label: "ACS Adoption Hold", sections: ["acs_adoption_hold"] },
  { id: "rescue", label: "ACS Rescue Hold", sections: ["rescue_hold"] },
  { id: "foster", label: "ACS Foster Hold", sections: ["acs_foster_hold"] },
  { id: "pending", label: "Foster Pending", sections: ["foster_pending"] },
  { id: "secured", label: "Secured", sections: ["secured"] },
  { id: "memoriam", label: "In Memoriam", sections: ["in_memoriam"] },
  { id: "unknown", label: "Unknown", sections: ["unknown"] },
];

function metaOf(a: AcsAnimal): AcsStatusMeta {
  const key = normalizeStatusKey(a.status_key);
  return key === "left" ? ACS_STATUS_MODEL.atrisk : ACS_STATUS_MODEL[key];
}

function sectionOf(a: AcsAnimal): AcsSectionId {
  // Once a dated euthanasia deadline has passed but the dog is STILL on ACS's
  // list, it's no longer a "save today" case — show it under "At risk" until
  // ACS republishes with a fresh date. In-room states (euthanasia/b6spt) carry
  // no dated deadline and are never downgraded.
  const key = normalizeStatusKey(a.status_key);
  if (key === "office_crit" || key === "outside_crit" || key === "immediate" || key === "scheduled") {
    const target = deadlineForAnimal(a);
    if (target && target.getTime() <= Date.now()) {
      // A Critical·Office dog past its deadline is just an office dog again
      // (like Princess) until ACS re-marks it; the others fall back to At risk.
      return key === "office_crit" ? "office" : "urgent";
    }
  }
  return metaOf(a).section;
}

// Which rows get the live euthanasia timer/urgency badge.
function showsTimer(a: AcsAnimal): boolean {
  const key = normalizeStatusKey(a.status_key);
  return (
    key === "euthanasia" ||
    key === "b6spt" ||
    key === "office_crit" ||
    key === "outside_crit" ||
    key === "immediate" ||
    key === "scheduled"
  );
}

function firstPhoto(a: AcsAnimal): string | null {
  if (a.thumb && a.thumb.trim()) return a.thumb.trim();
  if (a.photos && a.photos.length > 0) return a.photos[0];
  return null;
}

function specLine(a: AcsAnimal): string {
  return [a.breed, a.age, a.sex, a.color].filter(Boolean).join(" · ");
}

function fmtDateTime(iso: string | null): string {
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

// Short date for the on-card ACS date chips (due out / at risk since / euth).
function fmtDay(raw: string | null): string | null {
  const s = (raw ?? "").trim();
  if (!s) return null;
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(s)
    ? s
    : (() => {
        const m = /(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s);
        return m ? `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}` : "";
      })();
  const d = iso ? new Date(iso + "T12:00:00") : new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// "3 min ago" / "2 hr ago" for the freshness heartbeat.
function agoLabel(iso: string | null): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  const mins = Math.max(0, Math.round((Date.now() - t) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  return hrs === 1 ? "1 hr ago" : `${hrs} hr ago`;
}

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

// Small live euthanasia badge. `euthanasia`/`b6spt` show an "in progress" chip
// (no numeric timer); office_crit/immediate/scheduled tick down toward the
// Central-time deadline, with the wall-clock time shown so no one does tz math.
function RowTimerBadge({ a }: { a: AcsAnimal }) {
  const key = normalizeStatusKey(a.status_key);
  const inRoom = key === "euthanasia" || key === "b6spt";
  const target = useMemo(() => (inRoom ? null : deadlineForAnimal(a)), [a, inRoom]);
  const { msLeft, hasTarget } = useEuthCountdown(target);

  // A dated animal whose Central deadline is already behind us shows a clean
  // "deadline has passed" state rather than a frozen 0s countdown.
  const past = !inRoom && hasTarget && msLeft <= 0;
  const chip = inRoom
    ? { label: "In progress — act now", bg: "#7F1D1D", text: "#FFFFFF", pulse: true }
    : past
      ? { label: "Today's deadline has passed", bg: "#7F1D1D", text: "#FFFFFF", pulse: false }
      : urgencyFor(msLeft);
  const countdown = !inRoom && hasTarget && msLeft > 0 ? formatCountdown(msLeft) : null;
  const clock = !inRoom && hasTarget && target && msLeft > 0 ? formatDeadlineClock(target) : null;

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
      {countdown && (
        <span className="tabular-nums">
          ⏳ {countdown}
          {clock && ` · by ${clock}`}
        </span>
      )}
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

  const dueOut = fmtDay(a.due_out);
  const riskSince = fmtDay(a.risk_since);
  const euthDay = fmtDay(a.euth_date);

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
          <div className="mt-1 text-[10.5px] font-semibold" style={{ color: GOLD_DEEP }}>
            Tap for full details ›
          </div>
        </div>
        <span
          className="flex-none rounded-full px-2.5 py-1 text-center text-[10px] font-bold leading-tight tracking-wide"
          style={{ background: section.badgeBg, color: section.badgeText }}
        >
          {badge}
        </span>
      </button>

      {/* ACS date chips — kennel + due out + at-risk-since + euth date */}
      {(a.kennel || dueOut || riskSince || euthDay) && (
        <div className="flex flex-wrap gap-1.5 px-2.5 pb-1">
          {a.kennel && (
            <span className="rounded-md bg-[#F3EFE4] px-1.5 py-0.5 text-[10px] font-semibold text-[#6B5832]">
              Kennel {a.kennel}
            </span>
          )}
          {dueOut && (
            <span className="rounded-md bg-[#F3EFE4] px-1.5 py-0.5 text-[10px] font-semibold text-[#6B5832]">
              Due out {dueOut}
            </span>
          )}
          {riskSince && (
            <span className="rounded-md bg-[#FDECEC] px-1.5 py-0.5 text-[10px] font-semibold text-[#9A3412]">
              At risk since {riskSince}
            </span>
          )}
          {euthDay && (
            <span className="rounded-md bg-[#FBE3E3] px-1.5 py-0.5 text-[10px] font-semibold text-[#7F1D1D]">
              Euth date {euthDay}
            </span>
          )}
        </div>
      )}

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
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let alive = true;

    const load = (background: boolean) => {
      if (background) setRefreshing(true);
      listAcsAnimals({ data: { shelterId: "san_antonio_acs" } })
        .then((d) => {
          if (alive) setState({ loading: false, error: null, data: d });
        })
        .catch((e) => {
          if (!alive) return;
          setState((prev) =>
            background && prev.data
              ? prev
              : {
                  loading: false,
                  error: e instanceof Error ? e.message : "Failed to load shelter list.",
                  data: null,
                },
          );
        })
        .finally(() => {
          if (alive) setRefreshing(false);
        });
    };

    load(false);
    const id = window.setInterval(() => load(true), 120000);
    const onVisible = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") load(true);
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      alive = false;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, []);

  const d = state.data;

  // Search filter — name / animal id / breed / kennel.
  const matched = useMemo(() => {
    const list = d?.animals ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((a) =>
      [a.name, a.id, a.breed, a.kennel]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [d, query]);

  // Group the (search-filtered) animals into sections.
  const grouped = useMemo(() => {
    const map = new Map<AcsSectionId, AcsAnimal[]>();
    for (const a of matched) {
      const sid = sectionOf(a);
      const arr = map.get(sid) ?? [];
      arr.push(a);
      map.set(sid, arr);
    }
    return map;
  }, [matched]);

  const activeChip = CHIPS.find((c) => c.id === chip) ?? CHIPS[0];
  const visibleSections = SECTIONS.filter((s) => {
    if (activeChip.sections !== "all" && !activeChip.sections.includes(s.id)) return false;
    return (grouped.get(s.id)?.length ?? 0) > 0;
  });

  const shownCount = visibleSections.reduce(
    (n, s) => n + (grouped.get(s.id)?.length ?? 0),
    0,
  );

  // Per-chip counts (reflect the current search). Every pill shows, even at 0.
  const chipCount = (c: ChipDef): number => {
    if (c.sections === "all") return matched.length;
    return c.sections.reduce((n, sid) => n + (grouped.get(sid)?.length ?? 0), 0);
  };

  // Freshness heartbeat: "checked X ago" from the scraper's last run. Amber
  // warning only when a successful check hasn't happened in over 3 hours.
  const lastChecked = d?.last_checked_at ?? null;
  const checkedMins = lastChecked
    ? Math.max(0, Math.round((Date.now() - new Date(lastChecked).getTime()) / 60000))
    : null;
  const stale = checkedMins !== null && checkedMins > 180;

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

        {/* Live auto-feed banner — honest freshness from the scraper heartbeat */}
        <div
          className="mb-4 rounded-2xl px-4 py-3"
          style={{ background: stale ? "#3A2A07" : "#1A1611", color: "#F4ECD8" }}
        >
          <div className="flex items-center gap-2">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{
                background: stale ? "#F59E0B" : "#22C55E",
                boxShadow: `0 0 0 4px ${stale ? "rgba(245,158,11,0.25)" : "rgba(34,197,94,0.25)"}`,
              }}
              aria-hidden
            />
            <span className="text-[11px] font-bold tracking-[0.18em]" style={{ color: "#FFE9A8" }}>
              {stale ? "⚠ MAY BE OUT OF DATE" : "LIVE · AUTO-UPDATES EVERY 15 MIN"}
            </span>
          </div>
          <div className="mt-1 text-[13px]" style={{ color: "#F4ECD8" }}>
            <span className="font-semibold">{d?.shelter_name ?? "San Antonio ACS"}</span>
            {checkedMins !== null && (
              <span style={{ color: stale ? "#FCD9A0" : "#B8AC92" }}> · checked {agoLabel(lastChecked)}</span>
            )}
            {refreshing && <span style={{ color: "#FFE9A8" }}> · refreshing…</span>}
          </div>
          {d?.last_pulled_at && (
            <div className="mt-0.5 text-[11px]" style={{ color: "#8C8367" }}>
              ACS last changed {fmtDateTime(d.last_pulled_at)}
            </div>
          )}
        </div>

        {/* Search */}
        <div className="mb-3">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, ID, breed, or kennel"
            aria-label="Search animals"
            className="w-full rounded-xl border border-[#E3DAC4] bg-white px-3 py-2 text-[13px] outline-none transition placeholder:text-[#B8AC92] focus:border-[#C9871A]"
          />
        </div>

        {/* Stats row */}
        <div className="mb-4 grid grid-cols-3 gap-2">
          {[
            {
              label: "CRITICAL",
              value:
                (d?.counts.euthanasia ?? 0) +
                (d?.counts.b6spt ?? 0) +
                (d?.counts.office_crit ?? 0) +
                (d?.counts.outside_crit ?? 0) +
                (d?.counts.immediate ?? 0),
            },
            { label: "DATE SET", value: d?.counts.scheduled ?? 0 },
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

        {/* Filter chips — every pill shows, even at 0 */}
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
            {query.trim() ? `No animals match “${query.trim()}”.` : "No animals in this view right now."}
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
            No human had to upload these. Voyce's scheduled task ingests each partner shelter's at-risk list and turns each animal into a rescue card.
          </p>
        </div>
      </main>
    </div>
  );
}
