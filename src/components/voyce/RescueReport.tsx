import { useMemo, useState } from "react";
import type { Assessment } from "@/lib/analyze.functions";
import { MISSIONS, type MissionId } from "@/lib/missions";
import { getUrgency } from "@/lib/urgency";


type RibbonKey = "critical" | "urgent_injured" | "at_risk" | "care_needed" | "monitoring" | "wildlife";

type RibbonStyle = {
  label: string;
  gradient: string;
  textOnRibbon: string;
  titleColor: string;
  subtitle: string;
  ringBg: string; // tint used for urgency strip & callout
};

const RIBBONS: Record<RibbonKey, RibbonStyle> = {
  critical: {
    label: "🚨 CRITICAL: LIFE-THREATENING",
    gradient: "linear-gradient(135deg, #D14848 0%, #6A1414 100%)",
    textOnRibbon: "#FFF6F4",
    titleColor: "#7E1F1F",
    subtitle: "Life-threatening — action needed today",
    ringBg: "#F8D7D7",
  },
  urgent_injured: {
    label: "🟠 URGENT: NEEDS RESCUE",
    gradient: "linear-gradient(135deg, #FF6B35 0%, #A8431F 100%)",
    textOnRibbon: "#FFF6F0",
    titleColor: "#A8431F",
    subtitle: "Needs help today",
    ringBg: "#FFE4D6",
  },
  at_risk: {
    label: "⚠️ URGENT: AT RISK",
    gradient: "linear-gradient(135deg, #B83232 0%, #7E1F1F 100%)",
    textOnRibbon: "#FFF1EE",
    titleColor: "#7E1F1F",
    subtitle: "At-risk in shelter — time is short",
    ringBg: "#F8E2E2",
  },
  care_needed: {
    label: "💛 CARE NEEDED",
    gradient: "linear-gradient(135deg, #FFD24A 0%, #C9871A 100%)",
    textOnRibbon: "#3A2A07",
    titleColor: "#8A5A0E",
    subtitle: "Could use a closer look soon",
    ringBg: "#FCEFC9",
  },
  monitoring: {
    label: "✓ MONITORING · NO ACTION NEEDED",
    gradient: "linear-gradient(135deg, #B8E3C6 0%, #1F9D57 100%)",
    textOnRibbon: "#0F3A22",
    titleColor: "#1F6B3D",
    subtitle: "No action needed unless something changes",
    ringBg: "#E7F5EC",
  },
  wildlife: {
    label: "🦝 WILDLIFE",
    gradient: "linear-gradient(135deg, #BFDDF0 0%, #4A8FB8 100%)",
    textOnRibbon: "#0F2A3A",
    titleColor: "#2C5C7C",
    subtitle: "Observe from a safe distance",
    ringBg: "#E4F0F8",
  },
};

function pickRibbon(data: Assessment, mission: MissionId): RibbonKey {
  if (mission === "wildlife") return "wildlife";
  const u = getUrgency(data, mission);
  if (u.level === "CRITICAL") return "critical";
  if (mission === "at-risk-shelter") return "at_risk";
  if (mission === "lost-found") return "care_needed";
  if (mission === "prevention") {
    return u.level === "LOW" ? "monitoring" : "care_needed";
  }
  // injured
  if (u.level === "HIGH") return "urgent_injured";
  if (u.level === "LOW") return "monitoring";
  return "care_needed";
}



const ACTIONS: { icon: string; label: string }[] = [
  { icon: "📤", label: "Share" },
  { icon: "🧭", label: "Navigate" },
  { icon: "📞", label: "Call Rescues" },
  { icon: "➕", label: "Add Update" },
];

function reportedNow(): { stamp: string; minsAgo: number } {
  const d = new Date();
  return {
    stamp: d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }),
    minsAgo: 0,
  };
}

