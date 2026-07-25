import { createFileRoute } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import type { Assessment } from "@/lib/analyze.functions";
import { getSharedReport, type SharedReport } from "@/lib/share.functions";
import { NetworkResponses } from "@/components/voyce/NetworkResponses";
import { getUrgency } from "@/lib/urgency";
import { getCondition, CONDITION_COLORS } from "@/lib/condition";

// =============================================================
// Public shared rescue-card page (/r/<id>). This is what a recipient of a
// shared link lands on — it shows the exact animal the reporter shared (photo,
// Voyce's First Look, facts, location), then turns that moment into action:
// Join the pack, learn what Voyce for Paws is, and (at launch) donate. No app
// chrome; it's a standalone, link-friendly page that works for anyone.
//
// Parity note (Jul 2026): brought in line with the in-app rescue card so the
// same animal reads the same everywhere — AI observations (incl. tail/body
// language), a compact health read, the environment, an AI-confidence chip, and
// a tap-to-switch when the photo held 2+ animals.
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
    const title = rep ? `${name} needs help · Voyce for Paws` : "Voyce for Paws";
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

// Same urgency + tone mapping the rescue card and Saved tiles use, so the badge
// here always agrees with them. Calm/healthy pets read a green "Stable".
const TONE: Record<string, { badge: string; bg: string; fg: string; title: string }> = {
  critical: { badge: "🚨 Critical", bg: "#7E1F1F", fg: "#FFF1EE", title: "#7E1F1F" },
  urgent:   { badge: "🟠 Urgent",   bg: "#A8431F", fg: "#FFF6F0", title: "#A8431F" },
  care:     { badge: "💛 Needs care", bg: "#8A5A0E", fg: "#FFF9E6", title: "#8A5A0E" },
  calm:     { badge: "✓ Stable",   bg: "#1F6B3D", fg: "#E7F5EC", title: "#1F6B3D" },
  wildlife: { badge: "🦝 Wildlife", bg: "#2C5C7C", fg: "#E4F0F8", title: "#2C5C7C" },
};
function toneKey(mission: string | undefined, level: string): keyof typeof TONE {
  if (mission === "wildlife") return "wildlife";
  if (mission === "at-risk-shelter") return level === "CRITICAL" ? "critical" : "urgent";
  if (level === "CRITICAL") return "critical";
  if (level === "HIGH") return "urgent";
  if (level === "LOW") return "calm";
  return "care";
}
function toneOf(d: Assessment, mission: string | undefined): { badge: string; bg: string; fg: string; title: string } {
  try {
    const u = getUrgency(d);
    return TONE[toneKey(mission, u.level)] ?? TONE.care;
  } catch {
    return TONE.care;
  }
}

function facts(d: Assessment): { label: string; value: string }[] {
  return [
    { label: "Species", value: d.species },
    { label: "Breed", value: d.breed },
    { label: "Age", value: d.age },
    { label: "Size", value: d.size },
    { label: "Color", value: d.color },
    ...(d.ai_confidence ? [{ label: "AI confidence", value: cap(d.ai_confidence) }] : []),
  ].filter((c) => c.value && !/^unknown$/i.test(String(c.value))) as { label: string; value: string }[];
}

// Sticky top nav so there's always a clear way out of the card — Back returns
// to wherever you came from (Saved gallery, a link), Home goes to the app.
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
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#141414] text-[15px]">🐾</span>
        <span className="text-[15px] font-black tracking-tight text-white">Voyce <span className="italic text-[#FFDF3B]">for</span> Paws&trade;</span>
      </a>
      <a href={APP} className="ml-auto inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1.5 text-[13px] font-bold text-white no-underline active:scale-95">
        🏠 Home
      </a>
    </div>
  );
}

// A small labelled block used for the parity sections below.
function MicroLabel({ children }: { children: ReactNode }) {
  return <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#9CA3AF]">{children}</div>;
}

