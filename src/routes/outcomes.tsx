import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { BrandHeader } from "@/components/voyce/BrandHeader";
import {
  listOutcomes,
  addFollowup,
  UNACCOUNTED_AFTER_DAYS,
  type OutcomesResult,
  type OutcomeAnimal,
  type OutcomeState,
  type Followup,
  type FollowupOutcome,
} from "@/lib/followups.functions";

export const Route = createFileRoute("/outcomes")({
  head: () => ({
    meta: [
      { title: "Outcomes & Accountability — Voyce" },
      {
        name: "description",
        content:
          "What happened to every animal after the shelter — made it out, in foster, in memoriam, or unaccounted for. Voyce keeps the trail public.",
      },
    ],
  }),
  component: OutcomesPage,
});

const GOLD = "#FFDF3B";
const PAPER = "#FAF8F5";
const INK = "#1A1611";

const STATE_BADGE: Record<OutcomeState, { label: string; bg: string; text: string }> = {
  unaccounted: { label: "Unaccounted for", bg: "#FEE2E2", text: "#991B1B" },
  in_memoriam: { label: "In Memoriam", bg: "#E5E7EB", text: "#374151" },
  foster: { label: "In foster", bg: "#C7F9E5", text: "#065F46" },
  at_risk: { label: "Still at risk", bg: "#FDE68A", text: "#78350F" },
  made_it_out: { label: "Made it out", bg: "#D1FAE5", text: "#065F46" },
};

const OUTCOME_LABEL: Record<FollowupOutcome, string> = {
  pulled: "Pulled by rescue",
  in_foster: "In foster",
  adopted: "Adopted",
  reclaimed: "Reclaimed by owner",
  transferred: "Transferred",
  passed: "Passed away",
  returned: "Returned",
  unknown: "Update",
};

type FilterId = "all" | OutcomeState;
const FILTERS: { id: FilterId; label: string }[] = [
  { id: "all", label: "All" },
  { id: "unaccounted", label: "Unaccounted for" },
  { id: "in_memoriam", label: "In Memoriam" },
  { id: "foster", label: "In foster" },
  { id: "at_risk", label: "Still at risk" },
  { id: "made_it_out", label: "Made it out" },
];

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return iso;
  }
}

function Thumb({ a }: { a: OutcomeAnimal }) {
  const src = a.thumb || (a.photos && a.photos[0]) || null;
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div
        className="grid h-[52px] w-[52px] flex-none place-items-center rounded-lg text-[20px]"
        style={{ background: "linear-gradient(135deg, #FFF3C4 0%, #F5E3A0 100%)", color: "#C9871A" }}
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
      width={52}
      height={52}
      loading="lazy"
      onError={() => setFailed(true)}
      className="h-[52px] w-[52px] flex-none rounded-lg object-cover"
    />
  );
}

function Timeline({ animal }: { animal: OutcomeAnimal }) {
  const events: { date: string | null; label: string; sub?: string }[] = [];
  if (animal.list_date) events.push({ date: animal.list_date, label: "Listed at shelter" });
  for (const f of animal.followups) {
    events.push({
      date: f.occurred_on,
      label: OUTCOME_LABEL[f.outcome] ?? "Update",
      sub: [f.partner_name, f.note].filter(Boolean).join(" — ") || undefined,
    });
  }
  if (animal.state === "in_memoriam" && animal.followups.every((f) => f.outcome !== "passed")) {
    events.push({ date: animal.euth_date || animal.left_at, label: "Confirmed euthanized (ACS)" });
  }
  if (events.length === 0) return null;

  return (
    <ol className="mt-2 space-y-1.5 border-l-2 border-[#EDE5D8] pl-3">
      {events.map((e, i) => (
        <li key={i} className="text-[12px] leading-snug">
          <span className="font-semibold" style={{ color: INK }}>
            {e.label}
          </span>
          <span className="text-muted-foreground"> · {fmtDate(e.date)}</span>
          {e.sub && <div className="text-muted-foreground">{e.sub}</div>}
        </li>
      ))}
    </ol>
  );
}