export function RescueReport({
  image,
  data,
  mission,
  onContinue,
}: {
  image: string;
  data: Assessment;
  mission: MissionId;
  onContinue: () => void;
}) {
  const [tab, setTab] = useState<"story" | "vet">("story");
  const m = MISSIONS[mission];
  const ribbonKey = useMemo(() => pickRibbon(data, mission), [data, mission]);
  const r = RIBBONS[ribbonKey];
  const isCalm = ribbonKey === "monitoring";
  const isUrgent = ribbonKey === "urgent_injured" || ribbonKey === "at_risk";
  const isWildlife = mission === "wildlife";
  const { stamp, minsAgo } = useMemo(reportedNow, []);


  const reportType =
    ribbonKey === "urgent_injured"
      ? "Injury"
      : ribbonKey === "at_risk"
        ? "At-risk shelter"
        : ribbonKey === "wildlife"
          ? "Wildlife"
          : data.is_likely_pet
            ? "Pet check-in"
            : "Stray";

  return (
    <div className="min-h-[100dvh] bg-background pb-32">
      <div className="mx-auto w-full max-w-2xl px-5 pt-[max(1rem,env(safe-area-inset-top))]">
        {/* Card */}
        <article className="overflow-hidden rounded-3xl border border-border bg-card shadow-[0_8px_30px_-12px_rgba(60,40,10,0.18)]">
          {/* Ribbon */}
          <div
            className="flex items-center justify-between gap-3 px-4 py-2.5"
            style={{ background: r.gradient, color: r.textOnRibbon }}
          >
            <span className="text-[12px] font-bold uppercase tracking-[0.12em]">{isCalm ? r.label : m.ribbonLabel}</span>
            <span
              className="rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider"
              style={{
                background: "rgba(255,255,255,0.18)",
                color: r.textOnRibbon,
                backdropFilter: "blur(4px)",
              }}
            >
              Just Reported · {minsAgo} min ago
            </span>
          </div>

          {/* Photo */}
          <div className="bg-[oklch(0.96_0.02_85)]">
            <img src={image} alt={data.title} className="aspect-[4/3] w-full object-cover" />
          </div>

          {/* Title block */}
          <div className="px-5 pt-5">
            <h1
              className="font-serif text-[28px] font-bold leading-[1.05] uppercase tracking-tight"
              style={{ color: r.titleColor }}
            >
              {bigTitle(data, ribbonKey)}
            </h1>
            <p className="mt-1 font-serif text-[15px] italic text-muted-foreground">
              {r.subtitle}
            </p>

            {/* Location */}
            <div className="mt-3 flex items-center gap-1.5 text-[15px] font-semibold text-foreground">
              <span>📍</span>
              <span>{locationLine(data)}</span>
            </div>

            {/* Description */}
            <p className="mt-2 text-[14px] italic leading-relaxed text-[oklch(0.45_0.03_70)]">
              {data.first_look}
            </p>
          </div>

          {/* Urgency strip */}
          {!isCalm && (
            <div
              className="mx-5 mt-4 flex items-center gap-2 rounded-xl px-3 py-2 text-[13px] font-medium"
              style={{ background: r.ringBg, color: r.titleColor }}
            >
              <span>⏰</span>
              <span>Help needed within hours · network on standby</span>
            </div>
          )}

          {/* Action row */}
          {!isCalm && (
            <div className="mx-5 mt-3 grid grid-cols-4 gap-2">
              {ACTIONS.map((a) => (
                <button
                  key={a.label}
                  className="flex flex-col items-center gap-1 rounded-xl border border-border bg-background/60 px-2 py-2.5 text-[11px] font-medium text-foreground/85 transition hover:bg-background hover:shadow-sm active:scale-[0.98]"
                >
                  <span className="text-base leading-none">{a.icon}</span>
                  <span>{a.label}</span>
                </button>
              ))}
            </div>
          )}

          {/* Wildlife do-not-handle callout */}
          {isWildlife && (
            <div
              className="mx-5 mt-4 rounded-2xl border-2 px-4 py-3.5"
              style={{ borderColor: m.accent, background: m.accentSoft, color: m.titleColor }}
            >
              <div className="text-[13px] font-bold uppercase tracking-wide">
                🚨 Do not handle
              </div>
              <div className="mt-1 text-[13.5px] leading-relaxed">
                Wildlife should only be handled by licensed rehabbers. Keep distance and use the
                rehabber contacts below.
              </div>
              {data.vet_notes?.clinical && (
                <div className="mt-2 rounded-xl bg-background/70 px-3 py-2 text-[12.5px] text-foreground/80">
                  📞 {data.vet_notes.clinical}
                </div>
              )}
            </div>
          )}

          {/* Primary alert button */}
          {isUrgent && !isWildlife && (
            <div className="mx-5 mt-4">
              <button
                className="w-full rounded-2xl px-5 py-3.5 text-[15px] font-bold uppercase tracking-wide text-white shadow-md transition hover:brightness-105 active:scale-[0.99]"
                style={{ background: m.ribbonGradient }}
              >
                {m.alertButtonLabel}
              </button>
            </div>
          )}

          {/* Role pills */}
          {!isCalm && (
            <div className="mx-5 mt-4">
              <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                How can you help?
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {m.rolePills.map((p) => (
                  <button
                    key={p.label}
                    className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3.5 py-1.5 text-[13px] font-medium shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                    style={{ borderColor: m.accent, color: m.titleColor, background: m.accentSoft }}
                  >
                    <span>{p.icon}</span>
                    <span>{p.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}



          {/* Tabs */}
          <div className="mx-5 mt-5">
            <div className="inline-flex rounded-full border border-border bg-background/70 p-1">
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
                  {k === "story" ? "📖 Story" : "🩺 AI Health Assessment"}
                </button>
              ))}
            </div>

            {tab === "story" ? (
              <div className="mt-4 space-y-4">
                <Section title="AI Health Assessment">{data.first_look}</Section>
                <Section title="Behavior">{data.behavior}</Section>
                <WhereFound data={data} />
                <ResponderBriefing data={data} calm={isCalm} />

                <Section title="What we noticed">
                  {data.noticed.length === 0 ? (
                    <span className="text-muted-foreground">
                      Nothing concerning visible in this image.
                    </span>
                  ) : (
                    <ul className="list-disc space-y-1 pl-5">
                      {data.noticed.map((n, i) => <li key={i}>{n}</li>)}
                    </ul>
                  )}
                </Section>
                <Section title="Suggested next steps">
                  <ul className="space-y-1.5">
                    {data.next_steps.map((n, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="text-[oklch(0.65_0.18_70)]">→</span>
                        <span>{n}</span>
                      </li>
                    ))}
                  </ul>
                </Section>
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                <Section title="Body condition">{data.vet_notes.bcs}</Section>
                <Section title="Observed posture">{data.vet_notes.posture}</Section>
                <Section title="Hydration">{data.vet_notes.hydration}</Section>
                <Section title="Clinical summary">{data.vet_notes.clinical}</Section>
                <Section title="Suggested next steps">
                  <ul className="space-y-1.5">
                    {data.next_steps.map((n, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="text-[oklch(0.65_0.18_70)]">→</span>
                        <span>{n}</span>
                      </li>
                    ))}
                  </ul>
                </Section>
              </div>
            )}
          </div>

          {/* Calm pet callout */}
          {isCalm && (
            <div className="mx-5 mt-5 rounded-2xl border border-[oklch(0.88_0.10_85)] bg-[oklch(0.97_0.05_85)] px-4 py-3 text-sm text-[oklch(0.38_0.08_60)]">
              Heads up — likely a pet at home. No action needed unless something changes.
            </div>
          )}

          {/* Nearby helpers */}
          {isUrgent && (
            <div
              className="mx-5 mt-5 rounded-2xl px-4 py-3"
              style={{ background: r.ringBg, color: r.titleColor }}
            >
              <div className="flex items-center gap-2 text-[14px] font-semibold">
                <span>👥</span>
                <span>Nearby helpers will be notified</span>
              </div>
              <div className="mt-0.5 text-[12.5px] opacity-80">
                Rescues, volunteers &amp; fosters in this area are being alerted.
              </div>
            </div>
          )}

          {/* Footer meta */}
          <div className="mx-5 mt-5 mb-5 border-t border-border pt-3 text-[11.5px] leading-relaxed text-muted-foreground">
            Reported by: <span className="font-medium text-foreground/80">Anonymous</span> · {stamp}
            <br />
            Type: <span className="font-medium text-foreground/80">{reportType}</span> · Visibility:{" "}
            <span className="font-medium text-foreground/80">Public</span>
          </div>
        </article>

        <div className="mt-5 text-center text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          AI is advisory — not a diagnosis
        </div>
      </div>

      {/* Sticky continue */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/95 px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
        <div className="mx-auto flex max-w-2xl justify-end">
          <button
            onClick={onContinue}
            className="rounded-full bg-gradient-to-b from-[oklch(0.90_0.16_85)] to-[oklch(0.78_0.15_70)] px-6 py-2.5 text-sm font-semibold text-[oklch(0.25_0.04_60)] shadow-md transition hover:brightness-105 active:scale-[0.98]"
          >
            Continue →
          </button>
        </div>
      </div>
    </div>
  );
}

function bigTitle(data: Assessment, key: RibbonKey): string {
  const species = (data.species || "animal").toUpperCase();
  const breed = data.breed && !/unknown|mixed/i.test(data.breed) ? data.breed.toUpperCase() : "";
  if (key === "urgent_injured") return `INJURED ${species}`;
  if (key === "at_risk") return `AT-RISK ${species}`;
  if (key === "wildlife") return `WILDLIFE · ${species}`;
  if (key === "care_needed") return breed ? `${breed} · NEEDS CARE` : `${species} · NEEDS CARE`;
  // monitoring / healthy
  return breed ? `HEALTHY ${breed} · RESTING AT HOME` : `HEALTHY ${species} · RESTING AT HOME`;
}

function locationLine(data: Assessment): string {
  // We don't have reverse-geocode here; surface the scene description if it reads like a place.
  const scene = data.location_scene || "";
  const short = scene.split(/[.,]/)[0].trim();
  if (short && short.length < 60) return short;
  return "Location pinned nearby";
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="font-serif text-base font-semibold tracking-tight">{title}</h2>
      <div className="mt-1 text-[14.5px] leading-relaxed text-foreground/85">{children}</div>
    </div>
  );
}

function WhereFound({ data }: { data: Assessment }) {
  const text =
    data.environment_text ||
    data.location_scene ||
    "Only the animal is visible in this frame — limited environmental context.";
  const objects = (data.surrounding_objects || []).filter(Boolean);
  return (
    <div className="rounded-2xl border border-[#E8DCC2] bg-[#FAF8F5] px-4 py-4">
      <div className="flex items-center gap-2">
        <span className="text-base">📍</span>
        <h2 className="font-serif text-base font-semibold tracking-tight">Where we found them</h2>
      </div>
      <p className="mt-2 whitespace-pre-line text-[14.5px] leading-relaxed text-foreground/85">
        {text}
      </p>
      {objects.length > 0 && (
        <div className="mt-3 border-t border-[#E8DCC2] pt-3">
          <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#8A5A0E]">
            In the frame
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {objects.map((o, i) => (
              <span
                key={i}
                className="rounded-full border border-[#E8DCC2] bg-white px-2.5 py-0.5 text-[12px] text-foreground/80"
              >
                {o}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ResponderBriefing({ data, calm }: { data: Assessment; calm: boolean }) {
  if (calm) {
    return (
      <div className="rounded-2xl border-2 border-[#FFD24A]/60 bg-[#FFFBEC] px-4 py-3.5">
        <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#8A5A0E]">
          For the responder
        </div>
        <div className="mt-2 space-y-1 text-[14px] text-foreground/85">
          <div><span className="mr-1">🏠</span> Setting: <span className="font-medium">Home (Indoor)</span></div>
          <div><span className="mr-1">📋</span> No responder action needed — this looks like a domestic pet.</div>
        </div>
      </div>
    );
  }
  const flags =
    data.safety_flags && data.safety_flags.length > 0
      ? data.safety_flags
      : ["None — straightforward approach"];
  return (
    <div className="rounded-2xl border-2 border-[#E89A7A] bg-[#FFF4EE] px-4 py-3.5">
      <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#A8431F]">
        ⚠️ For the responder — what you're walking into
      </div>
      <div className="mt-2.5 space-y-1.5 text-[14px] text-foreground/90">
        <div className="flex gap-2">
          <span>🚧</span>
          <div>
            <div className="text-muted-foreground">Safety flags:</div>
            <ul className="mt-1 space-y-0.5">
              {flags.map((f, i) => (
                <li key={i} className="flex gap-1.5">
                  <span className="text-[#A8431F]">•</span>
                  <span className="font-medium">{f}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
        {data.environment_text && (
          <div className="flex gap-2">
            <span>🎬</span>
            <span>
              <span className="text-muted-foreground">Scene:</span>{" "}
              <span className="font-medium">
                {data.environment_text.split(/(?<=[.!?])\s+/).slice(0, 2).join(" ")}
              </span>
            </span>
          </div>
        )}
        <div className="flex gap-2">
          <span>🏠</span>
          <span><span className="text-muted-foreground">Setting:</span> <span className="font-medium">{data.setting_type}</span></span>
        </div>
        <div className="flex gap-2">
          <span>🪑</span>
          <span><span className="text-muted-foreground">Surface:</span> <span className="font-medium">{data.surface}</span></span>
        </div>
        <div className="flex gap-2">
          <span>💡</span>
          <span><span className="text-muted-foreground">Lighting:</span> <span className="font-medium">{data.lighting_conditions}</span></span>
        </div>
      </div>
      <div className="mt-3 border-t border-[#E89A7A]/40 pt-2 text-[12px] italic text-muted-foreground">
        Voyce gives you the picture before you go. The more you know, the safer the rescue.
      </div>
    </div>
  );
}

