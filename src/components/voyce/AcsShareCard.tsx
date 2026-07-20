import { useMemo, useState } from "react";
import { BrandHeader } from "@/components/voyce/BrandHeader";
import { JoinNetworkModal } from "@/components/voyce/JoinNetworkModal";
import { addAnimalMedia } from "@/lib/media.functions";
import {
  ACS_STATUS_MODEL,
  normalizeStatusKey,
  statusLabel,
  type AcsAnimal,
  type AcsStatusKey,
} from "@/lib/acs.functions";
import {
  deadlineForAnimal,
  useEuthCountdown,
  urgencyFor,
  formatCountdown,
  formatDeadlineClock,
} from "@/lib/acs.timer";
import type { NetworkRole } from "@/lib/signups.functions";

// ============================================================
// SAN ANTONIO ACS — hardcoded partner contact info
// ============================================================
const ACS = {
  name: "San Antonio ACS",
  fullName: "San Antonio Animal Care Services",
  phone: "(210) 207-6669",
  phoneTel: "+12102076669",
  adoptionsEmail: "acsadoptions@sanantonio.gov",
  fosterEmail: "acsfosters@sanantonio.gov",
  address: "4710 State Hwy 151, San Antonio, TX 78227",
  mapsUrl:
    "https://www.google.com/maps/dir/?api=1&destination=4710+State+Hwy+151+San+Antonio+TX+78227",
  searchPage: "https://www.sanantonio.gov/animal-care/lost-found",
  pdfList: "https://www.sanantonio.gov/animal-care/about/euthanasia-list",
  fbPage: "https://www.facebook.com/sanantonioacs",
} as const;

// ----- color tokens (Voyce gold + ACS red) -----
const GOLD = "#FFDF3B";
const GOLD_DEEP = "#C9871A";
const GOLD_INK = "#3A2A07";
const RED1 = "#DC2626";
const RED2 = "#B91C1C";
const CREAM = "#FFFBEB";
const PAPER = "#FAF7F1";
const INK = "#1A1611";

// The daily ACS deadline, in words — matches acs.timer.ts (5:30 PM Mon–Fri /
// 12:30 PM Sat / Sun closed). Kept in one place so it can never drift again.
const DEADLINE_WORDS = "5:30 PM Mon–Fri / 12:30 PM Sat · Sun closed";

// Status color ramp — honest, not everything red. Critical tiers are red,
// scheduled/at-risk warm, holds teal, secured green, memoriam/unknown gray.
function statusColor(key: AcsStatusKey): string {
  switch (key) {
    case "euthanasia":
    case "b6spt":
    case "office_crit":
      return "#B91C1C";
    case "immediate":
      return "#DC2626";
    case "scheduled":
      return "#EA580C";
    case "highrisk":
      return "#E8590C";
    case "atrisk":
      return "#D97706";
    case "office":
      return "#B45309";
    case "adopthold":
    case "adoption":
    case "foster":
    case "watch":
      return "#0F766E";
    case "secured":
      return "#15803D";
    case "euthanized":
      return "#57534E";
    default:
      return "#6B7280";
  }
}

// ============================================================
// Small ACS helpers — the scraper doesn't populate every column, so each
// accessor degrades gracefully (nulls become friendly fallbacks).
// ============================================================
function acsPhoto(a: AcsAnimal): string | null {
  if (a.thumb && a.thumb.trim()) return a.thumb.trim();
  if (a.photos && a.photos.length > 0) return a.photos[0];
  return null;
}

function daysText(a: AcsAnimal): string {
  return typeof a.days === "number" ? `${a.days} days at shelter` : "on the at-risk list";
}

/** Normalize a date-ish string to US M/D/YYYY; pass through anything odd. */
function usDate(s: string | null | undefined): string | null {
  if (!s) return null;
  const t = s.trim();
  if (!t) return null;
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(t);
  if (m) return `${+m[2]}/${+m[3]}/${m[1]}`;
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(t);
  if (m) return `${+m[1]}/${+m[2]}/${m[3]}`;
  return t;
}

/** Best-effort spay/neuter read from the free-text sex field. */
function spayText(sex: string | null): { value: string; warn: boolean } {
  const s = (sex || "").toLowerCase();
  if (/intact/.test(s)) return { value: "Intact", warn: true };
  if (/spay|neuter|altered/.test(s)) return { value: "Altered", warn: false };
  return { value: "Confirm with ACS", warn: false };
}

/** Title-case a shouty/lowercase value for warm prose ("GINNY" → "Ginny"). */
function titleCase(s: string): string {
  return s.toLowerCase().replace(/\b([a-z])/g, (m) => m.toUpperCase());
}

/** "4y" → "4-year-old", "10m" → "10-month-old"; leaves anything else alone. */
function humanAge(age: string): string {
  return age
    .replace(/(\d+)\s*y(?:rs?)?\b/i, "$1-year-old")
    .replace(/(\d+)\s*m(?:os?|onths?)?\b/i, "$1-month-old")
    .trim();
}

/**
 * Pull ONLY the volunteer behavioral description out of ACS's raw notes — the
 * warm part before any vet/medical section, with the leading date stripped.
 * Returns up to two sentences. Never invents; returns "" when there's nothing.
 */
function behavioralFromNotes(story: string): string {
  if (!story) return "";
  let t = story.trim().replace(/^\s*\d{1,2}\/\d{1,2}\/\d{4}\s*/, "");
  const cut = t.search(/vet exam notes|vet notes|medical (?:notes|history)|current medications/i);
  if (cut > 0) t = t.slice(0, cut).trim();
  // Stop at the next dated entry (a new day's note).
  const nextDate = t.search(/\s\d{1,2}\/\d{1,2}\/\d{4}/);
  if (nextDate > 0) t = t.slice(0, nextDate).trim();
  const sentences = t.match(/[^.!?]+[.!?]*/g) || [t];
  return sentences.slice(0, 2).join(" ").replace(/\s+/g, " ").trim();
}

