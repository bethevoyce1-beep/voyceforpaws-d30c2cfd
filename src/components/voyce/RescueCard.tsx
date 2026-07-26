import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Assessment } from "@/lib/analyze.functions";
import { createSharedReport, updateSharedReport, mergeReporterAdded, type ReporterAdded } from "@/lib/share.functions";
import { MISSIONS, animalWord, type MissionId } from "@/lib/missions";
import { getUrgency } from "@/lib/urgency";
import { getCondition, CONDITION_COLORS, type ConditionInfo } from "@/lib/condition";
import { AIDisclosureBanner } from "@/components/voyce/AIDisclosureBanner";
import { BrandHeader } from "@/components/voyce/BrandHeader";
import { SaveCardControls } from "@/components/voyce/SaveCardControls";
import { useLiveAgo, formatTimer } from "@/lib/useLiveAgo";
import { NetworkResponses } from "@/components/voyce/NetworkResponses";

// =============================================================
// RescueCard — the SINGLE merged rescue card (replaces the old two-card flow of
// RescueReport + ShareCard). Shows only the essentials up top — photo, an honest
// status, name/situation, key facts, location, and the main action — and tucks
// every detail (health, behavior, environment, next steps, report info) behind
// small tappable pills. Heading never defaults to "Healthy": it leads with the
// situation and only shows a condition/urgency word when the AI flags one.
// =============================================================

type Tone = "critical" | "urgent" | "care" | "calm" | "wildlife";

const TONES: Record<Tone, { badge: string; bg: string; fg: string; ring: string; title: string }> = {
  critical: { badge: "🚨 Critical", bg: "#7E1F1F", fg: "#FFF1EE", ring: "#F8D7D7", title: "#7E1F1F" },
  urgent:   { badge: "🟠 Urgent",   bg: "#A8431F", fg: "#FFF6F0", ring: "#FFE4D6", title: "#A8431F" },
  care:     { badge: "💛 Needs care", bg: "#8A5A0E", fg: "#FFF9E6", ring: "#FCEFC9", title: "#8A5A0E" },
  calm:     { badge: "✓ Stable",   bg: "#1F6B3D", fg: "#E7F5EC", ring: "#E7F5EC", title: "#1F6B3D" },
  wildlife: { badge: "🦝 Wildlife", bg: "#2C5C7C", fg: "#E4F0F8", ring: "#E4F0F8", title: "#2C5C7C" },
};

