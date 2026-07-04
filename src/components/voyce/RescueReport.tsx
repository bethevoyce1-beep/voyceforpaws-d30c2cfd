import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { Assessment } from "@/lib/analyze.functions";
import { MISSIONS, MONITORING_LAYOUT, type MissionId } from "@/lib/missions";
import { getUrgency } from "@/lib/urgency";
import { getCondition, CONDITION_COLORS, type ConditionInfo } from "@/lib/condition";
import { AIDisclosureBanner } from "@/components/voyce/AIDisclosureBanner";
import { BrandHeader } from "@/components/voyce/BrandHeader";
import { loadTurnstile } from "@/lib/turnstile";
// Turnstile gate removed from this transition (June 30, 2026 polish-list fix).
// Reason: this screen is UI navigation — no data is submitted to the server here.
// Turnstile still runs at the actual submit actions (JoinNetworkModal, signup forms)
// where bot abuse could matter. The old gate was blocking iOS Safari users from
// reaching the Share Card with "Couldn't verify you're human" errors.

import { useLiveAgo, formatTimer } from "@/lib/useLiveAgo";


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
    gradient: "linear-gradient(135deg, #FFDF3B 0%, #C9871A 100%)",
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

function formatStamp(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// Label for the per-animal selector, e.g. "Dog 1", "Cat 2".
function animalLabel(a: Assessment, i: number): string {
  const sp = a.species && a.species !== "none" ? a.species : "Animal";
  return `${sp.charAt(0).toUpperCase()}${sp.slice(1)} ${i + 1}`;
}

export function RescueReport({
  image,
  data,
  mission,
  location,
  situation,
  animals,
  animalIndex = 0,
  onSelectAnimal,
  onContinue,
  onDone,
}: {
  image: string;
  data: Assessment;
  mission: MissionId;
  location?: { lat: number; lon: number; label: string } | null;
  situation?: string;
  animals?: Assessment[];
  animalIndex?: number;
  onSelectAnimal?: (i: number) => void;
  onContinue: () => void;
  onDone?: () => void;
}) {
  const [tab, setTab] = useState<"story" | "vet">("story");
  const [showVet, setShowVet] = useState(false);
  const [shareConfirm, setShareConfirm] = useState(false);
  const [pendingShare, setPendingShare] = useState<SharePlatform | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [sentModal, setSentModal] = useState<null | "online" | "offline">(null);
  const m = MISSIONS[mission];
  const urgency = useMemo(() => getUrgency(data, mission), [data, mission]);
  const condition = useMemo(() => getCondition(data), [data]);
  const reportedAt = useMemo(
    () => data.reportedAt ?? new Date().toISOString(),
    [data.reportedAt],
  );
  const stamp = useMemo(() => formatStamp(reportedAt), [reportedAt]);
  const status = (data as { status?: string }).status;
  const ago = useLiveAgo(reportedAt, status);

  // Warm up the invisible Turnstile script as soon as the report renders,
  // so the silent challenge is ready by the time the user clicks Continue.
  useEffect(() => {
    loadTurnstile().catch((e) => {
      console.warn("[voyce] turnstile preload failed:", e);
    });
  }, []);

  // Polish-list fix (June 30, 2026): Rescue Card → Share Card is pure UI navigation,
  // not a server submit. The previous Turnstile gate here blocked iOS Safari users
  // ("Couldn't verify you're human"). Spam protection still runs at JoinNetworkModal
  // and other real submit points where it's actually useful.
  const handleSubmitReport = () => {
    // Auto-notify the network. Manual sharing is optional — and the fallback
    // when the reporter is offline and we can't reach the network.
    const online = typeof navigator === "undefined" ? true : navigator.onLine;
    setSentModal(online ? "online" : "offline");
  };

  const performShare = (platform: SharePlatform) => {
    const text = buildShareText(data, mission);
    const url = typeof window !== "undefined" ? window.location.href : "";
    const enc = encodeURIComponent;
    let intent = "";
    switch (platform) {
      case "facebook":
        intent = `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}&quote=${enc(text)}`;
        break;
      case "whatsapp":
        intent = `https://wa.me/?text=${enc(text + "\n" + url)}`;
        break;
      case "x":
        intent = `https://twitter.com/intent/tweet?text=${enc(text)}&url=${enc(url)}`;
        break;
      case "nextdoor":
        intent = `https://nextdoor.com/sharekit/?body=${enc(text)}&url=${enc(url)}`;
        break;
      case "copy":
        if (typeof navigator !== "undefined" && navigator.clipboard) {
          void navigator.clipboard.writeText(`${text}\n${url}`);
        }
        return;
    }
    if (typeof window !== "undefined" && intent) {
      window.open(intent, "_blank", "noopener,noreferrer");
    }
  };



  // Monitoring fallback only for non-critical missions where AI judged the
  // animal healthy/low-priority. At-risk-shelter and wildlife always render
  // their mission layout — those missions are inherently action-required.
  const isMonitoringFallback =
    urgency.level === "LOW" &&
    mission !== "at-risk-shelter" &&
    mission !== "wildlife";

  const isWildlife = mission === "wildlife";

  // Resolve ribbon / title-color / callout / mega-CTA / helpers.
  const ribbonLabel = data.status === "Safe"
    ? "✓ SAFE · NO ACTION NEEDED"
    : isMonitoringFallback ? MONITORING_LAYOUT.ribbonLabel : m.ribbonLabel;
  const ribbonGradient = isMonitoringFallback ? MONITORING_LAYOUT.ribbonGradient : m.ribbonGradient;
  const ribbonText = isMonitoringFallback ? MONITORING_LAYOUT.ribbonText : m.ribbonText;
  const titleColor = isMonitoringFallback ? MONITORING_LAYOUT.titleColor : m.titleColor;
  const titleSub = isMonitoringFallback ? MONITORING_LAYOUT.titleSub : m.titleSub;
  const ringBg = isMonitoringFallback ? MONITORING_LAYOUT.ringBg : m.ringBg;

  const ribbonKey: RibbonKey = isMonitoringFallback
    ? "monitoring"
    : mission === "wildlife"
      ? "wildlife"
      : mission === "at-risk-shelter"
        ? "at_risk"
        : mission === "injured"
          ? "urgent_injured"
          : "care_needed";

  const reportType =
    mission === "injured"
      ? "Injury"
      : mission === "at-risk-shelter"
        ? "At-risk shelter"
        : mission === "wildlife"
          ? "Wildlife"
          : mission === "lost-found"
            ? data.is_likely_pet ? "Found pet" : "Lost pet"
            : mission === "prevention"
              ? "Prevention / Care"
              : "Stray";

  // The reporter confirmed the situation in the "Tell us about them" form
  // (pre-filled from Voyce's read), so the card shows that directly.
  const effectiveType = situation || reportType;
  // One Google Maps link, shared by the View Map pill and the Navigate action.
  const mapsUrl = location
    ? `https://www.google.com/maps/search/?api=1&query=${location.lat},${location.lon}`
    : null;

  return (
    <div className="min-h-[100dvh] bg-background pb-32">
      <BrandHeader />
      <AIDisclosureBanner />

      {animals && animals.length > 1 && (
        <div className="mx-auto flex w-full max-w-2xl flex-wrap items-center gap-2 px-5 pt-3">
          <span className="text-[12px] font-semibold text-muted-foreground">
            {animals.length} animals · view each:
          </span>
          {animals.map((a, i) => (
            <button
              key={i}
              type="button"
              onClick={() => onSelectAnimal?.(i)}
              className="rounded-full border-[1.5px] px-3 py-1 text-[12.5px] font-bold transition active:scale-[0.97]"
              style={
                i === animalIndex
                  ? { background: "#FFDF3B", borderColor: "#FFDF3B", color: "#3A2A07" }
                  : { borderColor: "#E6DED0", color: "#8A5A0E", background: "transparent" }
              }
            >
              {animalLabel(a, i)}
            </button>
          ))}
        </div>
      )}

      <div className="mx-auto w-full max-w-2xl px-5 pt-4">

        {/* Card */}
        <article className="overflow-hidden rounded-3xl border border-border bg-card shadow-[0_8px_30px_-12px_rgba(60,40,10,0.18)]">
          {/* Ribbon */}
          <div
            className="flex items-center justify-between gap-3 px-4 py-2.5"
            style={{ background: ribbonGradient, color: ribbonText }}
          >
            <span className="text-[12px] font-bold uppercase tracking-[0.12em]">
              {mission === "at-risk-shelter" && !isMonitoringFallback
                ? <CountdownRibbonLabel />
                : mission === "injured" && !isMonitoringFallback && condition.ribbonOverride
                  ? condition.ribbonOverride
                  : ribbonLabel}
            </span>

            <span
              className="rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider"
              style={{
                background: "rgba(255,255,255,0.18)",
                color: ribbonText,
                backdropFilter: "blur(4px)",
              }}
            >
              {ago.totalSeconds < 60 ? "Just Reported" : "Reported"} · {ago.label.toLowerCase()}
            </span>
          </div>

          {/* Mission Timer */}
          <div className="mx-4 mt-3 flex items-center justify-between gap-3 rounded-2xl border border-[#E8D58A] bg-gradient-to-b from-[#FBF1C8] to-[#F5E3A0] px-4 py-2.5">
            <div className="flex items-center gap-2">
              <span className="text-base">{ago.frozen ? "✅" : "🕐"}</span>
              <div>
                <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#7A5A0E]">
                  {ago.frozen ? "Resolved" : "Mission Timer"}
                </div>
                <div className="text-[10px] leading-tight text-[#8A6A1E]">
                  {ago.frozen
                    ? `Resolved after ${formatTimer(ago.totalSeconds)}`
                    : "Time since this case was reported."}
                </div>
              </div>
            </div>
            <div
              className="rounded-full bg-white/70 px-3 py-1 font-mono text-[15px] font-bold tabular-nums text-[#7A5A0E]"
              aria-live={ago.frozen ? "off" : "polite"}
            >
              {formatTimer(ago.totalSeconds)}
            </div>
          </div>

          {/* Photo */}
          <div className="bg-[oklch(0.96_0.02_85)]">
            <img src={image} alt={data.title} className="aspect-[4/3] w-full object-cover" />
          </div>

          {/* Wildlife top warning (always above title) */}
          {isWildlife && !isMonitoringFallback && m.showTopWarning && (
            <div
              className="mx-5 mt-4 rounded-2xl border-2 px-4 py-3"
              style={{ borderColor: "#D14848", background: "#FCE4E4", color: "#7E1F1F" }}
            >
              <div className="text-[12px] font-bold uppercase tracking-[0.12em]">
                {m.showTopWarning.title}
              </div>
              <div className="mt-1 text-[13px] leading-relaxed">{m.showTopWarning.body}</div>
            </div>
          )}

          {/* At-risk countdown timer (prominent, above title) */}
          {mission === "at-risk-shelter" && !isMonitoringFallback && (
            <div className="mx-5 mt-4">
              <CountdownBlock />
            </div>
          )}

          {/* 3 — Big Title */}
          <div className="px-5 pt-5">
            <h1
              className="font-serif text-[28px] font-bold leading-[1.05] uppercase tracking-tight"
              style={{ color: titleColor }}
            >
              {bigTitle(data, mission, isMonitoringFallback, condition)}
            </h1>

            {/* 4 — Subtitle */}
            <p
              className="mt-1.5 font-serif text-[15px] italic"
              style={{ color: titleColor, opacity: 0.85 }}
            >
              {titleSub}
            </p>

            {/* Urgency pill (compact, deferred under subtitle for visibility) */}
            <div className="mt-2.5">
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12.5px] font-bold uppercase tracking-[0.12em]"
                style={{ background: urgency.soft, color: urgency.deep }}
              >
                <span className="text-muted-foreground/70">Urgency:</span>
                <span>{urgency.emoji} {urgency.label}</span>
              </span>
            </div>

            {/* 5 — Animal profile line */}
            <AnimalProfileLine data={data} condition={condition} />

            {/* 6 — Location */}
            <div className="mt-3 flex flex-wrap items-center gap-x-2.5 gap-y-2 text-[15px] font-semibold text-foreground">
              <span className="flex items-center gap-1.5">
                <span>📍</span>
                <span>{locationLine(data)}</span>
              </span>
              {mapsUrl && (
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-full border-[1.5px] px-3 py-1 text-[12.5px] font-bold no-underline transition active:scale-[0.97]"
                  style={{ borderColor: "#FFDF3B", color: "#8A5A0E", background: "#FFF9E6" }}
                >
                  <span aria-hidden>🗺️</span> View Map
                </a>
              )}
            </div>

            {/* 7 — Description */}
            <p className="mt-2 text-[14px] italic leading-relaxed text-[oklch(0.45_0.03_70)]">
              {data.first_look}
            </p>
          </div>

          {/* 8 — Urgency callout (mission-specific) */}
          {!isMonitoringFallback && (
            <div
              className="mx-5 mt-4 rounded-2xl border-2 px-4 py-3.5"
              style={{
                borderColor: m.callout.border,
                background: m.callout.bg,
                color: m.callout.text,
              }}
            >
              <div className="flex gap-2.5 text-[13.5px] leading-relaxed">
                <span className="text-lg leading-none">{m.callout.emoji}</span>
                <span className="font-medium">{m.callout.body}</span>
              </div>
            </div>
          )}

          {/* Calm callout for monitoring fallback */}
          {isMonitoringFallback && (
            <div className="mx-5 mt-4 rounded-2xl border border-[#E8DCC2] bg-[#FAF8F5] px-4 py-3 text-[13.5px] text-[oklch(0.38_0.08_60)]">
              {MONITORING_LAYOUT.calmCallout}
            </div>
          )}

          {/* 9 — Mega CTA */}
          {!isMonitoringFallback && m.megaCta && (
            <div className="mx-5 mt-4">
              <button
                className="w-full rounded-2xl px-5 py-4 text-[15px] font-bold uppercase tracking-wide shadow-md transition hover:brightness-105 active:scale-[0.99]"
                style={{ background: m.megaCta.gradient, color: m.megaCta.textColor }}
              >
                {m.megaCta.label}
              </button>
            </div>
          )}

          {/* 10 — Action row */}
          {!isMonitoringFallback && (
            <div className="mx-5 mt-3 grid grid-cols-4 gap-2">
              {ACTIONS.map((a) => (
                <button
                  key={a.label}
                  onClick={
                    a.label === "Share"
                      ? () => setShareConfirm(true)
                      : a.label === "Navigate" && mapsUrl
                        ? () => window.open(mapsUrl, "_blank", "noopener,noreferrer")
                        : undefined
                  }
                  className="flex flex-col items-center gap-1 rounded-xl border border-border bg-background/60 px-2 py-2.5 text-[11px] font-medium text-foreground/85 transition hover:bg-background hover:shadow-sm active:scale-[0.98]"
                >
                  <span className="text-base leading-none">{a.icon}</span>
                  <span>{a.label}</span>
                </button>
              ))}
            </div>
          )}

          {/* 11 — "I can help as" divider + role pills */}
          {isMonitoringFallback ? (
            <div className="mx-5 mt-4">
              <button
                onClick={onContinue}
                className="text-[13px] font-medium text-[#8A5A0E] underline-offset-2 hover:underline"
              >
                I picked the wrong photo →
              </button>
            </div>
          ) : (
            <div className="mx-5 mt-5">
              <SectionDivider>I can help as</SectionDivider>
              <div className="mt-3 flex flex-wrap gap-2">
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

          {/* 12 — Share buttons (5 platforms) */}
          {!isMonitoringFallback && (
            <div className="mx-5 mt-5">
              <SectionDivider>
                Or share to get more eyes on {shareName(data)}
              </SectionDivider>
              <div className="mt-3">
                <ShareRow
                  onPick={(p) => {
                    setPendingShare(p);
                    setShareConfirm(true);
                  }}
                />
              </div>
            </div>
          )}


          {/* Rescue Profile (always) + Health Assessment behind a link */}
          <div className="mx-5 mt-5">
            <div className="text-[12px] font-bold uppercase tracking-[0.12em] text-[#8A5A0E]">
              🐾 Rescue Profile
            </div>
            <div className="mt-3 space-y-4">
                <Section title="✨ Voyce's First Look">{data.first_look}</Section>
                <Section title="Behavior">{data.behavior}</Section>
                <WhereFound data={data} />
                <ResponderBriefing data={data} calm={isMonitoringFallback} />

                <Section title="What we noticed">
                  {(data.symptoms && data.symptoms.length > 0
                    ? data.symptoms
                    : data.noticed
                  ).length === 0 ? (
                    <span className="text-muted-foreground">
                      Nothing concerning visible in this image.
                    </span>
                  ) : (
                    <ul className="space-y-1">
                      {(data.symptoms && data.symptoms.length > 0
                        ? data.symptoms
                        : data.noticed
                      ).map((n, i) => (
                        <li key={i} className="flex gap-2">
                          <span style={{ color: CONDITION_COLORS[condition.visibleCondition].dot }}>
                            ✓
                          </span>
                          <span>{n}</span>
                        </li>
                      ))}
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
              <button
                type="button"
                onClick={() => setShowVet((v) => !v)}
                className="mt-4 flex w-full items-center justify-between rounded-xl border border-border bg-background/60 px-4 py-3 text-[13.5px] font-semibold text-[#8A5A0E] transition hover:bg-background active:scale-[0.99]"
              >
                <span>🩺 {showVet ? "Hide health assessment" : "View full health assessment"}</span>
                <span aria-hidden>{showVet ? "▲" : "→"}</span>
              </button>
              {showVet && (
              <div className="mt-4 space-y-4">
                <AIHealthDisclaimer />
                <VisibleConditionPill condition={condition} />
                <Section title="Possible symptoms">
                  {(data.symptoms ?? []).length === 0 ? (
                    <span className="text-muted-foreground">
                      No visible symptoms in this image.
                    </span>
                  ) : (
                    <ul className="space-y-1">
                      {(data.symptoms ?? []).map((s, i) => (
                        <li key={i} className="flex gap-2">
                          <span className="text-[#A8431F]">•</span>
                          <span>{s}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Section>
                <Section title="Body condition">{data.vet_notes.bcs}</Section>
                <Section title="Observed posture">{data.vet_notes.posture}</Section>
                <Section title="Hydration">{data.vet_notes.hydration}</Section>
                <Section title="Clinical summary">{data.vet_notes.clinical}</Section>
                <Section title="Suggested clinical actions">
                  <ul className="space-y-1.5">
                    {(data.clinical_actions && data.clinical_actions.length > 0
                      ? data.clinical_actions
                      : data.next_steps
                    ).map((n, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="text-[oklch(0.65_0.18_70)]">→</span>
                        <span>{n}</span>
                      </li>
                    ))}
                  </ul>
                </Section>
                {(data.differentials ?? []).length > 0 && (
                  <Section title="Differential possibilities">
                    <ul className="space-y-1">
                      {(data.differentials ?? []).map((d, i) => (
                        <li key={i} className="flex gap-2">
                          <span className="text-muted-foreground">↳</span>
                          <span>{d}</span>
                        </li>
                      ))}
                    </ul>
                  </Section>
                )}
              </div>
            )}

          </div>

          {/* 13 — Report details (gray footer block) */}
          <div className="mx-5 mt-5 rounded-2xl bg-muted/40 px-4 py-3.5">
            <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
              Report details
            </div>
            <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[13px]">
              {data.caseId && <ReportRow label="Case #" value={data.caseId} />}
              <ReportRow label="Reported by" value="Reporter (no account)" />
              <ReportRow label="Reported at" value={stamp} />
              <ReportRow label="Type" value={effectiveType} />
              <ReportRow label="Visibility" value="Public" />
              {!isMonitoringFallback &&
                m.extraDetails?.map((d) => (
                  <ReportRow key={d.label} label={d.label} value={d.value} />
                ))}
            </dl>
          </div>

          {/* 14 — Nearby helpers callout */}
          {!isMonitoringFallback && (
            <div
              className="mx-5 mt-4 mb-5 rounded-2xl px-4 py-3"
              style={{ background: ringBg, color: titleColor }}
            >
              <div className="flex items-center gap-2 text-[14px] font-semibold">
                <span>👥</span>
                <span>Closest helpers alerted first</span>
              </div>
              <div className="mt-0.5 text-[12.5px] opacity-85">
                {m.nearbyHelpers}
              </div>
            </div>
          )}

          {isMonitoringFallback && <div className="mb-5" />}
        </article>

        {/* 15 — Pre-launch disclosure */}
        <div className="mt-5 text-center text-[12px] italic text-muted-foreground">
          🐾 Pre-launch · shares grow Voyce. Real alerts launch with the app.
        </div>
        <p className="mx-auto mt-3 max-w-xl text-center text-[12px] italic leading-relaxed text-muted-foreground">
          ⚠️ AI may misidentify breed, age, or condition. AI cannot detect internal injuries,
          disease, parasites, pain, pregnancy, vaccination status, or behavior. Confirm with a vet
          before medical decisions.
        </p>
      </div>


      {/* Sticky continue */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/95 px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
        <div className="mx-auto flex max-w-2xl flex-col items-end gap-1.5">
          {submitError && (
            <div className="text-[12px] font-medium text-[#A8431F]" role="alert">
              {submitError}
            </div>
          )}
          <button
            onClick={handleSubmitReport}
            disabled={submitting}
            className="rounded-full bg-gradient-to-b from-[oklch(0.90_0.16_85)] to-[oklch(0.78_0.15_70)] px-6 py-2.5 text-sm font-semibold text-[oklch(0.25_0.04_60)] shadow-md transition hover:brightness-105 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {submitting ? "Verifying…" : "Send to rescuers"}
          </button>
        </div>
      </div>


      {shareConfirm && (
        <ShareConfirmDialog
          onCancel={() => {
            setShareConfirm(false);
            setPendingShare(null);
          }}
          onConfirm={() => {
            setShareConfirm(false);
            if (pendingShare) performShare(pendingShare);
            setPendingShare(null);
          }}
        />

      )}
      {sentModal && (
        <ReportSentDialog
          offline={sentModal === "offline"}
          onShare={() => {
            setSentModal(null);
            onContinue();
          }}
          onDone={() => {
            setSentModal(null);
            (onDone ?? onContinue)();
          }}
        />
      )}
    </div>
  );
}

// ---- Mission-specific helpers ----

function useCountdown(totalSeconds: number) {
  const [remaining, setRemaining] = useState(totalSeconds);
  useEffect(() => {
    const id = setInterval(() => setRemaining((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, []);
  const h = Math.floor(remaining / 3600);
  const mn = Math.floor((remaining % 3600) / 60);
  const s = remaining % 60;
  return { h, m: mn, s };
}

function CountdownRibbonLabel() {
  const { h, m } = useCountdown(23 * 3600 + 47 * 60);
  return <>🚨 CRITICAL: {h}h {m}m LEFT</>;
}

function CountdownBlock() {
  const { h, m, s } = useCountdown(23 * 3600 + 47 * 60);
  return (
    <div
      className="rounded-2xl border-2 px-4 py-3.5 text-center"
      style={{ borderColor: "#D14848", background: "#FCE4E4" }}
    >
      <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#7E1F1F]">
        ⏰ Time until euthanasia
      </div>
      <div className="mt-1 font-serif text-[34px] font-bold leading-none tracking-tight text-[#D14848]">
        {String(h).padStart(2, "0")}h {String(m).padStart(2, "0")}m{" "}
        <span className="text-[22px] opacity-80">{String(s).padStart(2, "0")}s</span>
      </div>
      <div className="mt-1.5 text-[12px] text-[#7E1F1F]/80">
        Every commitment in the network buys time.
      </div>
    </div>
  );
}




function bigTitle(
  data: Assessment,
  mission: MissionId,
  monitoring: boolean,
  condition: ConditionInfo,
): string {
  const species = (data.species || "animal").toUpperCase();
  const breed = data.breed && !/unknown|mixed/i.test(data.breed) ? data.breed.toUpperCase() : "";
  if (monitoring) {
    const who = breed || species;
    if (data.status === "Safe") return `SAFE ${who} · AT HOME`;
    return `HEALTHY ${who} · RESTING AT HOME`;
  }
  const strayPrefix = data.is_likely_pet ? "" : "STRAY ";
  switch (mission) {
    case "injured": {
      const word = condition.titleWord ?? "INJURED";
      return `${word} ${strayPrefix}${species}`.trim();
    }
    case "at-risk-shelter":
      return `AT-RISK SHELTER ${species}`;
    case "lost-found":
      return data.is_likely_pet ? `FOUND ${species}` : `LOST ${species}`;
    case "prevention":
      return breed ? `HEALTHY STRAY · ${breed}` : `HEALTHY STRAY · ${species}`;
    case "wildlife":
      return `WILDLIFE · ${species}`;
  }
}

function AnimalProfileLine({
  data,
  condition,
}: {
  data: Assessment;
  condition: ConditionInfo;
}) {
  const chips = [
    { label: "Species", value: data.species },
    { label: "Breed", value: data.breed },
    { label: "Age", value: data.age },
    { label: "Weight", value: data.weight },
  ].filter((c) => c.value && !/^unknown$/i.test(c.value));
  const conditionChip = condition.primarySign
    ? { label: "Condition", value: condition.primarySign }
    : null;
  if (chips.length === 0 && !conditionChip) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {chips.map((c) => (
        <span
          key={c.label}
          className="inline-flex items-center gap-1 rounded-full border border-border bg-background/60 px-2.5 py-0.5 text-[11.5px] text-foreground/80"
        >
          <span className="text-muted-foreground">{c.label}:</span>
          <span className="font-medium text-foreground/90">{c.value}</span>
        </span>
      ))}
      {conditionChip && (
        <span
          className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11.5px] font-medium"
          style={{
            background: CONDITION_COLORS[condition.visibleCondition].bg,
            color: CONDITION_COLORS[condition.visibleCondition].text,
            borderColor: CONDITION_COLORS[condition.visibleCondition].dot,
          }}
        >
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: CONDITION_COLORS[condition.visibleCondition].dot }}
          />
          {conditionChip.value}
        </span>
      )}
    </div>
  );
}

function VisibleConditionPill({ condition }: { condition: ConditionInfo }) {
  const c = CONDITION_COLORS[condition.visibleCondition];
  return (
    <div className="flex items-center justify-between rounded-2xl border px-4 py-2.5"
      style={{ background: c.bg, borderColor: c.dot, color: c.text }}
    >
      <div className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.dot }} />
        <span className="text-[11px] font-bold uppercase tracking-[0.14em] opacity-80">
          Visible condition
        </span>
      </div>
      <span className="text-[14px] font-bold uppercase tracking-wide">
        {condition.visibleCondition}
      </span>
    </div>
  );
}


function SectionDivider({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="h-px flex-1 bg-border" />
      <span className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
        {children}
      </span>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}

function ReportRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium text-foreground/85">{value}</dd>
    </div>
  );
}

function shareName(data: Assessment): string {
  const breed = data.breed && !/unknown|mixed/i.test(data.breed) ? data.breed : "";
  const species = data.species || "animal";
  return (breed || species).replace(/^\w/, (c) => c.toUpperCase());
}

function buildShareText(data: Assessment, mission: MissionId): string {
  const m = MISSIONS[mission];
  const name = shareName(data);
  const where = locationLine(data);
  const intro =
    mission === "injured"
      ? `🚨 Injured ${name} needs help`
      : mission === "at-risk-shelter"
        ? `🆘 At-risk shelter ${name} needs a foster or rescue pull TODAY`
        : mission === "lost-found"
          ? `🔍 ${data.is_likely_pet ? "Found" : "Lost"} ${name} — help reunite them`
          : mission === "prevention"
            ? `💛 Healthy stray ${name} needs care — spay + vaccines saves litters`
            : `🦝 Wildlife alert: ${name} — licensed rehabber needed`;
  return `${intro}\n📍 ${where}\n\n${data.first_look}\n\n${m.callout.body}\n\nReport via Voyce 🐾`;
}

type SharePlatform = "nextdoor" | "facebook" | "whatsapp" | "x" | "copy";

const SHARE_PLATFORMS: { id: SharePlatform; label: string; icon: string; bg: string; text: string }[] = [
  { id: "nextdoor", label: "Nextdoor", icon: "🏘", bg: "#1F9D57", text: "#FFFFFF" },
  { id: "facebook", label: "Facebook", icon: "📘", bg: "#1877F2", text: "#FFFFFF" },
  { id: "whatsapp", label: "WhatsApp", icon: "💬", bg: "#25D366", text: "#FFFFFF" },
  { id: "x", label: "X", icon: "✕", bg: "#111111", text: "#FFFFFF" },
  { id: "copy", label: "Copy", icon: "📋", bg: "#E5E5E5", text: "#1F1F1F" },
];

function ShareRow({ onPick }: { onPick: (p: SharePlatform) => void }) {
  return (
    <div className="grid grid-cols-5 gap-2">
      {SHARE_PLATFORMS.map((p) => (
        <button
          key={p.id}
          onClick={() => onPick(p.id)}
          className="flex flex-col items-center justify-center gap-1 rounded-xl px-2 py-2.5 text-[11px] font-semibold shadow-sm transition hover:brightness-110 active:scale-[0.97]"
          style={{ background: p.bg, color: p.text }}
          aria-label={`Share to ${p.label}`}
        >
          <span className="text-[15px] leading-none">{p.icon}</span>
          <span>{p.label}</span>
        </button>
      ))}
    </div>
  );
}




function locationLine(data: Assessment): string {
  // We don't have reverse-geocode here; surface the scene description if it reads like a place.
  const scene = data.location_scene || "";
  const short = scene.split(/[.,]/)[0].trim();
  if (short && short.length < 60) return short;
  return "Location pinned nearby";
}

function Section({ title, children }: { title: string; children: ReactNode }) {
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
      <div className="rounded-2xl border-2 border-[#FFDF3B]/60 bg-[#FFFBEC] px-4 py-3.5">
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


function AIHealthDisclaimer() {
  return (
    <div className="rounded-2xl border-2 border-[#E89A7A] bg-[#FFF4EE] px-4 py-4">
      <div className="text-[12px] font-bold uppercase tracking-[0.14em] text-[#A8431F]">
        ⚠️ Voyce's First Look — Honest Limits
      </div>
      <p className="mt-2 text-[13.5px] leading-relaxed text-foreground/85">
        This assessment is generated by computer vision and may be inaccurate. AI cannot:
      </p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-[13.5px] leading-relaxed text-foreground/85">
        <li>Detect internal injuries or diseases</li>
        <li>Diagnose conditions</li>
        <li>Estimate exact age, weight, or breed</li>
        <li>Assess parasites, pain, pregnancy, or vaccination status</li>
        <li>Replace veterinary examination</li>
      </ul>
      <p className="mt-2.5 text-[12.5px] italic leading-relaxed text-[#A8431F]/90">
        Always verify with a licensed veterinarian before any medical, rescue, or transport
        decision. Voyce is not liable for outcomes from acting on this AI assessment.
      </p>
    </div>
  );
}

function ReportSentDialog({
  offline,
  onShare,
  onDone,
}: {
  offline: boolean;
  onShare: () => void;
  onDone: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="voyce-sent-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-10 sm:items-center sm:pb-10"
      onClick={onDone}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-3xl border border-border bg-card p-6 text-center shadow-2xl"
      >
        <div
          className="mx-auto flex h-14 w-14 items-center justify-center rounded-full"
          style={{ background: offline ? "#FBEFD6" : "#E7F6EC" }}
        >
          <span className="text-3xl" aria-hidden>{offline ? "📡" : "✅"}</span>
        </div>
        <h3
          id="voyce-sent-title"
          className="mt-4 font-serif text-xl font-semibold tracking-tight"
        >
          {offline ? "You're offline" : "Report Sent to Rescuers!"}
        </h3>
        <p className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">
          {offline
            ? "We couldn't auto-notify the network. Share manually to reach people nearby — we'll send it automatically once you're back online."
            : "The closest rescuers and NGOs get it first — the alert ripples outward until this animal is helped. Your report is being processed — you'll see it on your home screen shortly."}
        </p>
        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            onClick={offline ? onShare : onDone}
            className="w-full rounded-full py-3 text-[15px] font-bold transition active:scale-[0.99]"
            style={{ background: "#FFDF3B", color: "#3A2A07" }}
          >
            {offline ? "Share now" : "OK"}
          </button>
          <button
            type="button"
            onClick={offline ? onDone : onShare}
            className="w-full rounded-full border border-border bg-background py-2.5 text-[13.5px] font-medium text-foreground transition hover:bg-muted"
          >
            {offline ? "I'll try later" : "Share to spread the word"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ShareConfirmDialog({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="voyce-share-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-10 sm:items-center sm:pb-10"
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-3xl border border-border bg-card p-5 shadow-2xl"
      >
        <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#A8431F]">
          ⚠️ Confirm share
        </div>
        <h3
          id="voyce-share-title"
          className="mt-2 font-serif text-lg font-semibold leading-tight tracking-tight"
        >
          You're about to share this AI-generated rescue card.
        </h3>
        <p className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">
          AI assessments may be inaccurate. Are you sure you want to share?
        </p>
        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition hover:bg-muted"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-full bg-gradient-to-b from-[#FFDF3B] to-[#C9871A] px-4 py-2 text-sm font-semibold text-[#3A2A07] shadow-sm transition hover:brightness-105 active:scale-[0.98]"
          >
            Share anyway
          </button>
        </div>
      </div>
    </div>
  );
}
