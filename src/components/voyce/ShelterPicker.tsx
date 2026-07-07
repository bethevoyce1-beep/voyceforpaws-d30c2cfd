import { useEffect, useState } from "react";
import { listAcsAnimals, type AcsAnimal, type AcsListResult } from "@/lib/acs.functions";
import { BrandHeader } from "@/components/voyce/BrandHeader";

const GOLD = "#FFDF3B";
const GOLD_DEEP = "#C9871A";
const PAPER = "#FAF7F1";
const INK = "#1A1611";

type Props = {
  onPick: (animal: AcsAnimal) => void;
  onBack: () => void;
};

function urgencyPill(a: AcsAnimal): { label: string; bg: string; text: string } {
  if (a.tags?.includes("SENIOR")) return { label: "SENIOR", bg: "#FCD34D", text: "#7C2D12" };
  if (a.tags?.includes("BONDED")) return { label: "BONDED", bg: "#FBCFE8", text: "#831843" };
  if (a.status === "pm_cutoff") return { label: "URGENT", bg: "#FECACA", text: "#7F1D1D" };
  if (a.status === "med_foster") return { label: "MED FOSTER", bg: "#BAE6FD", text: "#075985" };
  return { label: "AT RISK", bg: "#FDE68A", text: "#78350F" };
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

export function ShelterPicker({ onPick, onBack }: Props) {
  const [state, setState] = useState<{ loading: boolean; error: string | null; data: AcsListResult | null }>(
    { loading: true, error: null, data: null },
  );

  useEffect(() => {
    let alive = true;
    listAcsAnimals({ data: { shelterId: "san_antonio_acs", limit: 10 } })
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

  return (
    <div style={{ minHeight: "100dvh", background: PAPER }}>
      <BrandHeader />

      <main className="mx-auto w-full max-w-[420px] px-4 pt-3 pb-12" style={{ color: INK }}>
        <button
          onClick={onBack}
          className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-3 py-1 text-[12px] font-medium text-muted-foreground"
        >
          ← Change mission
        </button>

        <p className="mb-3 text-center text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          AI is advisory — not a diagnosis
        </p>

        {/* Live auto-feed banner */}
        <div
          className="mb-4 rounded-2xl px-4 py-3"
          style={{ background: "#1A1611", color: "#F4ECD8" }}
        >
          <div className="flex items-center gap-2">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{
                background: "#22C55E",
                boxShadow: "0 0 0 4px rgba(34,197,94,0.25)",
              }}
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

        {/* Stats row */}
        <div className="mb-4 grid grid-cols-3 gap-2">
          {[
            { label: "AT RISK", value: d?.counts.at_risk ?? 0 },
            { label: "MED FOSTER", value: d?.counts.med_foster ?? 0 },
            { label: "PM CUTOFF", value: d?.counts.pm_cutoff ?? 0 },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-xl px-2 py-3 text-center"
              style={{ background: "#1A1611" }}
            >
              <div
                className="font-serif text-[22px] font-bold leading-none"
                style={{ color: GOLD }}
              >
                {s.value}
              </div>
              <div
                className="mt-1 text-[10px] font-semibold tracking-[0.12em]"
                style={{ color: "#B8AC92" }}
              >
                {s.label}
              </div>
            </div>
          ))}
        </div>

        <div className="mb-2 mt-5 text-[10.5px] font-bold tracking-[0.16em] text-muted-foreground">
          AUTO-GENERATED CARDS · MOST URGENT
        </div>

        {/* List */}
        <div className="space-y-2">
          {state.loading && (
            <>
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-[76px] animate-pulse rounded-xl bg-muted/50"
                />
              ))}
            </>
          )}
          {state.error && (
            <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              {state.error}
            </div>
          )}
          {!state.loading && d && d.animals.length === 0 && (
            <div className="rounded-xl border border-border bg-white p-4 text-center text-sm text-muted-foreground">
              No at-risk animals listed right now.
            </div>
          )}
          {d?.animals.map((a) => {
            const pill = urgencyPill(a);
            return (
              <button
                key={a.id}
                onClick={() => onPick(a)}
                className="group flex w-full items-center gap-3 rounded-xl border border-border bg-white p-2.5 text-left shadow-sm transition hover:-translate-y-px hover:shadow-md active:scale-[0.99]"
              >
                <img
                  src={a.photo_url}
                  alt={a.name}
                  width={60}
                  height={60}
                  loading="lazy"
                  className="h-[60px] w-[60px] flex-none rounded-lg object-cover"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-serif text-[15px] font-semibold leading-tight" style={{ color: INK }}>
                      {a.name}
                    </span>
                    {a.kennel_id && (
                      <span className="text-[10.5px] text-muted-foreground">· {a.kennel_id}</span>
                    )}
                  </div>
                  <div className="truncate text-[12px] text-muted-foreground">
                    {[a.breed, a.age, a.sex].filter(Boolean).join(" · ")}
                  </div>
                  <div className="mt-0.5 text-[11px]" style={{ color: GOLD_DEEP }}>
                    {a.days_at_shelter} days at shelter
                  </div>
                </div>
                <span
                  className="flex-none rounded-full px-2 py-1 text-[10px] font-bold tracking-wide"
                  style={{ background: pill.bg, color: pill.text }}
                >
                  {pill.label}
                </span>
              </button>
            );
          })}
        </div>

        {d && d.total > d.animals.length && (
          <button
            className="mt-4 w-full rounded-full px-4 py-2.5 text-[13px] font-semibold"
            style={{
              background: `linear-gradient(135deg, ${GOLD} 0%, ${GOLD_DEEP} 100%)`,
              color: "#3A2A07",
            }}
          >
            View all {d.total} {d.shelter_name} rescue cards →
          </button>
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
              { n: 3, t: "Cards auto-generate", b: "One card per animal, with photo + vitals." },
              { n: 4, t: "Network gets alerted", b: "Rescues, fosters & adopters in range." },
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
