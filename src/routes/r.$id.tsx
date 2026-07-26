import { createFileRoute } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import type { Assessment } from "@/lib/analyze.functions";
import { getSharedReport, mergeReporterAdded, reporterAddedSummary, type SharedReport, type ReporterAdded } from "@/lib/share.functions";
import { NetworkResponses } from "@/components/voyce/NetworkResponses";
import { getUrgency } from "@/lib/urgency";
import { getCondition, CONDITION_COLORS } from "@/lib/condition";
import { VoyceMark } from "@/components/voyce/VoyceMark";
import { useLiveAgo, formatTimer } from "@/lib/useLiveAgo";

// =============================================================
// Public shared rescue-card page (/r/<id>). Rebuilt to MIRROR the in-app rescue
// card so the same animal reads the same everywhere: honest status-based title,
// the full fact-pill row, a bright count-up timer, photo-taken time, and the
// tap-to-open "More on this animal" pills (AI read, Health, Behavior,
// Environment, Next steps, Case). The only difference from the in-app card is
// the reporter-only "Send to rescuers" is replaced with the public "Join the
// pack" CTA.
//
// Reporter corrections (saved AFTER the link was shared) are folded in here too,
// so the public card updates for everyone: species/age/situation via
// mergeReporterAdded, plus a "Reporter added" summary line.
// =============================================================

const LANDING = "https://voyceforpaws.org";
const APP = "https://app.voyceforpaws.org";

