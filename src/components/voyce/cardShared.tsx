import type { Assessment } from "@/lib/analyze.functions";
import type { CaseMeta } from "@/lib/share.functions";

// =============================================================
// cardShared — ONE source of truth for the rescue card's content pieces that
// must read identically in the in-app card (RescueCard) and the public shared
// card (/r/<id>). Edit the copy or logic here once and BOTH cards update, so
// they can never drift apart again. Purely presentational / pure helpers — no
// data fetching, no reporter-only tooling.
// =============================================================

function cap(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

// A short, honest "Type" label for the top facts row — derived from what the AI
// already read (mission + status + whether it's a pet + where it is).
export function caseTypeLabel(d: Assessment, mission?: string): string {
  const pet = !!d.is_likely_pet;
  const urgent = (d.status || "") === "Urgent";
  const home = /home|indoor|backyard|domestic/i.test(d.setting_type || "");
  if (mission === "wildlife") return "Wildlife";
  if (mission === "at-risk-shelter") return "At-risk shelter";
  if (mission === "lost-found") return pet ? "Found pet" : "Lost pet";
  if (urgent) return pet ? "Injured pet" : "Injured stray";
  if (pet && home) return "Pet at home";
  if (pet) return "Lost / found pet";
  return "Stray — needs care";
}

// Short, scannable "what Voyce saw" chips pulled from the AI read: its own
// observations, plus the setting and the top next-step, deduped and clipped.
export function seenChipsFrom(d: Assessment): string[] {
  const out: string[] = [];
  const add = (v?: string) => {
    const t = (v || "").trim();
    if (t && t.length <= 42 && !out.some((x) => x.toLowerCase() === t.toLowerCase())) out.push(t);
  };
  (Array.isArray(d.observations) ? d.observations : []).forEach(add);
  add(d.setting_type);
  if (Array.isArray(d.next_steps) && d.next_steps[0]) add(d.next_steps[0]);
  return out.slice(0, 7);
}

// Keep cap exported in case a card needs it from the shared module.
export { cap };

// Make a user-typed URL safe to link: add https:// when there's no scheme, and
// refuse anything that isn't a plain http(s) link.
function normHref(u: string): string {
  const t = (u || "").trim();
  if (!t) return "";
  if (/^https?:\/\//i.test(t)) return t;
  if (/^(mailto:|tel:)/i.test(t)) return t;
  if (/^[\w.-]+@[\w.-]+\.\w+$/.test(t)) return `mailto:${t}`;
  return `https://${t.replace(/^\/+/, "")}`;
}

// CaseMetaBlock — the new "where / who / how to help" panel. Renders ONLY when
// case_meta has something to show, so a photo-only card is untouched. Lean by
// design: a big origin line, a compact "Contact <rescue>" row of links, and a
// small Source link. Used by BOTH the in-app card and the public /r/<id> page
// so they can't drift.
export function CaseMetaBlock({ cm, className = "" }: { cm: CaseMeta; className?: string }) {
  if (!cm) return null;
  const origin = cm.origin || null;
  const rescue = cm.rescue || null;

  const originCityState = [origin?.city, origin?.state].filter(Boolean).join(", ");
  const originLine = [origin?.shelter_name, originCityState].filter(Boolean).join(" · ");

  const rescueLinks: { key: string; label: string; href: string }[] = [];
  if (rescue) {
    if (rescue.url) rescueLinks.push({ key: "url", label: "Website", href: normHref(rescue.url) });
    if (rescue.facebook) rescueLinks.push({ key: "fb", label: "Facebook", href: normHref(rescue.facebook) });
    const mail = (rescue.email || "").trim();
    if (mail) rescueLinks.push({ key: "email", label: mail, href: `mailto:${mail}` });
    const tel = (rescue.phone || "").trim();
    if (tel) rescueLinks.push({ key: "phone", label: tel, href: `tel:${tel.replace(/[^\d+]/g, "")}` });
  }
  const rescueName = (rescue?.name || "").trim();
  const hasRescue = !!(rescueName || rescueLinks.length);

  const source = (cm.source_url || "").trim();
  const ask = (cm.ask || "").trim();
  const deadline = (cm.deadline || "").trim();

  if (!originLine && !hasRescue && !source && !ask && !deadline) return null;

  return (
    <div className={`rounded-2xl border border-[#EDE5D8] bg-[#FBF7EC] px-4 py-3.5 ${className}`}>
      {originLine && (
        <div className="text-[15px] font-bold leading-tight text-[#5A3E12]">
          <span aria-hidden>📍 </span>At {originLine}
        </div>
      )}

      {(ask || deadline) && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {ask && (
            <span className="inline-flex items-center gap-1 rounded-full border border-[#E8C97A] bg-[#FBF1C8] px-2.5 py-0.5 text-[11.5px] font-bold text-[#7A5A0A]">
              🙏 {cap(ask)}
            </span>
          )}
          {deadline && (
            <span className="inline-flex items-center gap-1 rounded-full border border-[#F0C0A0] bg-[#FDECE2] px-2.5 py-0.5 text-[11.5px] font-bold text-[#A8431F]">
              ⏳ {deadline}
            </span>
          )}
        </div>
      )}

      {hasRescue && (
        <div className="mt-3">
          <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#8A5A0E]">
            Contact {rescueName || "the rescue"}
          </div>
          {rescueLinks.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {rescueLinks.map((l) => (
                <a
                  key={l.key}
                  href={l.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex max-w-full items-center gap-1 truncate rounded-full border border-[#C9871A] bg-white px-3 py-1 text-[12.5px] font-semibold text-[#8A5A0E] no-underline transition active:scale-[0.97]"
                >
                  {l.label}
                </a>
              ))}
            </div>
          )}
        </div>
      )}

      {source && (
        <a
          href={normHref(source)}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-block text-[12px] font-semibold text-[#8A5A0E] underline-offset-2 hover:underline"
        >
          🔗 Source post
        </a>
      )}
    </div>
  );
}

// The three safety notes, in order, read BEFORE responding: Voyce's First Look
// honest limits, the pre-launch "is this a real animal" contact, and Stay safe
// anti-scam. Margin-agnostic (parent controls outer spacing) so it drops into
// both cards unchanged.
export function SafetyNotes() {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-[#1A1611] px-4 py-4">
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

      <div className="rounded-2xl border border-[#F0C88A] bg-[#FFF6E5] px-4 py-3">
        <div className="text-[12.5px] font-bold text-[#8A5A0E]">🐾 Is this a real animal that needs help right now?</div>
        <p className="mt-1 text-[12px] leading-relaxed text-[#6B5832]">
          Voyce isn't live yet — we can't alert responders until the pack grows in your area. For a real animal, contact your local <span className="font-semibold">animal control</span>, an <span className="font-semibold">emergency vet</span>, or a nearby <span className="font-semibold">animal shelter or rescue</span> — and a <span className="font-semibold">wildlife rehabber</span> for wildlife. You can also text or call <a href="tel:+13306214361" className="font-semibold text-[#8A5A0E] underline">(330) 621-4361</a> or email <a href="mailto:info@bethevoyce.org" className="font-semibold text-[#8A5A0E] underline">info@bethevoyce.org</a>.
        </p>
        <p className="mt-1 text-[10.5px] italic text-[#8A5A0E]">Pre-launch testing contact.</p>
      </div>

      <div className="rounded-2xl border border-[#D8CEB8] bg-[#FBF7EC] px-4 py-3">
        <div className="text-[12.5px] font-bold text-[#5A3E12]">🛡️ Stay safe</div>
        <p className="mt-1 text-[12px] leading-relaxed text-[#6B5832]">
          Voyce connects people who don't know each other. Before you act: meet in a <span className="font-semibold">public place</span>, bring someone if you can, and <span className="font-semibold">never send money or pledges</span> to anyone you haven't verified. Confirm the animal and the person are real before you travel or hand anything over — scams and unsafe meetups do happen, so trust your gut.
        </p>
      </div>
    </div>
  );
}

// The single combined confirm that the reader saw the AI limits + safety notes.
// Soft-gates the "how the pack responds" actions. Parent supplies width/margin
// via className.
export function ConfirmGate({ ok, onToggle, className = "" }: { ok: boolean; onToggle: () => void; className?: string }) {
  return (
    <button type="button" onClick={onToggle} aria-pressed={ok}
      className={`flex items-center gap-2.5 rounded-2xl border px-4 py-3 text-left transition active:scale-[0.99] ${className}`}
      style={ok ? { borderColor: "#1F6B3D", background: "#EAF5EC" } : { borderColor: "#C9871A", background: "#FFF9EC" }}>
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border text-[13px] font-bold"
        style={ok ? { background: "#1F6B3D", borderColor: "#1F6B3D", color: "#fff" } : { borderColor: "#C9A24A", color: "transparent" }}>✓</span>
      <span className="text-[12.5px] font-semibold" style={{ color: ok ? "#1F6B3D" : "#8A5A0E" }}>
        {ok ? "Thanks — you can respond below." : "I understand Voyce's AI can be wrong, and I'll follow the safety tips before acting."}
      </span>
    </button>
  );
}

// Open Google Maps directions TO the animal, pre-filling the viewer's CURRENT
// location as the starting point so they never have to type an address. We
// open a blank tab synchronously on the click (so the popup isn't blocked),
// then redirect it once we have coords. If location is denied/unavailable,
// Maps still opens and uses the device's own current location as the origin.
export function openDirections(lat: number, lon: number) {
  const dest = `${lat},${lon}`;
  const w = typeof window !== "undefined" ? window.open("about:blank", "_blank") : null;
  const go = (origin: string | null) => {
    const u = origin
      ? `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}&travelmode=driving`
      : `https://www.google.com/maps/dir/?api=1&destination=${dest}&travelmode=driving`;
    if (w) w.location.href = u;
    else if (typeof window !== "undefined") window.location.href = u;
  };
  if (typeof navigator !== "undefined" && navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (p) => go(`${p.coords.latitude},${p.coords.longitude}`),
      () => go(null),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  } else {
    go(null);
  }
}