function cap(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function toneFor(mission: MissionId, level: string): Tone {
  if (mission === "wildlife") return "wildlife";
  if (mission === "at-risk-shelter") return level === "CRITICAL" ? "critical" : "urgent";
  if (level === "CRITICAL") return "critical";
  if (level === "HIGH") return "urgent";
  if (level === "LOW") return "calm";
  return "care";
}

// The honest headline — leads with who + situation, never a bare "Healthy".
function headline(
  data: Assessment,
  mission: MissionId,
  situation: string | undefined,
  condition: ConditionInfo,
  tone: Tone,
): string {
  const who = animalWord(data) || data.species || "animal";
  const Who = cap(who);
  // A condition word (Injured, Sick…) only when there's an actual concern.
  const condWord = tone !== "calm" && tone !== "wildlife" && condition.titleWord
    ? cap(condition.titleWord.toLowerCase()) + " "
    : "";
  if (mission === "wildlife") return `Wildlife · ${Who}`;
  // Honest calm title — never "Found"/"Lost"/a condition word for a settled, safe animal.
  if (tone === "calm") {
    const atHome = data.is_likely_pet && /home|indoor/i.test(data.setting_type || "");
    return cap(atHome ? `${who} · safe at home` : `${who} · stable, no action needed`);
  }
  if (mission === "at-risk-shelter") return `At-risk shelter ${who}`;
  const sit = (situation || "").trim();
  if (sit) return cap(`${condWord}${sit}`);
  if (mission === "lost-found") return `${data.is_likely_pet ? "Found" : "Lost"} ${who}`;
  const stray = data.is_likely_pet ? "" : "Stray ";
  return cap(`${condWord}${stray}${who}`);
}

function locationLine(data: Assessment): string {
  const scene = (data.location_scene || "").split(/[.,]/)[0].trim();
  if (scene && scene.length < 60) return scene;
  return "Location pinned nearby";
}

// Every fact as a pill, shown up top — nothing tucked away. Includes the report
// facts (Case #, AI confidence, Reported by, Date) that used to hide behind the
// "Case" pill, so the card reads at a glance like the flyer.
function profileChips(data: Assessment): { label: string; value: string }[] {
  const dateStr = data.reportedAt ? new Date(data.reportedAt).toLocaleDateString() : "";
  return [
    { label: "Species", value: data.species },
    { label: "Breed", value: data.breed },
    { label: "Age", value: data.age },
    { label: "Size", value: data.size },
    { label: "Weight", value: data.weight },
    { label: "Color", value: data.color },
    { label: "Case #", value: data.caseId ?? "" },
    { label: "AI confidence", value: data.ai_confidence ? cap(data.ai_confidence) : "" },
    { label: "Reported by", value: "Reporter" },
    { label: "Date", value: dateStr },
  ].filter((c) => c.value && !/^unknown$/i.test(String(c.value))) as { label: string; value: string }[];
}

type SharePlatform =
  | "nextdoor" | "facebook" | "whatsapp" | "x" | "instagram" | "email"
  | "sms" | "linkedin" | "snapchat" | "telegram" | "reddit" | "messenger"
  | "pinterest" | "copy";
const SHARE_PLATFORMS: { id: SharePlatform; label: string; icon: string; bg: string; text: string; sub: string }[] = [
  { id: "nextdoor",  label: "Nextdoor",  icon: "ND", bg: "#8ED04A", text: "#0B3D1E", sub: "Best for local rescues" },
  { id: "facebook",  label: "Facebook",  icon: "f",  bg: "#1877F2", text: "#FFFFFF", sub: "Post to feed or groups" },
  { id: "whatsapp",  label: "WhatsApp",  icon: "✆",  bg: "#25D366", text: "#FFFFFF", sub: "DM or rescue groups" },
  { id: "x",         label: "X / Twitter", icon: "𝕏", bg: "#111111", text: "#FFFFFF", sub: "Tag rescues & shelters" },
  { id: "instagram", label: "Instagram", icon: "IG", bg: "#E1306C", text: "#FFFFFF", sub: "Copy + paste to story" },
  { id: "email",     label: "Email",     icon: "@",  bg: "#EA4335", text: "#FFFFFF", sub: "Forward to a rescuer" },
  { id: "sms",       label: "SMS",       icon: "SMS", bg: "#1FB86B", text: "#FFFFFF", sub: "Text to the pack" },
  { id: "linkedin",  label: "LinkedIn",  icon: "in", bg: "#0A66C2", text: "#FFFFFF", sub: "Reach professionals" },
  { id: "snapchat",  label: "Snapchat",  icon: "SC", bg: "#FFFC00", text: "#1A1A1A", sub: "Post to your story" },
  { id: "telegram",  label: "Telegram",  icon: "TG", bg: "#229ED9", text: "#FFFFFF", sub: "Channels & groups" },
  { id: "reddit",    label: "Reddit",    icon: "R",  bg: "#FF4500", text: "#FFFFFF", sub: "r/Adopt · r/rescue" },
  { id: "messenger", label: "Messenger", icon: "M",  bg: "#0084FF", text: "#FFFFFF", sub: "Copy + DM friends" },
  { id: "pinterest", label: "Pinterest", icon: "P",  bg: "#E60023", text: "#FFFFFF", sub: "Pin to a rescue board" },
  { id: "copy",      label: "Copy link", icon: "⧉",  bg: "#4B5563", text: "#FFFFFF", sub: "Paste anywhere" },
];

const HELP_ROLES: { id: string; icon: string; label: string; blurb: string }[] = [
  { id: "foster",    icon: "🏠", label: "Foster",     blurb: "give them a temporary home while a permanent one is found" },
  { id: "adopt",     icon: "🤝", label: "Adopt",      blurb: "offer them a forever home" },
  { id: "rescue",    icon: "🐾", label: "Rescue pull", blurb: "pull them into your rescue's care" },
  { id: "transport", icon: "🚗", label: "Transport",  blurb: "drive them to safety, a vet, or a foster" },
  { id: "pledge",    icon: "💵", label: "Pledge",     blurb: "chip in toward their vet care or pull fee" },
];

// What the lead (first accepter) can say they STILL need to get the animal all
// the way to safety. Mapped so we hide the need the lead already covers.
const STILL_NEEDS: { id: string; icon: string; label: string }[] = [
  { id: "foster",    icon: "🏠", label: "A foster" },
  { id: "adopter",   icon: "🤝", label: "An adopter" },
  { id: "transport", icon: "🚗", label: "Transport" },
  { id: "funds",     icon: "💵", label: "Funds / pledges" },
  { id: "vet",       icon: "🩺", label: "A vet" },
];
// The need each role already covers (so we don't ask the lead for it again).
const ROLE_COVERS: Record<string, string> = { foster: "foster", adopt: "adopter", transport: "transport", pledge: "funds", rescue: "" };

// Choices for the "Add what Voyce missed" popup — mirror the old "Tell us about
// them" details form (animal type, what's happening, and what the photo can't
// show), so the reporter can correct/add these right on the card.
const MISSED_ANIMALS = ["Dog", "Cat", "Puppy", "Kitten", "Other"];
const MISSED_SITUATIONS = [
  "Injured or hit by a car", "Sick or in distress", "Lost pet", "Found pet",
  "Abandoned puppies or kittens", "Stray, needs care", "Needs spay or vaccine", "At-risk shelter",
];
const MISSED_WITNESSED = ["Hit by a car", "Trapped / in danger", "Abuse / cruelty witnessed"];

function shareName(data: Assessment): string {
  const breed = data.breed && !/unknown|mixed/i.test(data.breed) ? data.breed : "";
  return cap((breed || data.species || "animal"));
}

function buildShareText(data: Assessment, mission: MissionId): string {
  const m = MISSIONS[mission];
  const name = shareName(data);
  const where = locationLine(data);
  return `🐾 ${name} needs help\n📍 ${where}\n\n${data.first_look}\n\n${m.callout.body}\n\nvia Voyce for Paws™ · © 2026 Be the Voyce, Inc.`;
}

export function RescueCard({
  image,
  data: rawData,
  mission,
  location,
  situation,
  animals,
  animalIndex = 0,
  onSelectAnimal,
  onContinue,
  onSend,
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
  onSend?: () => void;
  onEditDetails?: () => void;
}) {
  const [openPill, setOpenPill] = useState<string | null>(null);
  // "Add what Voyce missed" — reporter's manual add for a second animal the AI
  // didn't catch or any detail it got wrong. `missed` is the saved text.
  const [showMissed, setShowMissed] = useState(false);
  // Structured "what Voyce missed / got wrong" — animal type, what's happening,
  // what the photo can't show (witnessed), plus a free-text note.
  const [mAnimal, setMAnimal] = useState("");
  const [mSituation, setMSituation] = useState("");
  const [mWitnessed, setMWitnessed] = useState<string[]>([]);
  const [mNote, setMNote] = useState("");
  const [shareConfirm, setShareConfirm] = useState<SharePlatform | null>(null);
  const [showShare, setShowShare] = useState(false);
  const [helpRole, setHelpRole] = useState<(typeof HELP_ROLES)[number] | null>(null);
  const [needs, setNeeds] = useState<Record<string, boolean>>({});
  const [helpDone, setHelpDone] = useState(false);
  const openHelp = (r: (typeof HELP_ROLES)[number]) => { setHelpRole(r); setNeeds({}); setHelpDone(false); };
  const closeHelp = () => { setHelpRole(null); setNeeds({}); setHelpDone(false); };
  // A shared card gets its own public permalink (/r/<id>) so recipients see
  // THIS animal — not the generic app home. Created once, lazily, when the
  // share sheet opens; shares fall back to the app root until it's ready.
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareSaving, setShareSaving] = useState(false);
  // A stable report id for the shared "How the network is responding" feed —
  // ensured once on mount so the reporter's card and the public /r/<id> page
  // share the same live ripple (and this card is saved for the record).
  const [reportId, setReportId] = useState<string | null>(null);
  const ensuredRef = useRef(false);
  // Secret token generated once so the reporter can update THIS shared card
  // later — their corrections then reach everyone who opens the link.
  const editTokenRef = useRef<string>(
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36),
  );
  // Privacy on the PUBLIC share link: show exact spot, coarse area only, or
  // hide it entirely (default to area so a home address is never exposed). Plus
  // an optional note from the finder — "what you saw" — which they can keep
  // free of anything private.
  const [locPrivacy, setLocPrivacy] = useState<"exact" | "area" | "hidden">("area");
  const [note, setNote] = useState("");
  // Responder-safety: a report shouldn't go to rescuers without a location.
  // If GPS was denied (no `location`), the reporter can add an area manually or
  // retry GPS here; "Send to rescuers" stays gated until we have one.
  const [showLoc, setShowLoc] = useState(false);
  const [manualArea, setManualArea] = useState("");
  const [gps, setGps] = useState<{ lat: number; lon: number } | null>(null);
  const [locNote, setLocNote] = useState<string | null>(null);
  const hasPin = !!(location || gps || manualArea.trim());

  // A one-line summary of what the reporter added/corrected — shown on the card
  // and appended to shares.
  const missedSummary = [
    mAnimal,
    mSituation,
    mWitnessed.length ? `saw: ${mWitnessed.join(", ")}` : "",
    mNote.trim(),
  ].filter(Boolean).join(" · ");
  const hasMissed = missedSummary.length > 0;

  // Fold the reporter's corrections into the assessment so the card's FACTS
  // update (species/age/situation), not just the summary line. The same
  // `reporterAdded` is saved to the shared card so the public /r/<id> matches.
  const reporterAdded: ReporterAdded = hasMissed
    ? {
        animal: mAnimal || undefined,
        situation: mSituation || undefined,
        witnessed: mWitnessed.length ? mWitnessed : undefined,
        note: mNote.trim() || undefined,
      }
    : null;
  const data = mergeReporterAdded(rawData, reporterAdded);

  // Save the reporter's corrections to the shared card (so the public /r/<id>
  // reflects them for everyone) and close the popup. Fire-and-forget — the
  // on-card summary already updated live.
  const saveMissedAndClose = () => {
    setShowMissed(false);
    if (reportId) {
      void updateSharedReport({
        data: {
          id: reportId,
          editToken: editTokenRef.current,
          reporterAdded: reporterAdded as Record<string, unknown> | null,
        },
      });
    }
  };

  const urgency = useMemo(() => getUrgency(data, mission), [data, mission]);
  const condition = useMemo(() => getCondition(data), [data]);
  const tone = toneFor(mission, urgency.level);
  const T = TONES[tone];
  const title = headline(data, mission, situation, condition, tone);
  const chips = profileChips(data);
  const m = MISSIONS[mission];

  // Mission timer — counts up from the moment the report went out and keeps
  // running until the animal is fully rescued (status RESCUED/RESOLVED/etc.),
  // at which point useLiveAgo freezes it at the rescue time.
  const reportedAt = useMemo(
    () => (data as { reportedAt?: string }).reportedAt ?? new Date().toISOString(),
    [data],
  );
  const repStatus = (data as { status?: string }).status;
  const ago = useLiveAgo(reportedAt, repStatus);
  const takenStr = new Date(reportedAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

  const gpsForMap = location ?? gps;
  // View map works with coordinates when we have them, or a text search of the
  // typed area / label when we don't — so the pill shows whenever there's ANY
  // location to point at, not only when GPS coordinates exist.
  const mapQuery = gpsForMap
    ? `${gpsForMap.lat},${gpsForMap.lon}`
    : (manualArea.trim() || location?.label || "").trim();
  const mapsUrl = mapQuery
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`
    : null;
  const shownLoc = manualArea.trim() || (gps ? "Pinned (your GPS)" : location?.label) || locationLine(data);

  const useMyLocation = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setLocNote("This device can't share GPS — please type the area below.");
      return;
    }
    setLocNote("Getting your location…");
    navigator.geolocation.getCurrentPosition(
      (pos) => { setGps({ lat: pos.coords.latitude, lon: pos.coords.longitude }); setLocNote("Location added ✓"); },
      () => setLocNote("Couldn't get GPS — please type the nearest cross-streets or address below."),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const attemptSend = () => {
    if (!onSend) return;
    if (hasPin) onSend();
    else setShowLoc(true);
  };

  const ensureShareUrl = useCallback(async (): Promise<string | null> => {
    if (shareUrl) return shareUrl;
    if (shareSaving) return null;
    setShareSaving(true);
    try {
      const rawLabel = (manualArea.trim() || location?.label || "").trim();
      // Coarsen a full address to city/region for "area only" (drop the first
      // component, usually the street number/name).
      const coarse = (() => {
        const parts = rawLabel.split(",").map((s) => s.trim()).filter(Boolean);
        return parts.length > 2 ? parts.slice(1).join(", ") : rawLabel;
      })();
      const loc =
        locPrivacy === "hidden"
          ? null
          : locPrivacy === "area"
            ? (coarse ? { label: coarse } : null)
            : location
              ? { lat: location.lat, lon: location.lon, label: location.label }
              : gps
                ? { lat: gps.lat, lon: gps.lon, label: rawLabel || "Pinned location" }
                : rawLabel
                  ? { label: rawLabel }
                  : null;
      const res = await createSharedReport({
        data: {
          image,
          data,
          mission,
          situation: situation ?? undefined,
          location: loc,
          note: note.trim() || undefined,
          locPrivacy,
          editToken: editTokenRef.current,
        },
      });
      const id = res?.id;
      if (id && typeof window !== "undefined") {
        const u = `${window.location.origin}/r/${id}`;
        setShareUrl(u);
        return u;
      }
    } catch {
      /* leave shareUrl null — shares fall back to the app root */
    } finally {
      setShareSaving(false);
    }
    return null;
  }, [shareUrl, shareSaving, image, data, mission, situation, location, gps, manualArea, note, locPrivacy]);

  // Changing privacy or the note invalidates any link already minted.
  const resetShareLink = () => setShareUrl(null);

  // Ensure this report has a permalink id on mount, so the ripple feed below is
  // shared with anyone who later opens the public link (same live responses).
  useEffect(() => {
    if (ensuredRef.current) return;
    ensuredRef.current = true;
    void (async () => {
      const u = await ensureShareUrl();
      if (u) {
        const mm = u.match(/\/r\/([^/?#]+)/);
        if (mm) {
          setReportId(mm[1]);
          // Remember this card on the device so the Saved gallery can mark it "Yours".
          try {
            const key = "voyce_my_reports";
            const cur = JSON.parse(window.localStorage.getItem(key) || "[]") as string[];
            if (!cur.includes(mm[1])) window.localStorage.setItem(key, JSON.stringify([mm[1], ...cur].slice(0, 200)));
          } catch { /* ignore */ }
          // Keep the edit token so the reporter can keep correcting this card
          // in a later session too.
          try { window.localStorage.setItem(`voyce_edit_${mm[1]}`, editTokenRef.current); } catch { /* ignore */ }
        }
      }
    })();
    // run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const doShare = (p: SharePlatform, urlOverride?: string) => {
    const text = buildShareText(data, mission) + (missedSummary ? `\n\n✏️ Reporter added: ${missedSummary}` : "");
    const url = urlOverride ?? shareUrl ?? (typeof window !== "undefined" ? window.location.href : "");
    const enc = encodeURIComponent;
    const nm = shareName(data);
    const copyIt = () => {
      if (typeof navigator !== "undefined" && navigator.clipboard) void navigator.clipboard.writeText(`${text}\n${url}`);
    };
    // Platforms with a clean web share intent.
    const intents: Partial<Record<SharePlatform, string>> = {
      facebook:  `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}&quote=${enc(text)}`,
      whatsapp:  `https://wa.me/?text=${enc(text + "\n" + url)}`,
      nextdoor:  `https://nextdoor.com/sharekit/?body=${enc(text)}&url=${enc(url)}`,
      x:         `https://twitter.com/intent/tweet?text=${enc(text)}&url=${enc(url)}`,
      telegram:  `https://t.me/share/url?url=${enc(url)}&text=${enc(text)}`,
      reddit:    `https://www.reddit.com/submit?url=${enc(url)}&title=${enc(nm + " needs help")}`,
      linkedin:  `https://www.linkedin.com/sharing/share-offsite/?url=${enc(url)}`,
      pinterest: `https://pinterest.com/pin/create/button/?url=${enc(url)}&description=${enc(text)}&media=${enc(image)}`,
      email:     `mailto:?subject=${enc(nm + " needs help — Voyce for Paws")}&body=${enc(text + "\n" + url)}`,
      sms:       `sms:?&body=${enc(text + "\n" + url)}`,
    };
    const href = intents[p];
    if (href) {
      if (typeof window !== "undefined") window.open(href, "_blank", "noopener,noreferrer");
      return;
    }
    // instagram / snapchat / messenger / copy — no clean web post, so copy the
    // caption to the clipboard (and open the app site for the first three).
    copyIt();
    const sites: Partial<Record<SharePlatform, string>> = {
      instagram: "https://www.instagram.com",
      snapchat:  "https://www.snapchat.com",
      messenger: "https://www.messenger.com",
    };
    if (sites[p] && typeof window !== "undefined") window.open(sites[p], "_blank", "noopener,noreferrer");
  };

  // Detail pills — the collapsed sections. Each opens inline on tap.
  const pills: { id: string; icon: string; label: string; render: () => ReactNode }[] = [
    {
      id: "health", icon: "🩺", label: "Health",
      render: () => (
        <div className="space-y-2 text-[13.5px] leading-relaxed text-foreground/85">
          <p className="rounded-lg bg-[#FFFBEB] px-3 py-2 text-[12px] italic text-[#8A5A0E] ring-1 ring-[#F3E5B6]">
            AI observations, not veterinary advice. Confirm with a vet.
          </p>
          <Row label="Visible condition" value={condition.visibleCondition} colors={CONDITION_COLORS[condition.visibleCondition]} />
          {(data.symptoms ?? []).length > 0 && <Field label="Possible symptoms">{(data.symptoms ?? []).join(", ")}</Field>}
          {data.vet_notes?.bcs && <Field label="Body condition">{data.vet_notes.bcs}</Field>}
          {data.vet_notes?.posture && <Field label="Posture & tail">{data.vet_notes.posture}</Field>}
          {data.vet_notes?.hydration && <Field label="Hydration">{data.vet_notes.hydration}</Field>}
          {data.vet_notes?.clinical && <Field label="Summary (not a diagnosis)">{data.vet_notes.clinical}</Field>}
        </div>
      ),
    },
    {
      id: "behavior", icon: "🐾", label: "Behavior",
      render: () => <p className="text-[13.5px] leading-relaxed text-foreground/85">{data.behavior || "No behavior notes."}</p>,
    },
    {
      id: "where", icon: "🌤", label: "Environment",
      render: () => (
        <div className="space-y-2 text-[13.5px] leading-relaxed text-foreground/85">
          <p className="whitespace-pre-line">{data.environment_text || data.location_scene || "Limited environmental context in this frame."}</p>
          {data.setting_type && <Field label="Setting">{data.setting_type}</Field>}
          {data.lighting_conditions && <Field label="Lighting">{data.lighting_conditions}</Field>}
          {data.weather && !/not visible/i.test(data.weather) && <Field label="Weather">{data.weather}</Field>}
          {(data.surrounding_objects ?? []).length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {(data.surrounding_objects ?? []).map((o, i) => (
                <span key={i} className="rounded-full border border-[#EDE5D8] bg-white px-2.5 py-0.5 text-[12px] text-foreground/80">{o}</span>
              ))}
            </div>
          )}
        </div>
      ),
    },
    {
      id: "next", icon: "✅", label: "Next steps",
      render: () => (
        <ul className="space-y-1.5 text-[13.5px] leading-relaxed text-foreground/85">
          {(data.next_steps ?? []).map((n, i) => (
            <li key={i} className="flex gap-2"><span className="text-[oklch(0.65_0.18_70)]">→</span><span>{n}</span></li>
          ))}
        </ul>
      ),
    },
  ];
  if (Array.isArray(data.observations) && data.observations.filter(Boolean).length > 0) {
    pills.unshift({
      id: "obs", icon: "🔎", label: "AI read",
      render: () => (
        <ul className="space-y-1 text-[13.5px] leading-relaxed text-foreground/85">
          {data.observations!.filter(Boolean).map((o, i) => (
            <li key={i} className="flex gap-2"><span className="text-[oklch(0.65_0.18_70)]">•</span><span>{o}</span></li>
          ))}
        </ul>
      ),
    });
  }

  const flyerVariant = {
    badgeIcon: T.badge.split(" ")[0],
    badgeText: T.badge.replace(/^\S+\s/, ""),
    badgeGradient: T.bg,
    title,
    titleColor: T.title,
    subhead: m.titleSub || "",
  };

  return (
    <div className="min-h-[100dvh] bg-background pb-28">
      <BrandHeader />
      <AIDisclosureBanner />

      {animals && animals.length > 1 && (
        <div className="mx-auto flex w-full max-w-xl flex-wrap items-center gap-2 px-5 pt-3">
          <span className="text-[12px] font-semibold text-muted-foreground">{animals.length} animals:</span>
          {animals.map((a, i) => (
            <button key={i} type="button" onClick={() => onSelectAnimal?.(i)}
              className="rounded-full border-[1.5px] px-3 py-1 text-[12.5px] font-bold transition active:scale-[0.97]"
              style={i === animalIndex ? { background: "#FFDF3B", borderColor: "#FFDF3B", color: "#3A2A07" } : { borderColor: "#E6DED0", color: "#8A5A0E" }}>
              {cap(a.species || "animal")} {i + 1}
            </button>
          ))}
        </div>
      )}

      <div className="mx-auto w-full max-w-xl px-5 pt-4">
        <article className="overflow-hidden rounded-3xl border border-border bg-card shadow-[0_8px_30px_-12px_rgba(60,40,10,0.12)]">
          {/* Photo + honest status badge */}
          <div className="relative bg-[oklch(0.96_0.02_85)]">
            <img src={image} alt={title} className="aspect-[4/3] w-full object-cover" />
            <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-bold uppercase tracking-[0.1em] shadow-sm"
              style={{ background: T.bg, color: T.fg }}>
              {T.badge}
            </span>
            {/* Compact mission timer — counts up from report until rescued, then freezes */}
            <span className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-extrabold tabular-nums shadow-lg ring-1 ring-black/10"
              style={{ background: ago.frozen ? "#1F6B3D" : "#FFDF3B", color: ago.frozen ? "#fff" : "#1A1611" }}
              title={ago.frozen ? "Time to rescue" : "Time since the photo was taken"}>
              {ago.frozen ? "✅" : "⏱"} {formatTimer(ago.totalSeconds)}
            </span>
          </div>

          {/* Title + situation */}
          <div className="px-5 pt-4">
            <h1 className="font-serif text-[24px] font-bold leading-[1.1]" style={{ color: T.title }}>{title}</h1>
            <div className="mt-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-bold uppercase tracking-[0.1em]"
              style={{ background: urgency.soft, color: urgency.deep }}>
              <span className="text-muted-foreground/70">Urgency:</span><span>{urgency.emoji} {urgency.label}</span>
            </div>

            <div className="mt-2 text-[12px] font-medium text-muted-foreground">📷 Photo taken {takenStr}</div>

            {hasPin && (
              <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[12px] font-medium text-muted-foreground">
                <span className="flex items-center gap-1"><span>📍</span><span>{shownLoc}</span></span>
                {mapsUrl && (
                  <a href={mapsUrl} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold text-white no-underline shadow-sm transition active:scale-[0.97]"
                    style={{ background: "#2563EB" }}>🗺 View map</a>
                )}
              </div>
            )}

            {!hasPin && (
              <button type="button" onClick={() => setShowLoc(true)}
                className="mt-2 block w-full rounded-xl border px-3 py-2 text-left text-[12.5px] font-semibold transition active:scale-[0.99]"
                style={{ borderColor: "#F0C88A", background: "#FFF6E5", color: "#8A5A0E" }}>
                ⚠ Location not shared — tap to add it so a responder can reach {animalWord(data) || "them"} safely.
              </button>
            )}

            {chips.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {chips.map((c) => (
                  <span key={c.label} className="inline-flex items-center gap-1 rounded-full border border-[#EDE5D8] bg-white px-2.5 py-0.5 text-[11.5px] text-foreground/80">
                    <span className="text-muted-foreground">{c.label}:</span><span className="font-medium text-foreground/90">{c.value}</span>
                  </span>
                ))}
              </div>
            )}

            {data.first_look && (
              <p className="mt-2 text-[13.5px] italic leading-relaxed text-[oklch(0.45_0.03_70)]">{data.first_look}</p>
            )}

            {/* Detail pills — tap to expand, right under Voyce's read */}
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

              {/* Add what Voyce missed — fix the animal type / situation, note a
                  second animal it didn't catch, or add what the photo can't show.
                  Shows on the card and travels with shares. */}
              <div className="mt-2.5">
                {hasMissed ? (
                  <div className="rounded-2xl border border-[#F0C88A] bg-[#FFF9EC] px-3.5 py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#8A5A0E]">✏️ Reporter added</span>
                      <button type="button" onClick={() => setShowMissed(true)} className="text-[11px] font-semibold text-[#8A5A0E] underline underline-offset-2">edit</button>
                    </div>
                    <p className="mt-1 text-[13px] leading-relaxed text-[#6B5832]">{missedSummary}</p>
                  </div>
                ) : (
                  <button type="button" onClick={() => setShowMissed(true)}
                    className="inline-flex items-center gap-1 rounded-full border border-dashed px-3 py-1.5 text-[12.5px] font-semibold transition active:scale-95"
                    style={{ borderColor: "#C9871A", background: "#FFF9EC", color: "#8A5A0E" }}>
                    <span>✏️</span><span>Add what Voyce missed</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Primary action */}
          {onSend && (
            <div className="mx-5 mt-4">
              <button onClick={attemptSend}
                className="w-full rounded-2xl px-5 py-4 text-[15px] font-bold uppercase tracking-wide shadow-sm transition hover:brightness-105 active:scale-[0.99]"
                style={{ background: "linear-gradient(135deg,#FFDF3B,#C9871A)", color: "#3A2A07" }}>
                🚨 Send to rescuers
              </button>
              {!hasPin && (
                <p className="mt-1.5 text-center text-[11.5px] text-[#8A5A0E]">A location is needed before this goes to rescuers.</p>
              )}
            </div>
          )}

          {/* The "Can you help?" pills + commitment popup + live feed now live
              together in the single NetworkResponses block below (one block does
              both: commit AND post to the pack feed with what's still needed). */}

          {/* Closest-helpers ripple note, sitting just above the pack feed */}
          <div className="mx-5 mt-5 rounded-2xl border border-[#EDE5D8] px-4 py-3 text-[12.5px]" style={{ background: T.ring, color: T.title }}>
            <span className="font-semibold">👥 Closest helpers alerted first.</span> {m.nearbyHelpers}
          </div>

          {/* How the network is responding — BOTTOM block: rich action pills +
              shared live ripple for this animal. */}
          {reportId && (
            <div className="mt-5 border-t border-[#EDE5D8]">
              <NetworkResponses subjectType="report" subjectId={reportId} animalName={shareName(data)}
                onAction={(kind) => { if (kind === "share") setShowShare(true); }} />
            </div>
          )}
        </article>

        <div className="mt-4 flex items-center justify-center gap-3">
          <button onClick={onContinue} className="text-[13px] font-semibold text-[#8A5A0E] underline-offset-2 hover:underline">
            Continue →
          </button>
        </div>

        <p className="mx-auto mt-3 max-w-lg text-center text-[11.5px] italic leading-relaxed text-muted-foreground">
          ⚠️ Voyce shares AI observations, not veterinary advice. AI may misidentify breed, age, or condition and can't detect internal injuries or disease. Confirm with a licensed veterinarian before any medical, rescue, or transport decision.
        </p>
      </div>

      {showMissed && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-10 sm:items-center sm:pb-10" onClick={saveMissedAndClose}>
          <div onClick={(e) => e.stopPropagation()} className="max-h-[85dvh] w-full max-w-sm overflow-y-auto rounded-3xl border border-border bg-card p-5 shadow-2xl">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-serif text-lg font-semibold leading-tight">Add what Voyce missed</h3>
              <button type="button" onClick={saveMissedAndClose} aria-label="Close" className="shrink-0 rounded-full border border-border bg-background px-2.5 py-1 text-sm">✕</button>
            </div>
            <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
              Voyce read the photo — fix anything it missed or got wrong. Some things a photo can't show, so you can add them here. It shows on the card and travels with any share.
            </p>

            <div className="mt-4">
              <p className="mb-2 text-[11.5px] font-bold uppercase tracking-[0.1em] text-foreground/55">What kind of animal?</p>
              <div className="flex flex-wrap gap-2">
                {MISSED_ANIMALS.map((o) => (
                  <Chip key={o} label={o} active={mAnimal === o} onClick={() => setMAnimal(mAnimal === o ? "" : o)} />
                ))}
              </div>
            </div>

            <div className="mt-4">
              <p className="mb-2 text-[11.5px] font-bold uppercase tracking-[0.1em] text-foreground/55">What's happening?</p>
              <div className="flex flex-wrap gap-2">
                {MISSED_SITUATIONS.map((o) => (
                  <Chip key={o} label={o} active={mSituation === o} onClick={() => setMSituation(mSituation === o ? "" : o)} />
                ))}
              </div>
            </div>

            <div className="mt-4">
              <p className="mb-2 text-[11.5px] font-bold uppercase tracking-[0.1em] text-foreground/55">Did you see any of these? (the photo can't tell us)</p>
              <div className="flex flex-wrap gap-2">
                {MISSED_WITNESSED.map((o) => {
                  const on = mWitnessed.includes(o);
                  return (
                    <Chip key={o} label={(on ? "✓ " : "") + o} active={on}
                      onClick={() => setMWitnessed(on ? mWitnessed.filter((x) => x !== o) : [...mWitnessed, o])} />
                  );
                })}
              </div>
            </div>

            <div className="mt-4">
              <p className="mb-2 text-[11.5px] font-bold uppercase tracking-[0.1em] text-foreground/55">Anything else?</p>
              <textarea value={mNote} onChange={(e) => setMNote(e.target.value)} rows={3}
                placeholder="e.g. There's a second black dog Voyce didn't catch. Color, size, behavior, how long it's been there…"
                className="w-full resize-none rounded-xl border border-[#E2DED6] bg-white px-3 py-2 text-[13px] outline-none focus:border-[#C9871A]" />
            </div>

            <div className="mt-4 flex items-center justify-end gap-2">
              <button type="button" onClick={() => { setMAnimal(""); setMSituation(""); setMWitnessed([]); setMNote(""); }}
                className="rounded-full border border-border bg-background px-4 py-2 text-sm font-medium">Clear</button>
              <button type="button" onClick={saveMissedAndClose}
                className="rounded-full px-4 py-2 text-sm font-semibold text-[#3A2A07] shadow-sm"
                style={{ background: "linear-gradient(135deg,#FFDF3B,#C9871A)" }}>Done</button>
            </div>
          </div>
        </div>
      )}

      {showLoc && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-10 sm:items-center sm:pb-10" onClick={() => setShowLoc(false)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-3xl border border-border bg-card p-5 shadow-2xl">
            <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#A8431F]">📍 Add a location</div>
            <h3 className="mt-2 font-serif text-lg font-semibold leading-tight">Rescuers need a location to help safely.</h3>
            <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
              Your exact GPS is never shown publicly — it just routes the closest responder and tells them what they're walking into. Add it one of these ways:
            </p>
            <button type="button" onClick={useMyLocation}
              className="mt-3 w-full rounded-xl px-4 py-2.5 text-[13.5px] font-bold text-[#3A2A07]"
              style={{ background: "linear-gradient(135deg,#FFDF3B,#C9871A)" }}>
              📍 Use my current location
            </button>
            <div className="mt-3">
              <label className="text-[12px] font-semibold text-[#6B5832]">Or type the address / nearest cross-streets</label>
              <input value={manualArea} onChange={(e) => setManualArea(e.target.value)}
                placeholder="e.g. Culebra Rd & Bandera Rd, or 4710 …"
                className="mt-1 w-full rounded-lg border border-[#E2DED6] px-3 py-2 text-[13px] outline-none focus:border-[#C9871A]" />
            </div>
            {locNote && <p className="mt-2 text-[12px] font-semibold text-[#6B5832]">{locNote}</p>}
            <div className="mt-4 flex items-center justify-end gap-2">
              <button type="button" onClick={() => setShowLoc(false)} className="rounded-full border border-border bg-background px-4 py-2 text-sm font-medium">Cancel</button>
              <button type="button" disabled={!(gps || manualArea.trim())}
                onClick={() => { setShowLoc(false); if (onSend) onSend(); }}
                className="rounded-full px-4 py-2 text-sm font-semibold text-[#3A2A07] shadow-sm disabled:opacity-50"
                style={{ background: "linear-gradient(135deg,#FFDF3B,#C9871A)" }}>
                Save + send
              </button>
            </div>
          </div>
        </div>
      )}

      {showShare && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-40 flex items-end justify-center bg-black/55 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-10 sm:items-center sm:pb-10" onClick={() => setShowShare(false)}>
          <div onClick={(e) => e.stopPropagation()} className="max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-3xl border border-border bg-card p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-serif text-lg font-semibold leading-tight">Share {shareName(data)}</h3>
                <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
                  Would you share {shareName(data)} with friends or on social? Every share widens the circle — <span className="font-semibold text-foreground/80">Nextdoor</span> is best for finding a local rescuer fast.
                </p>
              </div>
              <button type="button" onClick={() => setShowShare(false)} aria-label="Close"
                className="shrink-0 rounded-full border border-border bg-background px-2.5 py-1 text-sm">✕</button>
            </div>

            {/* Privacy — how much of the location the public link reveals */}
            <div className="mt-3">
              <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#9CA3AF]">📍 Location on this link</div>
              <div className="mt-1.5 grid grid-cols-3 gap-2">
                {([
                  { id: "exact", label: "Exact", hint: "Shows the pin + map" },
                  { id: "area", label: "Area only", hint: "City/area, no map pin" },
                  { id: "hidden", label: "Hidden", hint: "Not shown publicly" },
                ] as const).map((o) => {
                  const on = locPrivacy === o.id;
                  return (
                    <button key={o.id} type="button" onClick={() => { setLocPrivacy(o.id); resetShareLink(); }}
                      className="rounded-xl border px-2 py-2 text-center transition active:scale-[0.97]"
                      style={on ? { borderColor: "#C9871A", background: "#FFF6E5", color: "#8A5A0E" } : { borderColor: "#E3DAC4", background: "#fff", color: "#6B5832" }}>
                      <div className="text-[12.5px] font-bold">{on ? "✓ " : ""}{o.label}</div>
                    </button>
                  );
                })}
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {locPrivacy === "exact" ? "The exact spot + map will show on the public link." : locPrivacy === "area" ? "Only a general area shows — no map pin, no street address." : "No location shows publicly — you can still share it privately with rescuers."}
              </p>
            </div>

            {/* Optional note — the finder's experience, their words */}
            <div className="mt-3">
              <label className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#9CA3AF]">✍️ Share what you saw (optional)</label>
              <textarea value={note} onChange={(e) => { setNote(e.target.value); resetShareLink(); }} rows={2}
                placeholder="e.g. Found her hiding under my porch, very sweet but scared… (leave out anything private)"
                className="mt-1 w-full resize-none rounded-xl border border-[#E2DED6] bg-white px-3 py-2 text-[13px] outline-none focus:border-[#C9871A]" />
              <p className="mt-1 text-[11px] text-muted-foreground">Only what you type here is shown — nothing private is included unless you add it.</p>
            </div>

            <div className="mt-3 rounded-xl border border-[#EDE5D8] bg-[#FBF7EC] px-3 py-2 text-[11.5px]">
              {shareSaving && <span className="text-muted-foreground">Preparing this card's link…</span>}
              {!shareSaving && shareUrl && (
                <div className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate font-semibold text-[#8A5A0E]">{shareUrl.replace(/^https?:\/\//, "")}</span>
                  <button type="button"
                    onClick={() => { if (typeof navigator !== "undefined" && navigator.clipboard) void navigator.clipboard.writeText(shareUrl); }}
                    className="shrink-0 rounded-full border border-[#E3DAC4] bg-white px-2.5 py-0.5 text-[11px] font-bold text-[#6B5832]">Copy link</button>
                </div>
              )}
              {!shareSaving && !shareUrl && (
                <button type="button" onClick={() => void ensureShareUrl()}
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-bold text-[#3A2A07]"
                  style={{ background: "linear-gradient(135deg,#FFDF3B,#C9871A)" }}>🔗 Create shareable link</button>
              )}
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2.5">
              {SHARE_PLATFORMS.map((p) => (
                <button key={p.id} type="button" onClick={() => setShareConfirm(p.id)}
                  className="flex flex-col items-center gap-1.5 rounded-2xl border border-[#EDE5D8] bg-white px-2 py-3 text-center transition hover:border-[#D8CEB8] active:scale-[0.97]">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full text-[13px] font-bold"
                    style={{ background: p.bg, color: p.text }}>{p.icon}</span>
                  <span className="text-[12px] font-bold text-foreground/85">{p.label}</span>
                  <span className="text-[10px] leading-tight text-muted-foreground">{p.sub}</span>
                </button>
              ))}
            </div>

            <div className="mt-4 border-t border-[#EDE5D8] pt-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#9CA3AF]">Or save a poster to post anywhere</p>
              <SaveCardControls image={image} data={data} name={shareName(data)} city={location?.label} v={flyerVariant} />
            </div>
          </div>
        </div>
      )}

      {helpRole && (() => {
        const covers = ROLE_COVERS[helpRole.id] ?? "";
        const askable = STILL_NEEDS.filter((n) => n.id !== covers);
        const chosen = askable.filter((n) => needs[n.id]);
        const chosenList =
          chosen.length === 0 ? "" :
          chosen.length === 1 ? chosen[0].label.toLowerCase() :
          chosen.slice(0, -1).map((n) => n.label.toLowerCase()).join(", ") + " and " + chosen[chosen.length - 1].label.toLowerCase();
        return (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-10 sm:items-center sm:pb-10" onClick={closeHelp}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-3xl border border-border bg-card p-5 shadow-2xl">
            {!helpDone ? (
              <>
                <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#8A5A0E]">{helpRole.icon} {helpRole.label} · you'd be the lead</div>
                <h3 className="mt-2 font-serif text-lg font-semibold leading-tight">You're stepping up to {helpRole.label.toLowerCase()} {shareName(data)}.</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
                  You can {helpRole.blurb}. As the first to accept, you're the <span className="font-semibold text-foreground/80">lead</span> — you decide who else joins. What do you still need to get {shareName(data)} all the way to safety?
                </p>
                <div className="mt-3 space-y-2">
                  {askable.map((n) => {
                    const on = !!needs[n.id];
                    return (
                      <button key={n.id} type="button" onClick={() => setNeeds((s) => ({ ...s, [n.id]: !on }))}
                        className="flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left text-[13px] font-semibold transition active:scale-[0.99]"
                        style={on ? { borderColor: "#C9871A", background: "#FFF6E5", color: "#8A5A0E" } : { borderColor: "#E3DAC4", background: "#fff", color: "#6B5832" }}>
                        <span className="text-[15px] leading-none">{on ? "✅" : n.icon}</span><span>{n.label}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="mt-4 flex items-center justify-end gap-2">
                  <button type="button" onClick={closeHelp} className="rounded-full border border-border bg-background px-4 py-2 text-sm font-medium">Cancel</button>
                  <button type="button" onClick={() => setHelpDone(true)}
                    className="rounded-full px-4 py-2 text-sm font-semibold text-[#3A2A07] shadow-sm"
                    style={{ background: "linear-gradient(135deg,#FFDF3B,#C9871A)" }}>
                    {chosen.length > 0 ? "Accept & rally the rest" : "I've got it — accept"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#1F6B3D]">✅ You're the lead</div>
                <h3 className="mt-2 font-serif text-lg font-semibold leading-tight">Thank you for stepping up for {shareName(data)}.</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
                  {chosen.length > 0
                    ? `We'll rally the pack for ${chosenList} and route every offer to you to approve before anyone's locked in.`
                    : `You've got this one covered — we'll let the pack know it's handled.`}
                </p>
                <div className="mt-4 flex justify-end">
                  <button type="button" onClick={closeHelp}
                    className="rounded-full px-4 py-2 text-sm font-semibold text-[#3A2A07] shadow-sm"
                    style={{ background: "linear-gradient(135deg,#FFDF3B,#C9871A)" }}>Done</button>
                </div>
              </>
            )}
          </div>
        </div>
        );
      })()}

      {shareConfirm && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-10 sm:items-center sm:pb-10" onClick={() => setShareConfirm(null)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-3xl border border-border bg-card p-5 shadow-2xl">
            <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#A8431F]">⚠️ Confirm share</div>
            <h3 className="mt-2 font-serif text-lg font-semibold leading-tight">You're about to share this AI-generated rescue card.</h3>
            <p className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">AI assessments may be inaccurate. Share anyway?</p>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button type="button" onClick={() => setShareConfirm(null)} className="rounded-full border border-border bg-background px-4 py-2 text-sm font-medium">Cancel</button>
              <button type="button" onClick={async () => { const p = shareConfirm; setShareConfirm(null); if (p) { const u = await ensureShareUrl(); doShare(p, u ?? undefined); } }}
                className="rounded-full bg-gradient-to-b from-[#FFDF3B] to-[#C9871A] px-4 py-2 text-sm font-semibold text-[#3A2A07] shadow-sm">Share anyway</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className="rounded-full px-3 py-1.5 text-[12.5px] font-semibold transition active:scale-[0.97]"
      style={active ? { background: "#FFDF3B", color: "#3A2A07" } : { border: "1px solid #E3DAC4", background: "#fff", color: "#6B5832" }}>
      {label}
    </button>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <span className="text-muted-foreground">{label}: </span>
      <span className="text-foreground/90">{children}</span>
    </div>
  );
}

function Row({ label, value, colors }: { label: string; value: string; colors: { bg: string; text: string; dot: string } }) {
  return (
    <div className="flex items-center justify-between rounded-xl border px-3 py-2" style={{ background: colors.bg, borderColor: colors.dot, color: colors.text }}>
      <span className="text-[11px] font-bold uppercase tracking-[0.12em] opacity-80">{label}</span>
      <span className="text-[13px] font-bold uppercase">{value}</span>
    </div>
  );
}