function OutcomesPage() {
  const [state, setState] = useState<{ loading: boolean; error: string | null; data: OutcomesResult | null }>({
    loading: true,
    error: null,
    data: null,
  });
  const [filter, setFilter] = useState<FilterId>("all");
  const [adminOpen, setAdminOpen] = useState(false);

  const load = () => {
    listOutcomes({ data: { shelterId: "san_antonio_acs" } })
      .then((d) => setState({ loading: false, error: null, data: d }))
      .catch((e) =>
        setState({ loading: false, error: e instanceof Error ? e.message : "Failed to load outcomes.", data: null }),
      );
  };
  useEffect(() => {
    load();
  }, []);

  const d = state.data;
  const animals = d?.animals ?? [];
  const shown = useMemo(
    () => (filter === "all" ? animals : animals.filter((a) => a.state === filter)),
    [animals, filter],
  );

  return (
    <div style={{ minHeight: "100dvh", background: PAPER }}>
      <BrandHeader />
      <main className="mx-auto w-full max-w-[560px] px-4 pb-14 pt-4" style={{ color: INK }}>
        <Link to="/" className="text-[12px] font-medium uppercase tracking-[0.14em] text-[#8A5A0E]">
          ← Back to Voyce
        </Link>

        <h1 className="mt-3 font-serif text-[26px] font-bold leading-tight">Outcomes &amp; Accountability</h1>
        <p className="mt-1 text-[13.5px] leading-relaxed text-muted-foreground">
          What happened to every animal after the shelter — kept public so no animal quietly disappears. An
          animal that leaves the list with no follow-up within {UNACCOUNTED_AFTER_DAYS} days is flagged
          <span className="font-semibold text-[#991B1B]"> unaccounted for</span>.
        </p>

        {/* Impact banner */}
        {d && (
          <div className="mt-4 grid grid-cols-3 gap-2">
            {[
              { label: "TRACKED", value: d.summary.total, color: GOLD },
              { label: "MADE IT OUT", value: d.summary.made_it_out, color: "#34D399" },
              { label: "IN FOSTER", value: d.summary.foster, color: "#5EEAD4" },
              { label: "STILL AT RISK", value: d.summary.at_risk, color: "#FBBF24" },
              { label: "IN MEMORIAM", value: d.summary.in_memoriam, color: "#D1D5DB" },
              { label: "UNACCOUNTED", value: d.summary.unaccounted, color: "#FCA5A5" },
            ].map((s) => (
              <div key={s.label} className="rounded-xl px-2 py-3 text-center" style={{ background: "#1A1611" }}>
                <div className="font-serif text-[22px] font-bold leading-none" style={{ color: s.color }}>
                  {s.value}
                </div>
                <div className="mt-1 text-[9.5px] font-semibold tracking-[0.1em]" style={{ color: "#B8AC92" }}>
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        )}
        {d && d.summary.returned > 0 && (
          <p className="mt-2 text-center text-[12px] font-semibold text-[#92400E]">
            ↩ {d.summary.returned} came back after leaving — back at risk when they returned.
          </p>
        )}

        {/* Filters */}
        <div className="mt-4 flex flex-wrap gap-1.5">
          {FILTERS.map((f) => {
            const active = f.id === filter;
            const count =
              f.id === "all" ? animals.length : animals.filter((a) => a.state === f.id).length;
            return (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold transition active:scale-95"
                style={
                  active
                    ? { background: GOLD, color: "#3A2A07" }
                    : { background: "#FFFFFF", color: "#6B5832", border: "1px solid #E3DAC4" }
                }
              >
                <span>{f.label}</span>
                {d && (
                  <span
                    className="rounded-full px-1.5 text-[10px] font-bold leading-[1.45] tabular-nums"
                    style={active ? { background: "rgba(58,42,7,0.18)", color: "#3A2A07" } : { background: "#F1EAD6", color: "#6B5832" }}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* States */}
        {state.loading && (
          <div className="mt-4 space-y-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-[80px] animate-pulse rounded-xl bg-muted/50" />
            ))}
          </div>
        )}
        {state.error && (
          <div className="mt-4 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {state.error}
          </div>
        )}
        {!state.loading && !state.error && shown.length === 0 && (
          <div className="mt-4 rounded-xl border border-border bg-white p-4 text-center text-sm text-muted-foreground">
            No animals in this view.
          </div>
        )}

        {/* List */}
        {!state.loading && !state.error && shown.length > 0 && (
          <div className="mt-4 space-y-2.5">
            {shown.map((a) => {
              const badge = STATE_BADGE[a.state];
              return (
                <div
                  key={a.id}
                  className="rounded-xl border border-border bg-white p-3 shadow-sm"
                  style={{ borderLeft: `4px solid ${badge.text}` }}
                >
                  <div className="flex items-start gap-3">
                    <Thumb a={a} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-serif text-[15px] font-semibold leading-tight">{a.name}</span>
                        {a.breed && <span className="text-[11.5px] text-muted-foreground">· {a.breed}</span>}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <span
                          className="rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide"
                          style={{ background: badge.bg, color: badge.text }}
                        >
                          {badge.label}
                        </span>
                        {a.returned && (
                          <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: "#FEF3C7", color: "#92400E" }}>
                            ↩ Came back ×{a.times_listed}
                          </span>
                        )}
                        {a.state === "unaccounted" && a.days_since_left != null && (
                          <span className="text-[10.5px] font-semibold text-[#991B1B]">
                            {a.days_since_left} days, no follow-up
                          </span>
                        )}
                      </div>
                      <Timeline animal={a} />
                      {a.pet_search_url && (
                        <a
                          href={a.pet_search_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-2 inline-block text-[11px] font-semibold text-[#1D4ED8]"
                        >
                          🔗 ACS record
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Admin: post an update */}
        <div className="mt-8">
          <button
            onClick={() => setAdminOpen((v) => !v)}
            className="text-[12px] font-semibold text-[#8A5A0E] underline-offset-2 hover:underline"
          >
            {adminOpen ? "Hide" : "Post an update (admin)"}
          </button>
          {adminOpen && <AdminForm animals={animals} onSaved={load} />}
        </div>

        <div className="mt-10 text-center text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          Follow-up recorded factually · dates as reported
        </div>
      </main>
    </div>
  );
}

function AdminForm({ animals, onSaved }: { animals: OutcomeAnimal[]; onSaved: () => void }) {
  const [secret, setSecret] = useState("");
  const [animalId, setAnimalId] = useState("");
  const [outcome, setOutcome] = useState<FollowupOutcome>("pulled");
  const [partner, setPartner] = useState("");
  const [occurredOn, setOccurredOn] = useState("");
  const [note, setNote] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const outcomes: FollowupOutcome[] = [
    "pulled",
    "in_foster",
    "adopted",
    "reclaimed",
    "transferred",
    "passed",
    "returned",
    "unknown",
  ];

  const submit = () => {
    if (busy) return;
    if (!animalId) {
      setMsg("Pick an animal first.");
      return;
    }
    setBusy(true);
    setMsg(null);
    addFollowup({
      data: {
        secret,
        animal_id: animalId,
        outcome,
        partner_name: partner || undefined,
        note: note || undefined,
        photo_url: photoUrl || undefined,
        occurred_on: occurredOn || undefined,
      },
    })
      .then(() => {
        setMsg("Saved ✓");
        setPartner("");
        setNote("");
        setPhotoUrl("");
        onSaved();
      })
      .catch((e) => setMsg(e instanceof Error ? e.message : "Could not save."))
      .finally(() => setBusy(false));
  };

  const field = "w-full rounded-lg border border-[#E3DAC4] bg-white px-3 py-2 text-[13px] outline-none focus:border-[#C9871A]";

  return (
    <div className="mt-3 space-y-2 rounded-xl border border-[#F0E4C6] bg-[#FFFDF7] p-3">
      <p className="text-[12px] leading-relaxed text-muted-foreground">
        Phase 1: updates are posted by an admin with the passphrase. Trusted partners posting their own
        updates comes in Phase 2.
      </p>
      <input
        type="password"
        value={secret}
        onChange={(e) => setSecret(e.target.value)}
        placeholder="Admin passphrase"
        className={field}
      />
      <select value={animalId} onChange={(e) => setAnimalId(e.target.value)} className={field}>
        <option value="">— pick an animal —</option>
        {animals.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name} {a.breed ? `(${a.breed})` : ""} · {STATE_BADGE[a.state].label}
          </option>
        ))}
      </select>
      <select value={outcome} onChange={(e) => setOutcome(e.target.value as FollowupOutcome)} className={field}>
        {outcomes.map((o) => (
          <option key={o} value={o}>
            {OUTCOME_LABEL[o]}
          </option>
        ))}
      </select>
      <input value={partner} onChange={(e) => setPartner(e.target.value)} placeholder="Who handled it (rescue / foster)" className={field} />
      <input type="date" value={occurredOn} onChange={(e) => setOccurredOn(e.target.value)} className={field} />
      <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" rows={2} className={field} />
      <input value={photoUrl} onChange={(e) => setPhotoUrl(e.target.value)} placeholder="Photo URL (optional)" className={field} />
      <button
        onClick={submit}
        disabled={busy}
        className="w-full rounded-lg py-2.5 text-[13px] font-bold"
        style={{ background: GOLD, color: "#3A2A07", opacity: busy ? 0.7 : 1 }}
      >
        {busy ? "Saving…" : "Save update"}
      </button>
      {msg && <p className="text-center text-[12px] font-semibold text-[#6B5832]">{msg}</p>}
    </div>
  );
}