/**
 * A warm 2–3 sentence "Their story" built ONLY from ACS's real data — the
 * listing facts plus ACS's own behavioral words. Nothing is invented.
 */
function buildRescueStory(a: AcsAnimal): string {
  const name = titleCase(a.name);
  const age = humanAge((a.age || a.age_raw || "").trim());
  const breed = a.breed ? titleCase(a.breed) : "dog";
  const who = `${name} is ${age ? `a ${age} ` : "a "}${breed} at San Antonio ACS.`;
  const waited =
    typeof a.days === "number"
      ? ` ${name} has been waiting ${a.days} day${a.days === 1 ? "" : "s"} for a foster or rescue.`
      : "";
  const behavioral = behavioralFromNotes(a.story || "");
  const behaviorLine = behavioral ? ` In ACS's words: ${behavioral}` : "";
  return `${who}${waited}${behaviorLine}`.trim();
}

// ============================================================
// ACS evaluation / behavior notes — the scraper joins ACS's dated evaluation
// entries into one string and sometimes bleeds the NEXT animal's block onto the
// end. Strip that tail, then split into dated entries so each shows under its
// own date pill (far easier to read than one wall of text).
// ============================================================
function parseAcsNotes(raw: string): { date: string | null; text: string }[] {
  let s = (raw || "").trim();
  if (!s) return [];
  // Cut trailing bleed from the next dog's block / capacity boilerplate.
  const cutMarkers = [
    /\bA\d{6,8}\s+If kennel capacity/i,
    /\s+Animal ID\s+Due Out Date/i,
    /\bIf kennel capacity is needed this pet could be\b/i,
  ];
  let cut = s.length;
  for (const re of cutMarkers) {
    const m = re.exec(s);
    if (m && m.index < cut) cut = m.index;
  }
  s = s.slice(0, cut).trim();
  if (!s) return [];
  const parts = s.split(/(\d{1,2}\/\d{1,2}\/\d{4})/);
  const entries: { date: string | null; text: string }[] = [];
  if (parts[0] && parts[0].trim()) entries.push({ date: null, text: parts[0].trim() });
  for (let i = 1; i < parts.length; i += 2) {
    const date = parts[i];
    const text = (parts[i + 1] || "").trim();
    if (text) entries.push({ date, text });
  }
  return entries.length ? entries : [{ date: null, text: s }];
}