function SharePage() {
  const { report } = Route.useLoaderData();
  const { id } = Route.useParams();
  // When the photo held more than one animal, let the recipient tap between
  // each one's full read on this single card (matches the in-app card).
  const [idx, setIdx] = useState(0);

  if (!report || !report.data) {
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

  const top = report.data;
  // Multiple animals: one card, tap to switch. Falls back to the single animal.
  const animalsList =
    top.animals && top.animals.length > 1 ? top.animals : [top];
  const safeIdx = Math.min(idx, animalsList.length - 1);
  const d = animalsList[safeIdx];
  const multi = animalsList.length > 1;

  const name = animalName(d);
  const T = toneOf(d, report.mission ?? undefined);
  const chips = facts(d);
  const cond = getCondition(d);
  const condColors = CONDITION_COLORS[cond.visibleCondition];
  const obs = Array.isArray(d.observations) ? d.observations.filter(Boolean) : [];
  const symptoms = Array.isArray(d.symptoms) ? d.symptoms.filter(Boolean) : [];
  const objects = Array.isArray(d.surrounding_objects) ? d.surrounding_objects.filter(Boolean) : [];
  const hasHealth =
    symptoms.length > 0 || !!d.vet_notes?.posture || !!d.vet_notes?.bcs ||
    !!d.vet_notes?.hydration || !!d.body_language || cond.visibleCondition !== "Healthy";
  const hasEnv = !!(d.environment_text || d.location_scene || d.setting_type || objects.length);

  // The reporter's location-privacy choice governs what shows publicly:
  // exact = label + map pin; area = coarse label, no map; hidden = nothing.
  const priv = report.loc_privacy ?? "area";
  const loc = report.location?.label ?? "";
  const lat = report.location?.lat;
  const lon = report.location?.lon;
  const mapsUrl = priv === "exact" && typeof lat === "number" && typeof lon === "number"
    ? `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`
    : null;

  return (
    <div className="min-h-[100dvh] bg-[#FBF7EC] pb-16">
      <TopNav />

      <div className="mx-auto w-full max-w-xl px-5 pt-5">
        <article className="overflow-hidden rounded-3xl border border-[#EDE5D8] bg-white shadow-[0_8px_30px_-12px_rgba(60,40,10,0.15)]">
          {/* Photo + urgency */}
          {report.image && (
            <div className="relative bg-[#f2ede2]">
              <img src={report.image} alt={name} className="aspect-[4/3] w-full object-cover" />
              <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-bold uppercase tracking-[0.1em] shadow-sm"
                style={{ background: T.bg, color: T.fg }}>{T.badge}</span>
            </div>
          )}

          <div className="px-5 pt-4">
            {/* Multi-animal switcher — one card, tap between each animal */}
            {multi && (
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="text-[12px] font-semibold text-muted-foreground">
                  {animalsList.length} {(d.species || "animals").toLowerCase()}s in this photo:
                </span>
                {animalsList.map((a, i) => (
                  <button key={i} type="button" onClick={() => setIdx(i)}
                    className="rounded-full border-[1.5px] px-3 py-1 text-[12.5px] font-bold transition active:scale-[0.97]"
                    style={i === safeIdx ? { background: "#FFDF3B", borderColor: "#FFDF3B", color: "#3A2A07" } : { borderColor: "#E6DED0", color: "#8A5A0E" }}>
                    {cap(a.species || "animal")} {i + 1}
                  </button>
                ))}
              </div>
            )}

            <h1 className="font-serif text-[24px] font-bold leading-[1.1]" style={{ color: T.title }}>{name} needs help</h1>
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

            {d.first_look && (
              <div className="mt-3 rounded-2xl border border-[#EDE5D8] bg-[#FBF7EC] px-4 py-3">
                <MicroLabel>✨ Voyce's First Look</MicroLabel>
                <p className="mt-1 text-[13.5px] leading-relaxed text-foreground/85">{d.first_look}</p>
              </div>
            )}

            {/* AI read — quick scannable observations, incl. tail/body language */}
            {obs.length > 0 && (
              <div className="mt-3 rounded-2xl border border-[#EDE5D8] bg-white px-4 py-3">
                <MicroLabel>🔎 What Voyce noticed</MicroLabel>
                <ul className="mt-1.5 grid grid-cols-1 gap-1 text-[13px] leading-relaxed text-foreground/85 sm:grid-cols-2">
                  {obs.slice(0, 8).map((o, i) => (
                    <li key={i} className="flex gap-2"><span className="text-[#C9871A]">•</span><span>{o}</span></li>
                  ))}
                </ul>
                {d.body_language && (
                  <p className="mt-2 rounded-lg bg-[#FBF7EC] px-3 py-2 text-[12.5px] leading-relaxed text-[#6B5832]">
                    <span className="font-semibold">Body language:</span> {d.body_language}
                  </p>
                )}
              </div>
            )}

            {/* Health at a glance — observations only, never a diagnosis */}
            {hasHealth && (
              <div className="mt-3 rounded-2xl border border-[#EDE5D8] bg-white px-4 py-3">
                <MicroLabel>🩺 Health at a glance</MicroLabel>
                <p className="mt-1.5 rounded-lg bg-[#FFFBEB] px-3 py-2 text-[11.5px] italic text-[#8A5A0E] ring-1 ring-[#F3E5B6]">
                  AI observations, not veterinary advice. Always confirm with a vet.
                </p>
                <div className="mt-2 flex items-center justify-between rounded-xl border px-3 py-2"
                  style={{ background: condColors.bg, borderColor: condColors.dot, color: condColors.text }}>
                  <span className="text-[11px] font-bold uppercase tracking-[0.12em] opacity-80">Visible condition</span>
                  <span className="text-[13px] font-bold uppercase">{cond.visibleCondition}</span>
                </div>
                <dl className="mt-2 space-y-1 text-[13px] leading-relaxed text-foreground/85">
                  {symptoms.length > 0 && <FieldRow label="Possible signs">{symptoms.join(", ")}</FieldRow>}
                  {d.vet_notes?.bcs && <FieldRow label="Body condition">{d.vet_notes.bcs}</FieldRow>}
                  {d.vet_notes?.posture && <FieldRow label="Posture &amp; tail">{d.vet_notes.posture}</FieldRow>}
                  {d.vet_notes?.hydration && <FieldRow label="Hydration">{d.vet_notes.hydration}</FieldRow>}
                </dl>
              </div>
            )}

            {/* Where we found them — the environment a rescuer needs */}
            {hasEnv && (
              <div className="mt-3 rounded-2xl border border-[#EDE5D8] bg-white px-4 py-3">
                <MicroLabel>📍 Where we found them</MicroLabel>
                <p className="mt-1.5 whitespace-pre-line text-[13px] leading-relaxed text-foreground/85">
                  {d.environment_text || d.location_scene}
                </p>
                <dl className="mt-2 space-y-1 text-[13px] leading-relaxed text-foreground/85">
                  {d.setting_type && <FieldRow label="Setting">{d.setting_type}</FieldRow>}
                  {d.lighting_conditions && <FieldRow label="Lighting">{d.lighting_conditions}</FieldRow>}
                  {d.weather && !/not visible/i.test(d.weather) && <FieldRow label="Weather">{d.weather}</FieldRow>}
                </dl>
                {objects.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {objects.slice(0, 8).map((o, i) => (
                      <span key={i} className="rounded-full border border-[#EDE5D8] bg-[#FBF7EC] px-2.5 py-0.5 text-[11.5px] text-foreground/80">{o}</span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {Array.isArray(d.next_steps) && d.next_steps.filter(Boolean).length > 0 && (
              <div className="mt-3">
                <MicroLabel>How this one gets saved</MicroLabel>
                <ul className="mt-1.5 space-y-1.5 text-[13.5px] leading-relaxed text-foreground/85">
                  {d.next_steps.filter(Boolean).slice(0, 4).map((n, i) => (
                    <li key={i} className="flex gap-2"><span className="text-[#C9871A]">→</span><span>{n}</span></li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Call to action */}
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

        {/* How the network is responding — the shared ripple for this animal */}
        <div className="mt-5 overflow-hidden rounded-2xl border border-[#EDE5D8] bg-white py-1">
          <NetworkResponses subjectType="report" subjectId={id} animalName={name} />
        </div>

        {/* What is Voyce */}
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

function FieldRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <span className="text-muted-foreground">{label}: </span>
      <span className="text-foreground/90">{children}</span>
    </div>
  );
}