export const Route = createFileRoute("/r/$id")({
  loader: async ({ params }) => {
    const report = await getSharedReport({ data: { id: params.id } });
    return { report };
  },
  head: ({ loaderData }) => {
    const rep = loaderData?.report as SharedReport | null | undefined;
    const d = rep?.data ?? null;
    const name = d ? animalName(d) : "An animal";
    const title = rep ? `${name} · Voyce for Paws` : "Voyce for Paws";
    const desc = d?.first_look
      ? String(d.first_look).slice(0, 180)
      : "A rescue card from Voyce for Paws. Connecting animals in need with the people who can help.";
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  component: SharePage,
});

function cap(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function animalName(d: Assessment): string {
  const breed = d.breed && !/unknown|mixed/i.test(d.breed) ? d.breed : "";
  const s = (breed || d.species || "animal").trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Same urgency + tone mapping the in-app card and Saved tiles use.
const TONE: Record<string, { badge: string; bg: string; fg: string; title: string; ring: string }> = {
  critical: { badge: "🚨 Critical", bg: "#7E1F1F", fg: "#FFF1EE", title: "#7E1F1F", ring: "#F8D7D7" },
  urgent:   { badge: "🟠 Urgent",   bg: "#A8431F", fg: "#FFF6F0", title: "#A8431F", ring: "#FFE4D6" },
  care:     { badge: "💛 Needs care", bg: "#8A5A0E", fg: "#FFF9E6", title: "#8A5A0E", ring: "#FCEFC9" },
  calm:     { badge: "✓ Safe",     bg: "#1F6B3D", fg: "#E7F5EC", title: "#1F6B3D", ring: "#E7F5EC" },
  wildlife: { badge: "🦝 Wildlife", bg: "#2C5C7C", fg: "#E4F0F8", title: "#2C5C7C", ring: "#E4F0F8" },
};
function toneKey(mission: string | undefined, level: string): keyof typeof TONE {
  if (mission === "wildlife") return "wildlife";
  if (mission === "at-risk-shelter") return level === "CRITICAL" ? "critical" : "urgent";
  if (level === "CRITICAL") return "critical";
  if (level === "HIGH") return "urgent";
  if (level === "LOW") return "calm";
  return "care";
}
function toneKeyOf(d: Assessment, mission: string | undefined): keyof typeof TONE {
  try {
    return toneKey(mission, getUrgency(d).level);
  } catch {
    return "care";
  }
}

// Honest, status-based headline — never "needs help" for a settled/safe animal.
function headline(d: Assessment, mission: string | undefined, tk: keyof typeof TONE, name: string): string {
  if (tk === "wildlife") return `Wildlife · ${name}`;
  if (tk === "calm") {
    const atHome = d.is_likely_pet && /home|indoor|domestic|backyard/i.test(d.setting_type || "");
    return atHome ? `${name} · safe at home` : `${name} · safe, no action needed`;
  }
  if (mission === "at-risk-shelter") return `At-risk shelter · ${name}`;
  const sit = (d.suggested_situation || "").trim();
  if (sit) return cap(sit);
  return `${name} needs help`;
}

function facts(d: Assessment): { label: string; value: string }[] {
  const dateStr = d.reportedAt ? new Date(d.reportedAt).toLocaleDateString() : "";
  return [
    { label: "Species", value: d.species },
    { label: "Breed", value: d.breed },
    { label: "Age", value: d.age },
    { label: "Size", value: d.size },
    { label: "Weight", value: d.weight },
    { label: "Color", value: d.color },
    { label: "Case #", value: d.caseId ?? "" },
    { label: "AI confidence", value: d.ai_confidence ? cap(d.ai_confidence) : "" },
    { label: "Reported by", value: "Reporter" },
    { label: "Date", value: dateStr },
  ].filter((c) => c.value && !/^unknown$/i.test(String(c.value))) as { label: string; value: string }[];
}

// Sticky top nav — always a way out (Back + Home).
function TopNav() {
  return (
    <div className="sticky top-0 z-40 flex items-center gap-2 bg-[#0B0B0C] px-3 py-2.5">
      <button
        type="button"
        onClick={() => { if (typeof window !== "undefined") window.history.back(); }}
        className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1.5 text-[13px] font-bold text-white active:scale-95"
      >
        ‹ Back
      </button>
      <a href={APP} className="flex items-center gap-2 no-underline">
        <VoyceMark size={28} />
        <span className="text-[15px] font-black tracking-tight text-white">Voyce <span className="italic text-[#FFDF3B]">for</span> Paws&trade;</span>
      </a>
      <a href={APP} className="ml-auto inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1.5 text-[13px] font-bold text-white no-underline active:scale-95">
        🏠 Home
      </a>
    </div>
  );
}

function MicroLabel({ children }: { children: ReactNode }) {
  return <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#9CA3AF]">{children}</div>;
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <span className="text-muted-foreground">{label}: </span>
      <span className="text-foreground/90">{children}</span>
    </div>
  );
}

function SharePage() {
  const { report } = Route.useLoaderData();
  const { id } = Route.useParams();
  const [idx, setIdx] = useState(0);
  const [openPill, setOpenPill] = useState<string | null>(null);

  const top = report?.data ?? null;
  const animalsList = top && top.animals && top.animals.length > 1 ? top.animals : top ? [top] : [];
  const safeIdx = Math.min(idx, Math.max(0, animalsList.length - 1));
  const rawD = animalsList[safeIdx] ?? null;
  // Fold the reporter's corrections (saved after the link was shared) into the
  // card so the public view updates for everyone — species/age/situation here,
  // plus a "Reporter added" summary line below.
  const reporterAdded = (report?.reporter_added ?? null) as ReporterAdded;
  const d = rawD ? mergeReporterAdded(rawD, reporterAdded) : null;

  // Count-up timer from the photo's own capture time (reportedAt = EXIF taken).
  const reportedAt = (d?.reportedAt) || (report?.created_at ?? new Date().toISOString());
  const ago = useLiveAgo(reportedAt, d?.status);

  if (!report || !report.data || !d) {
    return (
      <div className="min-h-[100dvh] bg-[#FBF7EC]">
        <TopNav />
        <div className="mx-auto flex max-w-md flex-col items-center justify-center gap-4 px-6 pt-24 text-center">
          <div className="text-4xl">🐾</div>
          <h1 className="font-serif text-2xl font-bold text-[#8A5A0E]">This rescue card isn't available</h1>
          <p className="text-[14px] leading-relaxed text-muted-foreground">
            The link may have expired or been mistyped. You can still explore Voyce for Paws.
          </p>
          <div className="flex flex-col gap-2">
            <a href={APP} className="rounded-2xl px-5 py-3 text-[14px] font-bold text-[#3A2A07] shadow" style={{ background: "linear-gradient(135deg,#FFDF3B,#C9871A)" }}>Open Voyce for Paws</a>
            <a href={LANDING} className="text-[13px] font-semibold text-[#8A5A0E] underline-offset-2 hover:underline">What is Voyce for Paws? →</a>
          </div>
        </div>
      </div>
    );
  }

  const multi = animalsList.length > 1;
  const name = animalName(d);
  const mission = report.mission ?? undefined;
  const tk = toneKeyOf(d, mission);
  const T = TONE[tk];
  const title = headline(d, mission, tk, name);
  const urgency = (() => { try { return getUrgency(d); } catch { return null; } })();
  const cond = getCondition(d);
  const condColors = CONDITION_COLORS[cond.visibleCondition];
  const chips = facts(d);
  const raSummary = reporterAddedSummary(reporterAdded);
  const obs = Array.isArray(d.observations) ? d.observations.filter(Boolean) : [];
  const symptoms = Array.isArray(d.symptoms) ? d.symptoms.filter(Boolean) : [];
  const objects = Array.isArray(d.surrounding_objects) ? d.surrounding_objects.filter(Boolean) : [];
  const takenStr = d.reportedAt
    ? new Date(d.reportedAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
    : "";

  // The reporter's location-privacy choice governs what shows publicly.
  const priv = report.loc_privacy ?? "area";
  const loc = report.location?.label ?? "";
  const lat = report.location?.lat;
  const lon = report.location?.lon;
  // View map is consistent: a pin for exact-privacy cards with coordinates, a
  // general-AREA map (search of the area label) for everything else that has a
  // location, and nothing only when the finder chose Hidden or there's no
  // location at all. So the button appears reliably without exposing the exact
  // spot unless the reporter chose to.
  const mapsUrl =
    priv === "hidden"
      ? null
      : priv === "exact" && typeof lat === "number" && typeof lon === "number"
        ? `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`
        : loc
          ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(loc)}`
          : typeof lat === "number" && typeof lon === "number"
            ? `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`
            : null;

  // Tap-to-open detail pills — same set as the in-app card.
  const pills: { id: string; icon: string; label: string; render: () => ReactNode }[] = [];
  if (obs.length > 0) {
    pills.push({ id: "obs", icon: "🔎", label: "AI read", render: () => (
      <ul className="space-y-1 text-[13.5px] leading-relaxed text-foreground/85">
        {obs.slice(0, 8).map((o, i) => (<li key={i} className="flex gap-2"><span className="text-[#C9871A]">•</span><span>{o}</span></li>))}
        {d.body_language && <li className="mt-1 flex gap-2"><span className="text-[#C9871A]">•</span><span>{d.body_language}</span></li>}
      </ul>
    ) });
  }
  pills.push({ id: "health", icon: "🩺", label: "Health", render: () => (
    <div className="space-y-2 text-[13.5px] leading-relaxed text-foreground/85">
      <p className="rounded-lg bg-[#FFFBEB] px-3 py-2 text-[12px] italic text-[#8A5A0E] ring-1 ring-[#F3E5B6]">AI observations, not veterinary advice. Confirm with a vet.</p>
      <div className="flex items-center justify-between rounded-xl border px-3 py-2" style={{ background: condColors.bg, borderColor: condColors.dot, color: condColors.text }}>
        <span className="text-[11px] font-bold uppercase tracking-[0.12em] opacity-80">Visible condition</span>
        <span className="text-[13px] font-bold uppercase">{cond.visibleCondition}</span>
      </div>
      {symptoms.length > 0
        ? <Field label="Possible signs">{symptoms.join(", ")}</Field>
        : <Field label="Possible signs">No visible symptoms in this image.</Field>}
      {d.vet_notes?.bcs && <Field label="Body condition">{d.vet_notes.bcs}</Field>}
      {d.vet_notes?.posture && <Field label="Posture &amp; tail">{d.vet_notes.posture}</Field>}
      {d.vet_notes?.hydration && <Field label="Hydration">{d.vet_notes.hydration}</Field>}
      {d.vet_notes?.clinical && <Field label="Summary (not a diagnosis)">{d.vet_notes.clinical}</Field>}
    </div>
  ) });
  if (d.behavior) {
    pills.push({ id: "behavior", icon: "🐾", label: "Behavior", render: () => (
      <p className="text-[13.5px] leading-relaxed text-foreground/85">{d.behavior}</p>
    ) });
  }
  pills.push({ id: "env", icon: "🌤", label: "Environment", render: () => (
    <div className="space-y-2 text-[13.5px] leading-relaxed text-foreground/85">
      <p className="whitespace-pre-line">{d.environment_text || d.location_scene || "Limited environmental context in this frame."}</p>
      {d.setting_type && <Field label="Setting">{d.setting_type}</Field>}
      {d.lighting_conditions && <Field label="Lighting">{d.lighting_conditions}</Field>}
      {d.weather && !/not visible/i.test(d.weather) && <Field label="Weather">{d.weather}</Field>}
      {objects.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {objects.slice(0, 8).map((o, i) => (<span key={i} className="rounded-full border border-[#EDE5D8] bg-white px-2.5 py-0.5 text-[12px] text-foreground/80">{o}</span>))}
        </div>
      )}
    </div>
  ) });
  if (Array.isArray(d.next_steps) && d.next_steps.filter(Boolean).length > 0) {
    pills.push({ id: "next", icon: "✅", label: "Next steps", render: () => (
      <ul className="space-y-1.5 text-[13.5px] leading-relaxed text-foreground/85">
        {d.next_steps!.filter(Boolean).slice(0, 5).map((n, i) => (<li key={i} className="flex gap-2"><span className="text-[#C9871A]">→</span><span>{n}</span></li>))}
      </ul>
    ) });
  }
  pills.push({ id: "case", icon: "📋", label: "Case", render: () => (
    <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[12.5px]">
      {d.caseId && <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Case #</dt><dd className="text-right font-medium">{d.caseId}</dd></div>}
      {takenStr && <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Reported</dt><dd className="text-right font-medium">{takenStr}</dd></div>}
      {d.ai_confidence && <div className="flex justify-between gap-2"><dt className="text-muted-foreground">AI confidence</dt><dd className="text-right font-medium">{cap(d.ai_confidence)}</dd></div>}
      {mission && <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Type</dt><dd className="text-right font-medium">{cap(mission.replace(/-/g, " "))}</dd></div>}
    </dl>
  ) });

  return (
    <div className="min-h-[100dvh] bg-[#FBF7EC] pb-16">
      <TopNav />

      {/* Pre-launch honesty banner — a stranger opening a shared link must know
          this is a test, not a real animal awaiting rescue right now, and how to
          get real help if they ARE on a live animal. */}
      <div className="mx-auto w-full max-w-xl px-5 pt-4">
        <div className="rounded-2xl border border-[#F0C88A] bg-[#FFF6E5] px-4 py-3 text-center">
          <div className="text-[12.5px] font-bold text-[#8A5A0E]">🧪 Pre-launch test — not a live rescue</div>
          <p className="mt-1 text-[11.5px] leading-relaxed text-[#6B5832]">
            Voyce for Paws hasn't launched yet. This is a demo card made during testing — the animal and details may not be real, and no rescuers are being alerted. <span className="font-semibold">Is this a real animal that needs help right now?</span> Contact your local animal control, an emergency vet, or a nearby animal shelter or rescue (a wildlife rehabber for wildlife) — or text/call <a href="tel:+13306214361" className="font-semibold text-[#8A5A0E] underline">(330) 621-4361</a> or email <a href="mailto:info@bethevoyce.org" className="font-semibold text-[#8A5A0E] underline">info@bethevoyce.org</a>.
          </p>
        </div>
      </div>

      <div className="mx-auto w-full max-w-xl px-5 pt-5">
        <article className="overflow-hidden rounded-3xl border border-[#EDE5D8] bg-white shadow-[0_8px_30px_-12px_rgba(60,40,10,0.15)]">
          {report.image && (
            <div className="relative bg-[#f2ede2]">
              <img src={report.image} alt={name} className="aspect-[4/3] w-full object-cover" />
              <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-bold uppercase tracking-[0.1em] shadow-sm"
                style={{ background: T.bg, color: T.fg }}>{T.badge}</span>
              {/* Bright, high-contrast count-up timer, top-right so it reads on any photo */}
              <span className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-extrabold tabular-nums shadow-lg ring-1 ring-black/10"
                style={{ background: ago.frozen ? "#1F6B3D" : "#FFDF3B", color: ago.frozen ? "#fff" : "#1A1611" }}
                title={ago.frozen ? "Time to rescue" : "Time since the photo was taken"}>
                {ago.frozen ? "✅" : "⏱"} {formatTimer(ago.totalSeconds)}
              </span>
              {/* Authenticity warning ON the image — same as the in-app card, so
                  a stranger opening a shared link is warned if the photo reads as
                  likely stock / a screenshot / AI-generated. */}
              {d.capture_authenticity === "likely_stock" && (
                <div className="absolute inset-x-0 bottom-0 flex items-start gap-1.5 bg-[#7E1F1F]/92 px-3 py-2 text-[11px] font-bold leading-snug text-white">
                  <span aria-hidden className="mt-[1px]">⚠</span>
                  <span>This photo may not be real (it could be AI-generated, stock, or a screenshot). Verify a live animal really needs help before acting.{d.authenticity_reason ? ` — ${d.authenticity_reason}` : ""}</span>
                </div>
              )}
            </div>
          )}

          <div className="px-5 pt-4">
            {multi && (
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="text-[12px] font-semibold text-muted-foreground">{animalsList.length} {(d.species || "animals").toLowerCase()}s in this photo:</span>
                {animalsList.map((a, i) => (
                  <button key={i} type="button" onClick={() => { setIdx(i); setOpenPill(null); }}
                    className="rounded-full border-[1.5px] px-3 py-1 text-[12.5px] font-bold transition active:scale-[0.97]"
                    style={i === safeIdx ? { background: "#FFDF3B", borderColor: "#FFDF3B", color: "#3A2A07" } : { borderColor: "#E6DED0", color: "#8A5A0E" }}>
                    {cap(a.species || "animal")} {i + 1}
                  </button>
                ))}
              </div>
            )}

            <h1 className="font-serif text-[24px] font-bold leading-[1.1]" style={{ color: T.title }}>{title}</h1>

            {urgency && (
              <div className="mt-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-bold uppercase tracking-[0.1em]"
                style={{ background: urgency.soft, color: urgency.deep }}>
                <span className="text-muted-foreground/70">Urgency:</span><span>{urgency.emoji} {urgency.label}</span>
              </div>
            )}

            {takenStr && (
              <div className="mt-2 text-[12px] font-medium text-muted-foreground">📷 Photo taken {takenStr}</div>
            )}

            {priv === "hidden" ? (
              <div className="mt-2 text-[13px] font-semibold text-[#5A3E12]">📍 Location shared privately with rescuers</div>
            ) : loc ? (
              <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-2 text-[14px] font-semibold text-[#5A3E12]">
                <span className="flex items-center gap-1.5"><span>📍</span><span>{loc}</span></span>
                {mapsUrl && (
                  <a href={mapsUrl} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-[12px] font-bold text-white no-underline shadow-sm"
                    style={{ background: "#2563EB" }}>🗺 View map</a>
                )}
              </div>
            ) : null}

            {chips.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {chips.map((c) => (
                  <span key={c.label} className="inline-flex items-center gap-1 rounded-full border border-[#EDE5D8] bg-white px-2.5 py-0.5 text-[11.5px] text-foreground/80">
                    <span className="text-muted-foreground">{c.label}:</span><span className="font-medium">{c.value}</span>
                  </span>
                ))}
              </div>
            )}

            {report.note && (
              <div className="mt-3 rounded-2xl border border-[#F0C88A] bg-[#FFF6E5] px-4 py-3">
                <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#8A5A0E]">✍️ From the person who found them</div>
                <p className="mt-1 whitespace-pre-line text-[13.5px] leading-relaxed text-[#5A3E12]">{report.note}</p>
              </div>
            )}

            {raSummary && (
              <div className="mt-3 rounded-2xl border border-[#F0C88A] bg-[#FFF9EC] px-4 py-3">
                <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#8A5A0E]">✏️ Reporter added</div>
                <p className="mt-1 text-[13.5px] leading-relaxed text-[#5A3E12]">{raSummary}</p>
              </div>
            )}

            {d.first_look && (
              <p className="mt-3 text-[13.5px] italic leading-relaxed text-[oklch(0.45_0.03_70)]">{d.first_look}</p>
            )}

            {/* More on this animal — tap-to-open pills, same as the in-app card */}
            {pills.length > 0 && (
              <div className="mt-3">
                <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#9CA3AF]">More on this animal</div>
                <div className="flex flex-wrap gap-1.5">
                  {pills.map((p) => {
                    const on = openPill === p.id;
                    return (
                      <button key={p.id} type="button" onClick={() => setOpenPill(on ? null : p.id)} aria-expanded={on}
                        className="inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-[12.5px] font-semibold transition active:scale-95"
                        style={on ? { background: "#1A1611", color: "#FFDF3B", borderColor: "#1A1611" } : { background: "#fff", color: "#6B5832", borderColor: "#E3DAC4" }}>
                        <span>{p.icon}</span><span>{p.label}</span>
                      </button>
                    );
                  })}
                </div>
                {openPill && (
                  <div className="mt-3 rounded-2xl border border-[#EDE5D8] bg-white px-4 py-3.5">
                    {pills.find((p) => p.id === openPill)!.render()}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Voyce's First Look — Honest Limits. Same prominent liability shield
              as the in-app card, so a stranger opening a shared link sees it too. */}
          <div className="mx-5 mt-4 rounded-2xl bg-[#1A1611] px-4 py-4">
            <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#FFDF3B]">⚠️ Voyce's First Look — Honest Limits</div>
            <p className="mt-2 text-[12.5px] leading-relaxed text-[#F4E7C6]">
              These are AI observations and suggestions — not veterinary advice, a diagnosis, or a treatment plan. Always confirm with a licensed veterinarian. This is generated by computer vision and may be inaccurate. AI cannot:
            </p>
            <ul className="mt-2 space-y-1 text-[12.5px] leading-relaxed text-[#F4E7C6]">
              <li className="flex gap-2"><span aria-hidden>•</span><span>Detect internal injuries or diseases</span></li>
              <li className="flex gap-2"><span aria-hidden>•</span><span>Diagnose conditions</span></li>
              <li className="flex gap-2"><span aria-hidden>•</span><span>Estimate exact age, weight, or breed</span></li>
              <li className="flex gap-2"><span aria-hidden>•</span><span>Assess parasites, pain, pregnancy, or vaccination status</span></li>
              <li className="flex gap-2"><span aria-hidden>•</span><span>Replace veterinary examination</span></li>
            </ul>
            <p className="mt-2 text-[12px] italic leading-relaxed text-[#E9C55A]">
              Always verify with a licensed veterinarian before any medical, rescue, or transport decision. Voyce is not liable for outcomes from acting on this AI assessment.
            </p>
          </div>

          {/* Public CTA — where the in-app card has 'Send to rescuers' */}
          <div className="mx-5 mt-5 mb-5 rounded-2xl border border-[#F0C88A] bg-[#FFF6E5] px-4 py-4">
            <div className="text-[13px] font-bold text-[#8A5A0E]">💛 You can help save {name}, and the next one</div>
            <p className="mt-1 text-[12.5px] leading-relaxed text-[#6B5832]">
              Voyce for Paws alerts the closest rescuers first, then ripples outward until an animal is safe. Join the pack to foster, adopt, transport, or just share the next alert.
            </p>
            <div className="mt-3 flex flex-col gap-2">
              <a href={LANDING} className="w-full rounded-2xl px-5 py-3 text-center text-[14px] font-bold text-[#3A2A07] no-underline shadow transition hover:brightness-105"
                style={{ background: "linear-gradient(135deg,#FFDF3B,#C9871A)" }}>🐾 Join the pack</a>
              <a href={APP} className="w-full rounded-2xl border border-[#C9871A] bg-white px-5 py-2.5 text-center text-[13.5px] font-semibold text-[#8A5A0E] no-underline">
                Open Voyce for Paws →
              </a>
            </div>
            <p className="mt-2.5 text-center text-[11px] italic text-[#8A5A0E]">
              We're a 501(c)(3) · donations open at launch. Join the pack to be first.
            </p>
          </div>
        </article>

        {/* How the network is responding — shared live ripple */}
        <div className="mt-5 overflow-hidden rounded-2xl border border-[#EDE5D8] bg-white py-1">
          <NetworkResponses subjectType="report" subjectId={id} animalName={name} showJoinCta={false} />
        </div>

        <div className="mt-5 rounded-2xl border border-[#EDE5D8] bg-white px-5 py-4">
          <h2 className="font-serif text-[16px] font-bold text-[#0B0B0C]">What is Voyce for Paws?</h2>
          <p className="mt-1.5 text-[13px] leading-relaxed text-foreground/80">
            A nonprofit rescue network. Snap or upload a photo of a stray, injured, or at-risk animal and Voyce's AI builds a rescue card in seconds, then alerts the closest fosters, rescues, and adopters, rippling outward until the animal is safe.
          </p>
          <a href={LANDING} className="mt-2 inline-block text-[13px] font-semibold text-[#8A5A0E] underline-offset-2 hover:underline">Learn more at voyceforpaws.org →</a>
        </div>

        <p className="mx-auto mt-4 max-w-lg text-center text-[11px] italic leading-relaxed text-muted-foreground">
          ⚠️ Voyce shares AI observations, not veterinary advice. AI may misidentify breed, age, or condition. Confirm with a licensed veterinarian before any medical, rescue, or transport decision.
        </p>
        <p className="mx-auto mt-2 max-w-lg text-center text-[10.5px] leading-relaxed text-muted-foreground">
          &copy; 2026 Be the Voyce, Inc. &middot; Voyce for Paws&trade; is a trademark of Be the Voyce, Inc.
        </p>
      </div>
    </div>
  );
}