// ============================================================
// Live euthanasia timer — countdown for dated statuses; a pulsing
// "in progress" state for b6spt / euthanasia (they're in the room now).
// ============================================================
function EuthTimer({ animal, variant }: { animal: AcsAnimal; variant: "chip" | "block" }) {
  const key = normalizeStatusKey(animal.status_key);
  const inProgress = key === "b6spt" || key === "euthanasia";
  const target = useMemo(() => (inProgress ? null : deadlineForAnimal(animal)), [animal, inProgress]);
  const { msLeft, hasTarget } = useEuthCountdown(target);

  const chip = inProgress
    ? { label: "In progress — act now", bg: "#7F1D1D", text: "#FFFFFF", pulse: true }
    : urgencyFor(msLeft);
  const countdown = hasTarget ? formatCountdown(msLeft) : null;
  const pulse = chip.pulse ? "motion-safe:animate-pulse" : "";

  if (variant === "chip") {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-extrabold shadow-lg ${pulse}`}
        style={{ background: chip.bg, color: chip.text }}
        role="status"
        aria-live="polite"
      >
        <span>{chip.label}</span>
        {countdown && <span className="tabular-nums">⏳ {countdown}</span>}
      </span>
    );
  }

  return (
    <div
      className={`rounded-xl border px-4 py-3 text-center ${pulse}`}
      style={{ background: "#FEF2F2", borderColor: chip.bg }}
      role="status"
      aria-live="polite"
    >
      <p className="text-[10.5px] font-extrabold uppercase tracking-[0.12em]" style={{ color: chip.bg }}>
        {hasTarget ? "Time left before euthanasia window" : chip.label}
      </p>
      {hasTarget ? (
        <p className="mt-0.5 font-mono text-[26px] font-extrabold tabular-nums" style={{ color: chip.bg }}>
          {countdown}
        </p>
      ) : (
        <p className="mt-1 text-[13px] font-bold" style={{ color: chip.bg }}>
          {key === "euthanasia"
            ? "In the euthanasia room now."
            : "Moved to a euthanasia-prep kennel."}
        </p>
      )}
      <p className="mt-1 text-[11px] text-[#6B7280]">
        ACS deadline · {target ? `${formatDeadlineClock(target)} · ` : ""}
        {DEADLINE_WORDS} · confirm with ACS
      </p>
    </div>
  );
}

// ============================================================
// Master share text (PawBoost-style)
// ============================================================
function buildShareText(a: AcsAnimal, deepLink: string): string {
  const story = (a.story || "").split(/[.!]/)[0].trim().slice(0, 100);
  const label = statusLabel(a);
  const id = a.id;
  return [
    `🚨 ${label} — ${a.name} needs help at ${ACS.name}`,
    ``,
    `🐾 ${story || `${daysText(a)} — needs out today.`}`,
    ``,
    `📍 ${ACS.name} · ID ${id}`,
    `⏰ ${daysText(a)} · capacity deadline today`,
    ``,
    `How you can help:`,
    `🏠 Foster · 🚑 Rescue · 💛 Adopt · 🤝 Pledge · 🚐 Transport`,
    ``,
    `📞 Contact ACS: ${ACS.phone}`,
    `🔗 Real ACS listing: ${deepLink}`,
    ``,
    `Voyce is pre-launch — every share grows the pack. Real alerts go to nearest helpers when we launch.`,
    `→ voyceforpaws.lovable.app`,
  ].join("\n");
}

// ============================================================
// Share sheet — a labeled grid (platform + one-line purpose), opened from the
// "Share" chip under "Can you help?". Mirrors the landing-page share modal.
// ============================================================
function Ico({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden>
      <path d={d} />
    </svg>
  );
}

const FB_PATH = "M22 12a10 10 0 1 0-11.6 9.9v-7H8v-2.9h2.4V9.4c0-2.4 1.5-3.8 3.6-3.8 1 0 2 .2 2 .2v2.3h-1.2c-1.2 0-1.6.7-1.6 1.5V12h2.7l-.4 2.9h-2.3V22A10 10 0 0 0 22 12Z";
const WA_PATH = "M20 3.5A10 10 0 0 0 4.1 16.6L3 21l4.5-1.1A10 10 0 1 0 20 3.5Zm-5 16a8.4 8.4 0 0 1-4.3-1.2l-.3-.2-2.7.7.7-2.6-.2-.3A8.4 8.4 0 1 1 15 19.5Z";
const X_PATH = "M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z";
const COPY_PATH = "M16 1H4a2 2 0 0 0-2 2v14h2V3h12V1zm3 4H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2zm0 16H8V7h11v14z";

type ShareItem = {
  id: string;
  label: string;
  sub: string;
  bg: string;
  fg?: string;
  iconPath?: string;
  mark?: string;
};

const SHARE_SHEET: ShareItem[] = [
  { id: "nextdoor", label: "Nextdoor", sub: "Best for local rescues", bg: "#8ED500", fg: "#1F3A00", mark: "ND" },
  { id: "facebook", label: "Facebook", sub: "Post to feed or groups", bg: "#1877F2", fg: "#fff", iconPath: FB_PATH },
  { id: "whatsapp", label: "WhatsApp", sub: "DM or rescue groups", bg: "#25D366", fg: "#fff", iconPath: WA_PATH },
  { id: "x", label: "X / Twitter", sub: "Tag rescues & shelters", bg: "#000", fg: "#fff", iconPath: X_PATH },
  { id: "instagram", label: "Instagram", sub: "Copy + paste to story", bg: "#E4405F", fg: "#fff", mark: "IG" },
  { id: "email", label: "Email", sub: "Forward to a rescuer", bg: "#EA4335", fg: "#fff", mark: "@" },
  { id: "sms", label: "SMS", sub: "Text to the pack", bg: "#10B981", fg: "#fff", mark: "SMS" },
  { id: "linkedin", label: "LinkedIn", sub: "Reach professionals", bg: "#0A66C2", fg: "#fff", mark: "in" },
  { id: "snapchat", label: "Snapchat", sub: "Post to your story", bg: "#FFFC00", fg: "#000", mark: "SC" },
  { id: "telegram", label: "Telegram", sub: "Channels & groups", bg: "#26A5E4", fg: "#fff", mark: "TG" },
  { id: "reddit", label: "Reddit", sub: "r/Adopt · r/SanAntonio", bg: "#FF4500", fg: "#fff", mark: "R" },
  { id: "messenger", label: "Messenger", sub: "Copy + DM friends", bg: "#00B2FF", fg: "#fff", mark: "M" },
  { id: "pinterest", label: "Pinterest", sub: "Pin to a rescue board", bg: "#E60023", fg: "#fff", mark: "P" },
  { id: "copy", label: "Copy link", sub: "Paste anywhere", bg: "#4B5563", fg: "#fff", iconPath: COPY_PATH },
];

// "More ways to help" — opened from the Other chip under "Can you help?".
const OTHER_WAYS = [
  { emoji: "🏢", label: "Shelter transfer", tag: "another shelter takes" },
  { emoji: "🚐", label: "Transport", tag: "get them there" },
  { emoji: "🩺", label: "Vet care", tag: "medical" },
  { emoji: "🏫", label: "Trainer", tag: "behavior help" },
  { emoji: "🛏️", label: "Boarding", tag: "temporary space" },
];

// Small reusable label ----------------------------------------------------
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mx-5 mb-2 mt-4 text-[10.5px] font-bold uppercase tracking-[0.12em]" style={{ color: GOLD_DEEP }}>
      {children}
    </p>
  );
}

// Fact grid — tinted per section to match the landing card: rescue = cream,
// medical = cool blue-gray. Warn values use ACS's warm amber (#B4610F).
function FactGrid({
  items,
  tone,
}: {
  items: { label: string; value: string; warn?: boolean }[];
  tone: "rescue" | "med";
}) {
  const box =
    tone === "med"
      ? "bg-[#F4F7FA] ring-[#DBE6EF]"
      : "bg-[#FCF8EE] ring-[#EFE2C4]";
  return (
    <div className={`mx-5 grid grid-cols-2 gap-x-3 gap-y-2 rounded-xl p-3.5 ring-1 ${box}`}>
      {items.map((f) => (
        <div key={f.label} className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-[#8F877A]">{f.label}</div>
          <div className={`truncate text-[13px] font-semibold ${f.warn ? "text-[#B4610F]" : "text-[#22201C]"}`}>
            {f.value}
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================
// Component
// ============================================================
export function AcsShareCard({
  animal,
  onContinue,
}: {
  animal: AcsAnimal;
  onContinue: () => void;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [modalRole, setModalRole] = useState<NetworkRole | undefined>();
  const [shareOpen, setShareOpen] = useState(false);
  const [otherOpen, setOtherOpen] = useState(false);
  const [otherText, setOtherText] = useState("");
  const [addMediaOpen, setAddMediaOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [photoFailed, setPhotoFailed] = useState(false);
  const [storyOpen, setStoryOpen] = useState(false);

  const openModal = (role?: NetworkRole) => {
    setModalRole(role);
    setModalOpen(true);
  };

  const statusKey = normalizeStatusKey(animal.status_key);
  const statusMeta = statusKey === "left" ? ACS_STATUS_MODEL.atrisk : ACS_STATUS_MODEL[statusKey];
  const badgeLabel = statusLabel(animal);
  const chipColor = statusColor(statusKey === "left" ? "atrisk" : statusKey);

  // Time-critical statuses show the countdown / in-progress timer block.
  const showTimer =
    statusKey === "b6spt" ||
    statusKey === "euthanasia" ||
    statusKey === "office_crit" ||
    statusKey === "immediate" ||
    statusKey === "scheduled";

  const id = animal.id;
  const NAME = animal.name.toUpperCase();
  const kennel = animal.kennel ?? "—";
  const photo = acsPhoto(animal);
  const vitals = [animal.breed, animal.age || animal.age_raw, animal.color]
    .filter(Boolean)
    .join(" · ");
  const daysWaiting = typeof animal.days === "number" ? `${animal.days} days waiting` : "on the list";

  const acsDeepLink = animal.pet_search_url || `${ACS.searchPage}?id=${encodeURIComponent(id)}`;
  const pdfDeepLink = animal.list_url || `${ACS.pdfList}#${encodeURIComponent(id)}`;
  const shareUrl =
    typeof window !== "undefined" ? window.location.origin : "https://voyceforpaws.lovable.app";
  const shareText = useMemo(() => buildShareText(animal, acsDeepLink), [animal, acsDeepLink]);

  const findFb = `https://www.facebook.com/sanantonioacs/search?q=${encodeURIComponent(id)}`;
  const findYt = `https://www.youtube.com/results?search_query=${encodeURIComponent(`"San Antonio ACS" ${id}`)}`;
  const findWeb = `https://www.google.com/search?q=${encodeURIComponent(`"San Antonio ACS" ${id} ${animal.name}`)}`;

  const adoptMailto = `mailto:${ACS.adoptionsEmail}?subject=${encodeURIComponent(
    `Interest in ${animal.name} (ID ${id})`,
  )}&body=${encodeURIComponent(
    `Hi ACS team,\n\nI'm interested in ${animal.name} (ID ${id}, kennel ${kennel}). Please let me know next steps.\n\nThanks,`,
  )}`;
  const fosterMailto = `mailto:${ACS.fosterEmail}?subject=${encodeURIComponent(
    `Foster application for ${animal.name} (ID ${id})`,
  )}&body=${encodeURIComponent(
    `Hi ACS Foster team,\n\nI'd like to foster ${animal.name} (ID ${id}). Please send the application.\n\nThanks,`,
  )}`;

  const doShare = (platform: string) => {
    const enc = encodeURIComponent;
    const intents: Record<string, string> = {
      nextdoor: `https://nextdoor.com/sharekit/?body=${enc(shareText)}&url=${enc(shareUrl)}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${enc(shareUrl)}&quote=${enc(shareText)}`,
      whatsapp: `https://wa.me/?text=${enc(shareText + "\n" + shareUrl)}`,
      x: `https://twitter.com/intent/tweet?text=${enc(shareText)}&url=${enc(shareUrl)}`,
      telegram: `https://t.me/share/url?url=${enc(shareUrl)}&text=${enc(shareText)}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${enc(shareUrl)}`,
      reddit: `https://www.reddit.com/submit?url=${enc(shareUrl)}&title=${enc(`${badgeLabel} — ${animal.name} at ${ACS.name}`)}`,
      pinterest: `https://pinterest.com/pin/create/button/?url=${enc(shareUrl)}&description=${enc(shareText)}`,
      email: `mailto:?subject=${enc(`${badgeLabel} — ${animal.name} needs help at ${ACS.name}`)}&body=${enc(shareText + "\n" + shareUrl)}`,
      sms: `sms:?&body=${enc(shareText + "\n" + shareUrl)}`,
      messenger: `https://www.facebook.com/dialog/send?link=${enc(shareUrl)}&app_id=0`,
      instagram: `https://www.instagram.com/`,
      snapchat: `https://www.snapchat.com/`,
    };
    if (platform === "copy") {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        void navigator.clipboard.writeText(`${shareText}\n${shareUrl}`).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        });
      }
      return;
    }
    if (intents[platform] && typeof window !== "undefined") {
      window.open(intents[platform], "_blank", "noopener,noreferrer");
    }
  };

  const story = (animal.story || "").trim();
  const storyPreview = story.length > 160 ? `${story.slice(0, 160)}…` : story;
  const noteEntries = parseAcsNotes(story);
  const listDateStr = usDate(animal.list_date);
  const rescueStory = buildRescueStory(animal);
  const spay = spayText(animal.sex);

  const facts: { label: string; value: string; warn?: boolean }[] = [
    { label: "Breed", value: animal.breed || "—" },
    { label: "Kennel", value: kennel },
    { label: "Color", value: animal.color || "—" },
    { label: "Age", value: animal.age || animal.age_raw || "—" },
    { label: "Sex", value: animal.sex || "—", warn: /intact/i.test(animal.sex || "") },
    { label: "Weight", value: animal.weight ? `${animal.weight} lb` : "—" },
    { label: "Days at shelter", value: typeof animal.days === "number" ? `${animal.days} days` : "—" },
    { label: "At risk since", value: usDate(animal.risk_since) || "—" },
    { label: "Due out", value: usDate(animal.due_out) || "—" },
    { label: "Euth date", value: animal.euth_date || "—", warn: !!animal.euth_date },
  ];

  const medical: { label: string; value: string; warn?: boolean }[] = [
    { label: "Spay / neuter", value: spay.value, warn: spay.warn },
    { label: "Weight / size", value: animal.weight ? `${animal.weight} lb` : "Not listed" },
    { label: "Heartworm", value: "Confirm with ACS" },
    { label: "Microchip", value: "Confirm with ACS" },
    { label: "Vaccines", value: "Confirm with ACS" },
    { label: "FeLV / FIV", value: "N/A (canine)" },
  ];

  // Quick-link pills shown up top by the address — small, clear, like View map.
  const quickLinks: { href: string; label: string; bg: string; fg: string }[] = [
    { href: ACS.mapsUrl, label: "📍 View map", bg: "#EEF3FB", fg: "#1E40AF" },
    { href: acsDeepLink, label: "🏛 ACS listing", bg: "#FFF6DA", fg: "#7A5A0A" },
    { href: pdfDeepLink, label: "📋 ACS PDF · this dog", bg: "#FFF6DA", fg: "#7A5A0A" },
  ];

  return (
    <div style={{ minHeight: "100dvh", background: PAPER }}>
      <BrandHeader />

      <div className="mx-auto w-full max-w-[440px] px-4 pb-10 pt-3" style={{ color: INK }}>
        {/* AI advisory — folded in from the report view */}
        <div className="mb-3 flex items-start gap-2 rounded-xl bg-[#FEF6E0] px-3.5 py-2.5 ring-1 ring-[#F3E5B6]">
          <span className="text-[14px] leading-none">⚠️</span>
          <p className="text-[11.5px] leading-snug text-[#6B5832]">
            <b>AI is advisory — not a diagnosis.</b> May misidentify breed, age, or condition. Always
            confirm with ACS.
          </p>
        </div>

        <article
          className="overflow-hidden rounded-2xl bg-white ring-1 ring-black/5"
          style={{ boxShadow: "0 22px 60px -28px rgba(20,15,5,0.45)" }}
        >
          {/* ===== HERO PHOTO ===== */}
          <div
            className="relative w-full overflow-hidden"
            style={{ aspectRatio: "4/3", background: photo && !photoFailed ? "#000" : undefined }}
          >
            {photo && !photoFailed ? (
              <img
                src={photo}
                alt={animal.name}
                className="absolute inset-0 h-full w-full object-cover"
                onError={() => setPhotoFailed(true)}
              />
            ) : (
              <div
                className="absolute inset-0 flex flex-col items-center justify-center gap-2"
                style={{ background: "linear-gradient(135deg, #FFF3C4 0%, #F5E3A0 100%)" }}
                aria-label="No photo available yet"
              >
                <span className="text-[54px]" aria-hidden>🐾</span>
                <span className="text-[12px] font-semibold" style={{ color: GOLD_DEEP }}>
                  Photo pending — see ACS listing
                </span>
              </div>
            )}
            <span className="absolute left-3 top-3 rounded-full bg-black/80 px-3 py-1 text-[11px] font-bold text-white shadow-lg">
              🕒 {daysText(animal)}
            </span>
            <span
              className="absolute right-3 top-3 rounded-full px-3 py-1 text-[10.5px] font-extrabold uppercase tracking-[0.12em] text-white shadow-lg"
              style={{ background: chipColor }}
            >
              {badgeLabel}
            </span>
          </div>

          {/* ===== NAME BLOCK ===== */}
          <div className="px-5 pb-1 pt-5">
            <h2 className="font-serif text-[28px] font-bold leading-[1.05] tracking-tight" style={{ color: INK }}>
              {NAME}
            </h2>
            <p className="mt-1 text-[12px] font-semibold" style={{ color: GOLD_DEEP }}>
              ID {id} · kennel {kennel}
            </p>
            <p className="mt-1 text-[13px] font-medium text-[#4B5563]">
              {vitals}
              {vitals ? " · " : ""}
              {daysWaiting}
            </p>
            {showTimer && (
              <p className="mt-1.5 text-[13px] font-bold" style={{ color: chipColor }}>
                Needs a foster or rescue pull{statusKey === "scheduled" ? " before the date" : " today"}
              </p>
            )}
          </div>

          {/* ===== ADDRESS + QUICK-LINK PILLS (View map · ACS listing · ACS PDF) ===== */}
          <div className="mx-5 mt-3">
            <div className="flex items-start gap-2 text-[12.5px] leading-snug text-[#4B5563]">
              <span className="text-[14px] leading-none">📍</span>
              <span>
                <b>{ACS.fullName}</b> · {ACS.address}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {quickLinks.map((q) => (
                <a
                  key={q.label}
                  href={q.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11.5px] font-bold active:scale-95"
                  style={{ background: q.bg, color: q.fg }}
                >
                  {q.label}
                </a>
              ))}
            </div>
          </div>

          {/* ===== STATUS / ALARM LINE ===== */}
          <div
            className="mx-5 mt-3 rounded-xl border-l-[4px] px-3.5 py-2.5"
            style={{ background: "#FFFBEB", borderColor: chipColor }}
          >
            <p className="text-[12.5px] leading-snug text-[#4B3A12]">
              <span className="font-bold" style={{ color: chipColor }}>
                {badgeLabel}:
              </span>{" "}
              {statusMeta.meaning}{" "}
              <span className="text-[#6B7280]">{statusMeta.action}</span>
            </p>
          </div>

          {/* ===== TIME LEFT ===== */}
          {showTimer && (
            <div className="mx-5 mt-4">
              <EuthTimer animal={animal} variant="block" />
            </div>
          )}

          {/* ===== CAN YOU HELP? action chips ===== */}
          <p className="mx-5 mb-2 mt-5 text-[13px] font-bold" style={{ color: INK }}>
            Can you help {animal.name}?
          </p>
          <div className="mx-5 grid grid-cols-3 gap-2">
            <button
              onClick={() => openModal("foster")}
              className="flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-[12px] font-bold active:scale-95"
              style={{ background: `linear-gradient(135deg, ${GOLD} 0%, ${GOLD_DEEP} 100%)`, color: GOLD_INK }}
            >
              🏠 Foster
            </button>
            <a
              href={adoptMailto}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-[#D9D2C2] bg-white py-2.5 text-[12px] font-bold text-[#1A1611] active:scale-95"
            >
              💛 Adopt
            </a>
            <button
              onClick={() => openModal("rescuer")}
              className="flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-[12px] font-bold text-white active:scale-95"
              style={{ background: `linear-gradient(135deg, ${RED1} 0%, ${RED2} 100%)` }}
            >
              🤝 Rescue pull
            </button>
            <button
              onClick={() => openModal("animal_lover")}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-[#D9D2C2] bg-white py-2.5 text-[12px] font-bold text-[#1A1611] active:scale-95"
            >
              💵 Pledge
            </button>
            <button
              onClick={() => setOtherOpen(true)}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-[#D9D2C2] bg-white py-2.5 text-[12px] font-bold text-[#1A1611] active:scale-95"
            >
              ⋯ Other
            </button>
            <button
              onClick={() => setShareOpen(true)}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-[#D9D2C2] bg-white py-2.5 text-[12px] font-bold text-[#1A1611] active:scale-95"
            >
              📤 Share
            </button>
          </div>

          {/* ===== RESCUE FACTS ===== */}
          <SectionLabel>Rescue facts</SectionLabel>
          <FactGrid items={facts} tone="rescue" />

          {/* ===== MEDICAL ===== */}
          <SectionLabel>Medical · from ACS</SectionLabel>
          <FactGrid items={medical} tone="med" />
          <p className="mx-5 mt-2 text-[11px] italic leading-snug text-[#6B7280]">
            Vaccines and microchip aren't on ACS's capacity list, so they stay "confirm with ACS."
          </p>

          {/* ===== THEIR STORY (warm, built only from ACS's real data) ===== */}
          <SectionLabel>Their story</SectionLabel>
          <div className="mx-5 rounded-xl bg-white px-4 py-3 text-[13.5px] leading-[1.6] text-[#3A2A07] ring-1 ring-black/5">
            {rescueStory}
          </div>
          <p className="mx-5 mt-1.5 text-[10.5px] italic text-[#9CA3AF]">
            Voyce composed this from San Antonio ACS's listing and its own words — nothing invented.
          </p>

          {/* ===== EVALUATION / BEHAVIOR NOTES (verbatim, split by date) ===== */}
          <SectionLabel>Evaluation / behavior · from ACS</SectionLabel>
          {noteEntries.length > 0 ? (
            <div className="mx-5 flex flex-col gap-2.5">
              {noteEntries.map((n, i) => (
                <div
                  key={i}
                  className="overflow-hidden rounded-xl bg-[#FFFBEB] px-4 py-3 ring-1 ring-black/5"
                >
                  {n.date && (
                    <span className="mb-1.5 inline-block rounded-full bg-[#F3E5B6] px-2.5 py-0.5 text-[11px] font-bold text-[#7A5A0A]">
                      {n.date}
                    </span>
                  )}
                  <p className="whitespace-pre-line text-[13.5px] leading-[1.55] text-[#3A2A07]">
                    {n.text}
                  </p>
                </div>
              ))}
              <p className="text-[10.5px] italic text-[#9CA3AF]">
                Source: San Antonio ACS capacity list
                {listDateStr ? `, ${listDateStr}` : ""} — verbatim.
              </p>
            </div>
          ) : (
            <div className="mx-5 rounded-xl bg-[#FFFBEB] px-4 py-3 text-[13.5px] leading-[1.55] text-[#3A2A07] ring-1 ring-black/5">
              <p className="italic text-[#6B7280]">
                No evaluation notes on ACS's list yet — check the ACS listing for the latest.
              </p>
            </div>
          )}

          {/* ===== FIND POSTS & VIDEOS ===== */}
          <SectionLabel>Find posts &amp; videos</SectionLabel>
          <div className="mx-5 rounded-xl bg-[#FFFBEB] p-3.5 ring-1 ring-[#F3E5B6]">
            <p className="text-[12.5px] leading-snug text-[#6B5832]">
              Voyce searches ACS's Facebook, YouTube, and the web by ID. Verify before sharing.
            </p>
            <div className="mt-2.5 grid grid-cols-3 gap-2">
              <a href={findFb} target="_blank" rel="noopener noreferrer"
                 className="rounded-lg bg-[#1877F2] py-2 text-center text-[11px] font-bold text-white shadow-sm active:scale-95">Facebook</a>
              <a href={findYt} target="_blank" rel="noopener noreferrer"
                 className="rounded-lg bg-[#FF0000] py-2 text-center text-[11px] font-bold text-white shadow-sm active:scale-95">YouTube</a>
              <a href={findWeb} target="_blank" rel="noopener noreferrer"
                 className="rounded-lg bg-[#374151] py-2 text-center text-[11px] font-bold text-white shadow-sm active:scale-95">Web</a>
            </div>
            <p className="mt-3 text-[11px] italic text-[#6B5832]">
              Found footage of {animal.name} anywhere? Add the link — we'll credit whoever posted it.
            </p>
            <button
              onClick={() => setAddMediaOpen(true)}
              className="mt-2 w-full rounded-lg border border-[#E1B85B] bg-white py-2 text-[11.5px] font-bold text-[#7A5A0A] transition active:scale-95"
            >
              + Add a video, photo, or post you found
            </button>
          </div>

          {/* ===== CONTACT ACS ===== */}
          <SectionLabel>Contact ACS</SectionLabel>
          <div className="mx-5 grid grid-cols-2 gap-2">
            <a
              href={adoptMailto}
              className="rounded-xl px-3 py-2.5 text-center text-[12px] font-bold shadow-sm transition active:scale-95"
              style={{ background: `linear-gradient(135deg, ${GOLD} 0%, ${GOLD_DEEP} 100%)`, color: GOLD_INK }}
            >
              ✉️ Email adoptions
            </a>
            <a
              href={fosterMailto}
              className="rounded-xl px-3 py-2.5 text-center text-[12px] font-bold shadow-sm transition active:scale-95"
              style={{ background: `linear-gradient(135deg, ${GOLD} 0%, ${GOLD_DEEP} 100%)`, color: GOLD_INK }}
            >
              📝 Foster application
            </a>
            <a
              href={`tel:${ACS.phoneTel}`}
              className="rounded-xl border border-[#D9D2C2] bg-white px-3 py-2.5 text-center text-[12px] font-bold text-[#1A1611] transition active:scale-95"
            >
              📞 {ACS.phone}
            </a>
            <a
              href={ACS.mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl border border-[#D9D2C2] bg-white px-3 py-2.5 text-center text-[12px] font-bold text-[#1A1611] transition active:scale-95"
            >
              🧭 Directions
            </a>
          </div>

          {/* ===== DEADLINE-EMAIL PROCESS BOX (very bottom) ===== */}
          <div
            className="mx-5 mb-5 mt-3 rounded-xl px-4 py-3 text-[12px] leading-[1.5]"
            style={{ background: CREAM, border: `1px solid ${GOLD_DEEP}`, color: "#6B5832" }}
          >
            ⏰ To rescue, foster, or adopt, a placement email must reach{" "}
            <b>{ACS.adoptionsEmail}</b> or <b>{ACS.fosterEmail}</b> before the daily deadline —{" "}
            {DEADLINE_WORDS}.
          </div>
        </article>

      </div>

      {/* SHARE SHEET */}
      {shareOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-0 sm:items-center sm:p-4"
          onClick={() => setShareOpen(false)}
        >
          <div
            className="relative flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between px-5 pt-5">
              <div>
                <h3 className="font-serif text-[19px] font-bold leading-tight">
                  Share {animal.name} (ID {id})
                </h3>
                <p className="mt-1 text-[12px] leading-snug text-[#6B7280]">
                  Every share helps. <b>Nextdoor</b> is best for finding a local rescuer or foster
                  fast — neighbors see neighborhood posts.
                </p>
              </div>
              <button
                onClick={() => setShareOpen(false)}
                aria-label="Close"
                className="ml-2 shrink-0 rounded-full bg-black/5 px-2.5 py-1 text-sm text-foreground/70 hover:bg-black/10"
              >
                ✕
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2.5 overflow-y-auto px-5 pb-6 pt-4">
              {SHARE_SHEET.map((s) => (
                <button
                  key={s.id}
                  onClick={() => {
                    doShare(s.id);
                    if (s.id !== "copy") setShareOpen(false);
                  }}
                  className="flex flex-col items-center gap-1.5 rounded-2xl border border-[#EFE8D6] bg-white px-1.5 py-3 text-center shadow-sm transition active:scale-95"
                >
                  <span
                    className="grid h-10 w-10 place-items-center rounded-full"
                    style={{ background: s.bg, color: s.fg ?? "#fff" }}
                  >
                    {s.iconPath ? <Ico d={s.iconPath} /> : <span className="text-[12px] font-extrabold">{s.mark}</span>}
                  </span>
                  <span className="text-[11.5px] font-bold text-[#1A1611]">{s.label}</span>
                  <span className="text-[9.5px] leading-tight text-[#9CA3AF]">
                    {s.id === "copy" && copied ? "Copied!" : s.sub}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MORE WAYS TO HELP (Other) */}
      {otherOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-0 sm:items-center sm:p-4"
          onClick={() => setOtherOpen(false)}
        >
          <div
            className="relative w-full max-w-md overflow-hidden rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-serif text-[17px] font-bold">More ways to help</h3>
              <button
                onClick={() => setOtherOpen(false)}
                aria-label="Close"
                className="rounded-full bg-black/5 px-2.5 py-1 text-sm text-foreground/70 hover:bg-black/10"
              >
                ✕
              </button>
            </div>
            <div className="flex flex-col gap-2">
              {OTHER_WAYS.map((w) => (
                <button
                  key={w.label}
                  onClick={() => {
                    openModal("animal_lover");
                    setOtherOpen(false);
                  }}
                  className="flex items-center justify-between gap-2 rounded-xl border border-[#EAE2CF] bg-[#FCFAF4] px-3.5 py-3 text-left transition active:scale-[0.99]"
                >
                  <span className="text-[13.5px] font-bold text-[#1A1611]">
                    {w.emoji} {w.label}
                  </span>
                  <span className="rounded-full bg-[#EAF3E7] px-2.5 py-1 text-[10.5px] font-bold text-[#3F6B33]">
                    {w.tag}
                  </span>
                </button>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <input
                value={otherText}
                onChange={(e) => setOtherText(e.target.value)}
                maxLength={90}
                placeholder="Something else — how can you help?"
                className="min-w-0 flex-1 rounded-xl border border-[#D9D2C2] bg-white px-3 py-2.5 text-[13px] outline-none focus:border-[#C9871A]"
              />
              <button
                onClick={() => {
                  openModal("animal_lover");
                  setOtherOpen(false);
                }}
                className="shrink-0 rounded-xl px-4 text-[13px] font-bold text-white"
                style={{ background: GOLD_DEEP }}
              >
                Add
              </button>
            </div>
            <button
              onClick={() => setOtherOpen(false)}
              className="mt-4 w-full rounded-2xl bg-black py-3 text-[13px] font-bold text-white"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* ADD-MEDIA MODAL */}
      {addMediaOpen && (
        <AddMediaModal
          animalId={animal.id}
          animalName={animal.name}
          onClose={() => setAddMediaOpen(false)}
        />
      )}

      <JoinNetworkModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        initialRole={modalRole}
        city="San Antonio"
        animalName={animal.name}
      />
    </div>
  );
}

// ============================================================
// AddMediaModal — saves a found video/photo/post with credit
// ============================================================
function AddMediaModal({
  animalId,
  animalName,
  onClose,
}: {
  animalId: string;
  animalName: string;
  onClose: () => void;
}) {
  const [source, setSource] = useState<"facebook" | "youtube" | "web" | "other">("facebook");
  const [url, setUrl] = useState("");
  const [credit, setCredit] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // Find-by-ID quick search — tap, find the post, copy its link, paste above.
  const enc = encodeURIComponent;
  const findFb = `https://www.facebook.com/sanantonioacs/search?q=${enc(animalId)}`;
  const findYt = `https://www.youtube.com/results?search_query=${enc(`"San Antonio ACS" ${animalId}`)}`;
  const findWeb = `https://www.google.com/search?q=${enc(`"San Antonio ACS" ${animalId} ${animalName}`)}`;

  const submit = async () => {
    setErr(null);
    if (!/^https?:\/\//i.test(url.trim())) {
      setErr("Paste a full link starting with http:// or https://");
      return;
    }
    setBusy(true);
    try {
      await addAnimalMedia({
        data: {
          animalId,
          source,
          url: url.trim(),
          credit: credit.trim() || undefined,
          note: note.trim() || undefined,
        },
      });
      setDone(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't save. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md overflow-hidden rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 rounded-full bg-black/5 px-2.5 py-1 text-sm text-foreground/70 hover:bg-black/10"
        >
          ✕
        </button>

        {done ? (
          <div className="py-6 text-center">
            <div className="text-3xl">🙏</div>
            <h3 className="mt-2 font-serif text-[20px] font-bold">Saved with credit</h3>
            <p className="mt-1 text-[13px] text-foreground/70">
              Thanks for helping verify {animalName}. Volunteers will see it on the card.
            </p>
            <button
              onClick={onClose}
              className="mt-4 rounded-full bg-[#FFDF3B] px-5 py-2.5 text-sm font-bold text-[#3A2A07]"
            >
              Done
            </button>
          </div>
        ) : (
          <>
            <h3 className="font-serif text-[18px] font-bold">Add a video, photo, or post</h3>
            <p className="mt-1 text-[12.5px] text-foreground/70">
              You found {animalName} on another page? Paste the link and credit the source.
            </p>

            {/* Find it by ID — search this animal's pages, then copy the link and paste below */}
            <div className="mt-3 rounded-xl bg-[#FFFBEB] p-3 ring-1 ring-[#F3E5B6]">
              <p className="text-[11px] font-bold uppercase tracking-wide text-[#7A5A0A]">
                🔍 Find it by ID — no typing
              </p>
              <p className="mt-0.5 text-[11.5px] leading-snug text-[#6B5832]">
                Search {animalName}'s pages, then copy the link and paste it below.
              </p>
              <div className="mt-2 grid grid-cols-3 gap-2">
                <a href={findFb} target="_blank" rel="noopener noreferrer"
                   className="rounded-lg bg-[#1877F2] py-2 text-center text-[11px] font-bold text-white shadow-sm active:scale-95">Facebook</a>
                <a href={findYt} target="_blank" rel="noopener noreferrer"
                   className="rounded-lg bg-[#FF0000] py-2 text-center text-[11px] font-bold text-white shadow-sm active:scale-95">YouTube</a>
                <a href={findWeb} target="_blank" rel="noopener noreferrer"
                   className="rounded-lg bg-[#374151] py-2 text-center text-[11px] font-bold text-white shadow-sm active:scale-95">Web</a>
              </div>
            </div>

            <div className="mt-3">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-foreground/60">Source</span>
              <div className="mt-1 grid grid-cols-4 gap-1.5">
                {(["facebook", "youtube", "web", "other"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setSource(s)}
                    className={`rounded-lg border px-2 py-1.5 text-[11px] font-bold capitalize transition ${
                      source === s
                        ? "border-[#C9871A] bg-[#FFF7D6] text-[#7A5A0A]"
                        : "border-[#D9D2C2] bg-white text-[#1A1611]"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <label className="mt-3 block">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-foreground/60">Link *</span>
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://…"
                className="mt-1 w-full rounded-xl border border-[#D9D2C2] bg-white px-3 py-2 text-[14px] outline-none focus:border-[#C9871A]"
              />
            </label>
            <label className="mt-2 block">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-foreground/60">Credit (page or person)</span>
              <input
                value={credit}
                onChange={(e) => setCredit(e.target.value)}
                placeholder="ACS volunteer name / page handle"
                className="mt-1 w-full rounded-xl border border-[#D9D2C2] bg-white px-3 py-2 text-[14px] outline-none focus:border-[#C9871A]"
              />
            </label>
            <label className="mt-2 block">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-foreground/60">Note (optional)</span>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="What's in it?"
                className="mt-1 w-full rounded-xl border border-[#D9D2C2] bg-white px-3 py-2 text-[14px] outline-none focus:border-[#C9871A]"
              />
            </label>

            {err && (
              <div className="mt-3 rounded-xl bg-[#FCE4E4] px-3 py-2 text-[12.5px] font-medium text-[#7E1F1F]">
                {err}
              </div>
            )}

            <button
              onClick={submit}
              disabled={busy}
              className="mt-4 w-full rounded-2xl border-2 border-[#FFDF3B] bg-black px-5 py-3 text-[13px] font-bold uppercase tracking-wide text-white shadow-lg transition active:scale-[0.99] disabled:opacity-70"
            >
              {busy ? "Saving…" : "Save with credit"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
