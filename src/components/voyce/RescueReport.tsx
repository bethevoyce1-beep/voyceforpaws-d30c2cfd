import { useState } from "react";
import type { Assessment } from "@/lib/analyze.functions";

const STATUS_STYLES: Record<Assessment["status"], { bg: string; text: string; dot: string; label: string }> = {
  Urgent: { bg: "bg-[oklch(0.94_0.08_30)]", text: "text-[oklch(0.42_0.18_30)]", dot: "bg-[oklch(0.62_0.22_30)]", label: "Urgent" },
  Monitoring: { bg: "bg-[oklch(0.95_0.08_85)]", text: "text-[oklch(0.40_0.10_60)]", dot: "bg-[oklch(0.72_0.16_70)]", label: "Monitoring" },
  Stable: { bg: "bg-[oklch(0.94_0.06_180)]", text: "text-[oklch(0.40_0.10_200)]", dot: "bg-[oklch(0.62_0.14_200)]", label: "Stable" },
  Healthy: { bg: "bg-[oklch(0.94_0.07_140)]", text: "text-[oklch(0.36_0.12_140)]", dot: "bg-[oklch(0.58_0.18_140)]", label: "Healthy" },
};

const ROLE_PILLS = ["Foster", "Rescue", "Adopt", "Pledge", "Transport"];

export function RescueReport({
  image,
  data,
  onContinue,
}: {
  image: string;
  data: Assessment;
  onContinue: () => void;
}) {
  const [tab, setTab] = useState<"story" | "vet">("story");
  const s = STATUS_STYLES[data.status] ?? STATUS_STYLES.Monitoring;
  const urgent = data.status === "Urgent";
  const monitoring = data.status === "Monitoring" || data.is_likely_pet;

  return (
    <div className="min-h-[100dvh] bg-background pb-32">
      <div className="mx-auto w-full max-w-2xl px-5 pt-[max(1rem,env(safe-area-inset-top))]">
        {/* Photo */}
        <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
          <img src={image} alt={data.title} className="aspect-[4/3] w-full object-cover" />
        </div>

        {/* Title + status */}
        <div className="mt-5">
          <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${s.bg} ${s.text}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
            {s.label} · {data.status_reason}
          </div>
          <h1 className="mt-3 font-serif text-3xl font-semibold tracking-tight leading-tight">
            {data.title}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {data.species} · {data.breed} · {data.age} · {data.weight}
          </p>
        </div>

        {/* Tabs */}
        <div className="mt-5 inline-flex rounded-full border border-border bg-card p-1">
          {(["story", "vet"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                tab === k
                  ? "bg-[oklch(0.88_0.16_85)] text-[oklch(0.25_0.04_60)] shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {k === "story" ? "📖 Story" : "🩺 Vet"}
            </button>
          ))}
        </div>

        {tab === "story" ? (
          <div className="mt-5 space-y-5">
            <Section title="Voyce's First Look">{data.first_look}</Section>
            <Section title="Behavior">{data.behavior}</Section>
            <Section title="Where we found them">{data.location_scene}</Section>
            <Section title="What we noticed">
              {data.noticed.length === 0 ? (
                <span className="text-muted-foreground">Nothing concerning visible in this image.</span>
              ) : (
                <ul className="list-disc pl-5 space-y-1">
                  {data.noticed.map((n, i) => <li key={i}>{n}</li>)}
                </ul>
              )}
            </Section>
            <Section title="Suggested next steps">
              <ul className="space-y-1.5">
                {data.next_steps.map((n, i) => (
                  <li key={i} className="flex gap-2"><span className="text-[oklch(0.65_0.18_70)]">→</span><span>{n}</span></li>
                ))}
              </ul>
            </Section>
          </div>
        ) : (
          <div className="mt-5 space-y-5">
            <Section title="Body condition">{data.vet_notes.bcs}</Section>
            <Section title="Observed posture">{data.vet_notes.posture}</Section>
            <Section title="Hydration">{data.vet_notes.hydration}</Section>
            <Section title="Clinical summary">{data.vet_notes.clinical}</Section>
            <Section title="Suggested next steps">
              <ul className="space-y-1.5">
                {data.next_steps.map((n, i) => (
                  <li key={i} className="flex gap-2"><span className="text-[oklch(0.65_0.18_70)]">→</span><span>{n}</span></li>
                ))}
              </ul>
            </Section>
          </div>
        )}

        {/* Role pills or monitoring microcopy */}
        {urgent ? (
          <div className="mt-7">
            <div className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
              How can you help?
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {ROLE_PILLS.map((r) => (
                <button
                  key={r}
                  className="rounded-full border border-[oklch(0.85_0.12_70)] bg-[oklch(0.97_0.04_85)] px-4 py-2 text-sm font-medium text-[oklch(0.35_0.10_60)] shadow-sm transition hover:bg-[oklch(0.93_0.08_85)]"
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
        ) : monitoring ? (
          <div className="mt-7 rounded-2xl border border-[oklch(0.88_0.10_85)] bg-[oklch(0.97_0.05_85)] px-4 py-3 text-sm text-[oklch(0.38_0.08_60)]">
            Heads up — likely a pet at home. No action needed unless something changes.
          </div>
        ) : null}

        <div className="mt-6 text-center text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          AI is advisory — not a diagnosis
        </div>
      </div>

      {/* Sticky continue */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/95 px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
        <div className="mx-auto flex max-w-2xl justify-end">
          <button
            onClick={onContinue}
            className="rounded-full bg-gradient-to-b from-[oklch(0.90_0.16_85)] to-[oklch(0.78_0.15_70)] px-6 py-2.5 text-sm font-semibold text-[oklch(0.25_0.04_60)] shadow-md hover:brightness-105 active:scale-[0.98] transition"
          >
            Continue →
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="font-serif text-lg font-semibold tracking-tight">{title}</h2>
      <div className="mt-1.5 text-[15px] leading-relaxed text-foreground/85">{children}</div>
    </div>
  );
}
