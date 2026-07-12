import { useEffect, useMemo, useState } from "react";
import type { Assessment } from "@/lib/analyze.functions";
import { animalWord, type MissionId } from "@/lib/missions";
import { BrandHeader } from "@/components/voyce/BrandHeader";
import { JoinNetworkModal } from "@/components/voyce/JoinNetworkModal";
import type { NetworkRole } from "@/lib/signups.functions";

// =============================================================
// Variant kinds — drive every visual + textual choice on the card
// =============================================================
type Kind = "EMERGENCY" | "AT-RISK" | "LOST" | "FOUND" | "PREVENTION" | "WILDLIFE" | "MONITORING" | "SAFE";

type Pill = {
  label: string;
  bg: string;
  text: string;
  role: NetworkRole;
};

type ActionBtn = { icon: string; label: string };

type Variant = {
  kind: Kind;
  badgeIcon: string;
  badgeText: string;
  badgeGradient: string; // background of the photo overlay badge
  title: string;
  titleColor: string;
  subhead: string;
  urgency: {
    bg: string;
    border: string;
    icon: string;
    title: string; // bold prefix
    body: string;
  } | null;
  alertBtn: { label: string; gradient: string } | null;
  actionRow: ActionBtn[] | null;
  urgencyLine: { icon: string; text: string; color: string };
  pills: Pill[];
  helpersBg: string;
  helpersText: string;
  helpersBody: string | null;
  ctaRole: string; // "Rescuer" / "Foster" / "Vet" / "Rehabber"
};

// ----- color tokens -----
const RED1 = "#DC2626";
const RED2 = "#B91C1C";
const GOLD1 = "#F59E0B";
const GOLD2 = "#D97706";
const BLUE1 = "#3B82F6";
const BLUE2 = "#1D4ED8";
const GREEN1 = "#10B981";
const GREEN2 = "#047857";
const TEAL1 = "#14B8A6";
const TEAL2 = "#0E7490";

// =============================================================
// "Correct this" editor data (module scope)
// The reporter can re-categorize the report and flag what a photo
// couldn't show, then send a simulated (pre-launch) pack update.
// =============================================================
const CATEGORIES = [
  { key: "injured",   icon: "🚨", label: "Injured / Sick",              examples: ["Hit by car","Wounded","Sick","Abandoned","Immediate concern"] },
  { key: "shelter",   icon: "🏠", label: "At-Risk Shelter",             examples: ["Shelter deadline","Euthanasia risk","Rescue needed","Foster needed","Adoption needed"] },
  { key: "lostfound", icon: "🐾", label: "Lost & Found",                examples: ["Lost dog","Lost cat","Found pet","Reunion support"] },
  { key: "stray",     icon: "❤️", label: "Stray & Preventative Care",   examples: ["Community cat","Community dog","Food support","Vaccine support","Spay/neuter support","General welfare concern"] },
  { key: "wildlife",  icon: "🦉", label: "Wildlife",                     examples: ["Injured bird","Injured deer","Injured rabbit","Orphaned wildlife","Wildlife concern"] },
];

const WITNESSED = ["Hit by a car","Trapped / in danger","Abuse / cruelty witnessed"];

// Map the mission prop to a "Correct this" category key.
function missionToCat(mission: MissionId): string {
  switch (mission) {
    case "injured":         return "injured";
    case "at-risk-shelter": return "shelter";
    case "lost-found":      return "lostfound";
    case "prevention":      return "stray";
    case "wildlife":        return "wildlife";
    default:                return "injured";
  }
}

const PILL = {
  fosterGreen: { bg: "#D1FAE5", text: "#065F46" },
  rescueRed:   { bg: "#FEE2E2", text: "#991B1B" },
  adoptGold:   { bg: "#FEF3C7", text: "#92400E" },
  pledgeGold:  { bg: "transparent", text: "#92400E" }, // border-only
  transportBlue: { bg: "#DBEAFE", text: "#1E40AF" },
  seenBlue:    { bg: "#DBEAFE", text: "#1E40AF" },
  ownerOrange: { bg: "#FFEDD5", text: "#9A3412" },
  safeholdGreen: { bg: "#D1FAE5", text: "#065F46" },
  fosterPupGreen: { bg: "#D1FAE5", text: "#065F46" },
  tnrPurple:   { bg: "#E0E7FF", text: "#3730A3" },
  vaccPink:    { bg: "#FCE7F3", text: "#9D174D" },
  steriRose:   { bg: "#FFE4E6", text: "#9F1239" },
  volunteerGreen: { bg: "#D1FAE5", text: "#065F46" },
  rehabTeal:   { bg: "#CFFAFE", text: "#155E75" },
};

function kindFor(mission: MissionId, data: Assessment): Kind {
  // If the AI judged the animal healthy/monitoring, use the calm layout instead
  // of the mission's urgent one — mirrors the Rescue Card's monitoring fallback,
  // so a healthy pet is never printed as "URGENT" on the share card either.
  if (data.status === "Safe" && mission !== "at-risk-shelter" && mission !== "wildlife") {
    return "SAFE";
  }
  const healthy = data.status === "Monitoring" || data.status === "Healthy";
  if (healthy && mission !== "at-risk-shelter" && mission !== "wildlife") {
    return "MONITORING";
  }
  switch (mission) {
    case "injured": return "EMERGENCY";
    case "at-risk-shelter": return "AT-RISK";
    case "lost-found": return data.is_likely_pet ? "FOUND" : "LOST";
    case "prevention": return "PREVENTION";
    case "wildlife": return "WILDLIFE";
  }
}

function inferTitle(kind: Kind, data: Assessment): string {
  // Exactness fix (July 5, 2026): headline the most specific animal word —
  // "duck / unknown" breed must read DUCK, not fall back to the species "bird".
  const species = animalWord(data).toLowerCase();
  const Cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  switch (kind) {
    case "EMERGENCY": return `URGENT ${species.toUpperCase()}`;
    case "AT-RISK":   return "AT RISK IN SHELTER";
    case "LOST":      return `LOST ${species.toUpperCase()}`;
    case "FOUND":     return `FOUND ${species.toUpperCase()}`;
    case "PREVENTION": return `${Cap(species)} & community care`;
    case "WILDLIFE":  return `INJURED ${species.toUpperCase()}`;
    case "MONITORING": return `HEALTHY ${species.toUpperCase()}`;
    case "SAFE": return `SAFE ${species.toUpperCase()}`;
  }
}

function inferCity(data: Assessment): string {
  const scene = (data.location_scene || data.environment_text || "").trim();
  // Heuristic — take last comma fragment if looks like a place name
  const tail = scene.split(",").map((s) => s.trim()).filter(Boolean).pop();
  if (tail && /^[A-Z][a-zA-Z .'-]{2,30}$/.test(tail)) return tail;
  return "your city";
}

function inferStreet(data: Assessment): string {
  const scene = (data.location_scene || "").trim();
  const head = scene.split(/[,.]/)[0]?.trim();
  return head && head.length < 50 ? head : "nearby";
}

function variantFor(mission: MissionId, data: Assessment): Variant {
  const kind = kindFor(mission, data);
  const title = inferTitle(kind, data);
  // Pre-launch share cards describe what will happen the moment Voyce launches —
  // one standardized "rippling outward" sentence, personalized with the animal's name.
  const name = shareName(data);
  const preLaunchRipple = `Rippling outward — rescues, fosters & adopters will see ${name} the moment Voyce launches alerts.`;

  switch (kind) {
    case "SAFE":
      return {
        kind,
        badgeIcon: "✓", badgeText: "SAFE",
        badgeGradient: `linear-gradient(135deg, ${GREEN1} 0%, ${GREEN2} 100%)`,
        title, titleColor: GREEN2,
        subhead: "Safe at home — no action needed",
        urgency: {
          bg: "#ECFDF5", border: GREEN1, icon: "✓",
          title: "Safe:",
          body: "Looks like an owned pet at home — no rescue needed.",
        },
        alertBtn: {
          label: "🔔 SHARE TO PACK",
          gradient: `linear-gradient(135deg, ${GREEN1} 0%, ${GREEN2} 100%)`,
        },
        actionRow: [
          { icon: "🧭", label: "Navigate" },
          { icon: "🤝", label: "Volunteer" },
          { icon: "✏️", label: "Add Update" },
          { icon: "📸", label: "Recheck" },
        ],
        urgencyLine: { icon: "✓", text: "Safe — no action needed", color: GREEN2 },
        pills: [
          { label: "Foster",    ...PILL.fosterGreen,    role: "foster" },
          { label: "Adopt",     ...PILL.adoptGold,      role: "animal_lover" },
          { label: "Volunteer", ...PILL.volunteerGreen, role: "animal_lover" },
        ],
        helpersBg: "#ECFDF5", helpersText: "#065F46",
        helpersBody:
          "This animal looks safe at home. No alert is sent — sharing just keeps the community aware.",
        ctaRole: "Volunteer",
      };
    case "MONITORING":
      return {
        kind,
        badgeIcon: "✓", badgeText: "MONITORING",
        badgeGradient: `linear-gradient(135deg, ${GREEN1} 0%, ${GREEN2} 100%)`,
        title, titleColor: GREEN2,
        subhead: "Looks healthy — no action needed",
        urgency: {
          bg: "#ECFDF5", border: GREEN1, icon: "✓",
          title: "No action needed:",
          body: "Appears healthy with no visible injury or distress.",
        },
        alertBtn: {
          label: "🔔 SHARE TO PACK",
          gradient: `linear-gradient(135deg, ${GREEN1} 0%, ${GREEN2} 100%)`,
        },
        actionRow: [
          { icon: "🧭", label: "Navigate" },
          { icon: "🤝", label: "Volunteer" },
          { icon: "✏️", label: "Add Update" },
          { icon: "📸", label: "Recheck" },
        ],
        urgencyLine: { icon: "✓", text: "No immediate action needed", color: GREEN2 },
        pills: [
          { label: "Foster",    ...PILL.fosterGreen,    role: "foster" },
          { label: "Adopt",     ...PILL.adoptGold,      role: "animal_lover" },
          { label: "Volunteer", ...PILL.volunteerGreen, role: "animal_lover" },
        ],
        helpersBg: "#ECFDF5", helpersText: "#065F46",
        helpersBody:
          "This animal appears safe. No urgent alert is sent — sharing just keeps nearby animal lovers aware.",
        ctaRole: "Volunteer",
      };
    case "EMERGENCY":
      return {
        kind,
        badgeIcon: "🚨", badgeText: "URGENT",
        badgeGradient: `linear-gradient(135deg, ${RED1} 0%, ${RED2} 100%)`,
        title, titleColor: RED1,
        subhead: "Needs help immediately",
        urgency: {
          bg: "#FEF2F2", border: RED1, icon: "❤️",
          title: "High Risk:",
          body: data.health_signs?.primary_sign || "Visible injury / medical distress",
        },
        alertBtn: { label: "🔔 SEND URGENT ALERT",
          gradient: `linear-gradient(135deg, ${RED1} 0%, ${RED2} 100%)` },
        actionRow: [
          { icon: "🧭", label: "Navigate" },
          { icon: "📞", label: "Call Rescue" },
          { icon: "🤝", label: "Volunteer" },
          { icon: "✏️", label: "Add Update" },
        ],
        urgencyLine: { icon: "⏰", text: "Help needed within hours", color: RED2 },
        pills: [
          { label: "Foster",    ...PILL.fosterGreen,    role: "foster" },
          { label: "Rescue",    ...PILL.rescueRed,      role: "rescuer" },
          { label: "Adopt",     ...PILL.adoptGold,      role: "animal_lover" },
          { label: "Pledge",    ...PILL.pledgeGold,     role: "animal_lover" },
          { label: "Transport", ...PILL.transportBlue,  role: "animal_lover" },
        ],
        helpersBg: "#FEF2F2", helpersText: "#991B1B",
        helpersBody: preLaunchRipple,
        ctaRole: "Rescuer",
      };
    case "AT-RISK": {
      const deadline = new Date(Date.now() + 1000 * 60 * 60 * 24 * 3).toLocaleDateString(undefined, { month: "short", day: "numeric" });
      return {
        kind,
        badgeIcon: "⏳", badgeText: "AT RISK",
        badgeGradient: `linear-gradient(135deg, ${GOLD1} 0%, ${GOLD2} 100%)`,
        title, titleColor: GOLD2,
        subhead: `Needs placement by ${deadline}`,
        urgency: {
          bg: "#FFFBEB", border: GOLD1, icon: "⏳",
          title: "Time Sensitive:", body: "At risk of euthanasia",
        },
        alertBtn: { label: "🔔 SEND ALERT TO PACK",
          gradient: `linear-gradient(135deg, ${GOLD1} 0%, ${GOLD2} 100%)` },
        actionRow: [
          { icon: "🏠", label: "Foster" },
          { icon: "🐾", label: "Rescue" },
          { icon: "💛", label: "Adopt" },
          { icon: "🏛", label: "Contact ACS" },
        ],
        urgencyLine: { icon: "⚠️", text: "On the euthanasia list · foster needed today", color: GOLD2 },
        pills: [
          { label: "Foster",    ...PILL.fosterGreen,   role: "foster" },
          { label: "Rescue",    ...PILL.rescueRed,     role: "rescuer" },
          { label: "Adopt",     ...PILL.adoptGold,     role: "animal_lover" },
          { label: "Pledge",    ...PILL.pledgeGold,    role: "animal_lover" },
          { label: "Transport", ...PILL.transportBlue, role: "animal_lover" },
        ],
        helpersBg: "#FFFBEB", helpersText: "#92400E",
        helpersBody: preLaunchRipple,
        ctaRole: "Foster",
      };
    }
    case "LOST":
    case "FOUND":
      return {
        kind,
        badgeIcon: kind === "FOUND" ? "📍" : "🔍",
        badgeText: kind,
        badgeGradient: `linear-gradient(135deg, ${BLUE1} 0%, ${BLUE2} 100%)`,
        title, titleColor: BLUE2,
        subhead: kind === "LOST" ? "Help find their way home" : "Looking for owner",
        urgency: {
          bg: "#EFF6FF", border: BLUE1, icon: "🛡️",
          title: kind === "FOUND" ? "Safe & Secure:" : "Last seen:",
          body: kind === "FOUND" ? "Seen by good samaritan" : "Neighbors please look",
        },
        alertBtn: { label: "🔔 NOTIFY THE PACK",
          gradient: `linear-gradient(135deg, ${BLUE1} 0%, ${BLUE2} 100%)` },
        actionRow: [
          { icon: "👁", label: "I've Seen" },
          { icon: "📞", label: "Contact Owner" },
          { icon: "🏠", label: "Safe Hold" },
          { icon: "✏️", label: "Add Update" },
        ],
        urgencyLine: { icon: "🔔", text: "3 possible lost reports nearby · owners notified", color: BLUE2 },
        pills: [
          { label: "I've seen them",     ...PILL.seenBlue,       role: "animal_lover" },
          { label: "Contact owner",      ...PILL.ownerOrange,    role: "animal_lover" },
          { label: "Safe hold",          ...PILL.safeholdGreen,  role: "foster" },
          { label: "Adopt if unclaimed", ...PILL.adoptGold,      role: "animal_lover" },
          { label: "Pledge for care",    ...PILL.rescueRed,      role: "animal_lover" },
        ],
        helpersBg: "#EFF6FF", helpersText: "#1E40AF",
        helpersBody: preLaunchRipple,
        ctaRole: "Animal Lover",
      };
    case "PREVENTION":
      return {
        kind,
        badgeIcon: "🌿", badgeText: "PREVENTION",
        badgeGradient: `linear-gradient(135deg, ${GREEN1} 0%, ${GREEN2} 100%)`,
        title, titleColor: "#0B0B0C",
        subhead: "Care now prevents the next litter",
        urgency: null,
        alertBtn: null,
        actionRow: null,
        urgencyLine: { icon: "💛", text: "Care now prevents the next litter", color: GREEN2 },
        pills: [
          { label: "Foster pups", ...PILL.fosterPupGreen, role: "foster" },
          { label: "Adopt",       ...PILL.adoptGold,      role: "animal_lover" },
          { label: "TNR",         ...PILL.tnrPurple,      role: "rescuer" },
          { label: "Vaccinate",   ...PILL.vaccPink,       role: "vet" },
          { label: "Sterilize",   ...PILL.steriRose,      role: "vet" },
          { label: "Volunteer",   ...PILL.volunteerGreen, role: "animal_lover" },
        ],
        helpersBg: "#ECFDF5", helpersText: "#065F46",
        helpersBody: null,
        ctaRole: "Vet",
      };
    case "WILDLIFE":
      return {
        kind,
        badgeIcon: "🦌", badgeText: "WILDLIFE",
        badgeGradient: `linear-gradient(135deg, ${TEAL1} 0%, ${TEAL2} 100%)`,
        title, titleColor: TEAL2,
        subhead: "Needs licensed wildlife rehabber",
        urgency: {
          bg: "#ECFEFF", border: TEAL1, icon: "🦌",
          title: "Wildlife protocol:", body: "rehabber only",
        },
        alertBtn: { label: "🔔 NOTIFY REHABBERS",
          gradient: `linear-gradient(135deg, ${TEAL1} 0%, ${TEAL2} 100%)` },
        actionRow: [
          { icon: "🧭", label: "Navigate" },
          { icon: "🛑", label: "Stay Back" },
          { icon: "📞", label: "Call Rehab" },
          { icon: "✏️", label: "Add Update" },
        ],
        urgencyLine: { icon: "🌿", text: "Licensed rehabber needed within hours", color: TEAL2 },
        pills: [
          { label: "Rehabber",  ...PILL.rehabTeal,       role: "rescuer" },
          { label: "Transport", ...PILL.transportBlue,   role: "animal_lover" },
          { label: "Safe hold", ...PILL.safeholdGreen,   role: "foster" },
          { label: "Volunteer", ...PILL.volunteerGreen,  role: "animal_lover" },
        ],
        helpersBg: "#ECFEFF", helpersText: "#155E75",
        helpersBody: preLaunchRipple,
        ctaRole: "Rehabber",
      };
  }
}

// =============================================================
// Live ticking stopwatch since report — "every second counts"
// Counts UP every second: MM:SS, then H:MM:SS past an hour.
// =============================================================
function useAgo(reportedAt?: string): string {
  const start = useMemo(
    () => (reportedAt ? new Date(reportedAt).getTime() : Date.now()),
    [reportedAt],
  );
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const total = Math.max(0, Math.floor((now - start) / 1000));
  const s = total % 60;
  const m = Math.floor(total / 60) % 60;
  const h = Math.floor(total / 3600);
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

// =============================================================
// Shareable name (used in heading + share text)
// =============================================================
function shareName(data: Assessment): string {
  const breed = data.breed && !/^(unknown|mixed)/i.test(data.breed) ? data.breed : "";
  const species = data.species || "animal";
  const base = (breed || species).trim();
  return base.charAt(0).toUpperCase() + base.slice(1);
}

// =============================================================
// Master share text — used by every platform (PawBoost-style)
// =============================================================
function buildShareText(data: Assessment, v: Variant, city: string): string {
  const story = (data.first_look || "").split(/[.!]/)[0].trim().slice(0, 100);
  const reported = data.reportedAt
    ? new Date(data.reportedAt).toLocaleString()
    : "just now";
  return [
    `${v.badgeIcon} ${v.title} — needs help in ${city}`,
    ``,
    `🐾 ${story || v.subhead}`,
    `📍 ${inferStreet(data)}, ${city}`,
    `⏰ Reported: ${reported}`,
    ``,
    `How you can help:`,
    `🏠 Foster · 🚑 Rescue · 💛 Adopt · 🤝 Pledge · 🚐 Transport`,
    ``,
    `Voyce is pre-launch — every share grows the pack. Real alerts go to nearest helpers when we launch.`,
    `→ voyceforpaws.lovable.app`,
  ].join("\n");
}

// =============================================================
// SVG share-button icons
// =============================================================
function Ico({ d, viewBox = "0 0 24 24" }: { d: string; viewBox?: string }) {
  return (
    <svg viewBox={viewBox} width="18" height="18" fill="currentColor" aria-hidden>
      <path d={d} />
    </svg>
  );
}

const SHARE_PRIMARY = [
  { id: "nextdoor", label: "Nextdoor", bg: "#5BA32C", text: "#fff", glyph: "ND" },
  { id: "facebook", label: "Facebook", bg: "#1877F2", text: "#fff",
    iconPath: "M22 12a10 10 0 1 0-11.6 9.9v-7H8v-2.9h2.4V9.4c0-2.4 1.5-3.8 3.6-3.8 1 0 2 .2 2 .2v2.3h-1.2c-1.2 0-1.6.7-1.6 1.5V12h2.7l-.4 2.9h-2.3V22A10 10 0 0 0 22 12Z" },
  { id: "whatsapp", label: "WhatsApp", bg: "#25D366", text: "#fff",
    iconPath: "M20 3.5A10 10 0 0 0 4.1 16.6L3 21l4.5-1.1A10 10 0 1 0 20 3.5Zm-5 16a8.4 8.4 0 0 1-4.3-1.2l-.3-.2-2.7.7.7-2.6-.2-.3A8.4 8.4 0 1 1 15 19.5Zm4.6-6.2c-.3-.1-1.5-.7-1.7-.8s-.4-.1-.6.2-.7.8-.8 1-.3.2-.6.1a7 7 0 0 1-3.4-3c-.3-.5.3-.5.8-1.6.1-.2 0-.3 0-.5l-.8-1.9c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.8c.1.2 1.9 2.9 4.6 4.1.6.3 1.2.4 1.6.5a3.8 3.8 0 0 0 1.7-.1c.5-.1 1.5-.6 1.8-1.3.2-.6.2-1.2.1-1.3s-.2-.2-.5-.3Z" },
];

const SHARE_SECONDARY = [
  { id: "x", label: "𝕏", bg: "#000", text: "#fff",
    iconPath: "M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" },
  { id: "copy", label: "Copy", bg: "#4B5563", text: "#fff",
    iconPath: "M16 1H4a2 2 0 0 0-2 2v14h2V3h12V1zm3 4H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2zm0 16H8V7h11v14z" },
];

const SHARE_MORE = [
  { id: "instagram", label: "Instagram", bg: "#E4405F" },
  { id: "snapchat",  label: "Snapchat",  bg: "#FFFC00", text: "#000" },
  { id: "telegram",  label: "Telegram",  bg: "#26A5E4" },
  { id: "messenger", label: "Messenger", bg: "#00B2FF" },
  { id: "reddit",    label: "Reddit",    bg: "#FF4500" },
  { id: "pinterest", label: "Pinterest", bg: "#E60023" },
  { id: "email",     label: "Email",     bg: "#374151" },
  { id: "sms",       label: "SMS",       bg: "#10B981" },
];

// =============================================================
// Animal-info pill fields — compact chips under the species line.
// One chip per available field; empty or "unknown" values are skipped.
// =============================================================
const INFO_FIELDS: { label: string; key: keyof Assessment }[] = [
  { label: "Species", key: "species" },
  { label: "Breed",   key: "breed" },
  { label: "Age",     key: "age" },
  { label: "Size",    key: "size" },
  { label: "Weight",  key: "weight" },
  { label: "Color",   key: "color" },
];

// Capitalize the first letter of an AI-confidence value ("high" → "High").
function capWord(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

// =============================================================
// Component
// =============================================================
export function ShareCard({
  image,
  data,
  mission,
  location,
  onContinue,
}: {
  image: string;
  data: Assessment;
  mission: MissionId;
  location?: { lat: number; lon: number; label: string } | null;
  onContinue: () => void;
}) {
  const v = useMemo(() => variantFor(mission, data), [mission, data]);
  const city = useMemo(() => inferCity(data), [data]);
  const street = useMemo(() => inferStreet(data), [data]);
  const ago = useAgo(data.reportedAt);
  const name = useMemo(() => shareName(data), [data]);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalRole, setModalRole] = useState<NetworkRole | undefined>();
  const [shareMoreOpen, setShareMoreOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  // Collapsible "See what Voyce read" — reveals the full AI read inline on the
  // last card, so the reporter can review every observation without leaving.
  const [showRead, setShowRead] = useState(false);

  // "Correct this" editor state — lets the reporter fix the category and note
  // what the photo couldn't show, then send a simulated (pre-launch) update.
  const [cat, setCat] = useState<string>(missionToCat(mission));
  const [examples, setExamples] = useState<string[]>([]);
  const [witnessed, setWitnessed] = useState<string[]>([]);
  const [sentUpdate, setSentUpdate] = useState(false);

  // Confirm / add-or-correct the location. A photo often lacks GPS and the map
  // may show the reporter's own location, not the animal's — so let the reporter
  // type an exact address or cross-streets. When set, `manualLoc` overrides the
  // incoming `location` prop everywhere the card builds its map / directions.
  const [manualLoc, setManualLoc] = useState<
    { lat: number; lon: number; label: string } | null
  >(null);
  const [addrInput, setAddrInput] = useState("");
  const [geocoding, setGeocoding] = useState(false);

  // Effective location the card renders from — manual override wins, else prop.
  const effectiveLoc = manualLoc ?? location ?? null;

  // Forward-geocode the typed address with OpenStreetMap Nominatim. If it
  // resolves, use its coords + display_name; if not (or the fetch fails), still
  // keep the typed text as the displayed label so a hand-typed address is never
  // lost. Coords stay NaN in that case so map links fall back to an address search.
  const setLocationFromInput = async () => {
    const q = addrInput.trim();
    if (!q || geocoding) return;
    setGeocoding(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1`,
        { headers: { Accept: "application/json" } },
      );
      const results = (await res.json()) as Array<{
        lat: string;
        lon: string;
        display_name: string;
      }>;
      const hit = Array.isArray(results) ? results[0] : undefined;
      if (hit) {
        setManualLoc({
          lat: parseFloat(hit.lat),
          lon: parseFloat(hit.lon),
          label: hit.display_name || q,
        });
      } else {
        setManualLoc({ lat: NaN, lon: NaN, label: q });
      }
    } catch {
      // Network / parse failure — accept the typed text as the label anyway.
      setManualLoc({ lat: NaN, lon: NaN, label: q });
    } finally {
      setGeocoding(false);
    }
  };

  // Effective coords are only usable for a coordinate map link if both are real
  // numbers; a hand-typed address with no geocode falls back to a search link.
  const hasCoords =
    !!effectiveLoc &&
    Number.isFinite(effectiveLoc.lat) &&
    Number.isFinite(effectiveLoc.lon);
  const mapHref = effectiveLoc
    ? hasCoords
      ? `https://www.google.com/maps/dir/?api=1&destination=${effectiveLoc.lat},${effectiveLoc.lon}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(effectiveLoc.label)}`
    : null;

  const openModal = (role?: NetworkRole) => {
    setModalRole(role);
    setModalOpen(true);
  };

  const speciesLine = useMemo(
    () =>
      [data.breed, data.age, data.species, data.weight]
        .filter((x) => x && !/^unknown/i.test(x))
        .join(" · "),
    [data],
  );

  // Animal-info chips — one per non-empty, non-"unknown" field (module INFO_FIELDS order).
  const infoPills = useMemo(
    () =>
      INFO_FIELDS.map((f) => ({ label: f.label, value: (data[f.key] as unknown) }))
        .filter(
          (p): p is { label: string; value: string } =>
            typeof p.value === "string" && p.value.trim() !== "" && !/^unknown$/i.test(p.value.trim()),
        ),
    [data],
  );

  const story = useMemo(() => {
    const t = (data.first_look || "").trim();
    return t.length > 220 ? t.slice(0, 217) + "…" : t;
  }, [data]);

  const shareText = useMemo(() => buildShareText(data, v, city), [data, v, city]);
  const shareUrl =
    typeof window !== "undefined" ? window.location.origin : "https://voyceforpaws.lovable.app";

  const doShare = (platform: string) => {
    const enc = encodeURIComponent;
    const intents: Record<string, string> = {
      nextdoor: `https://nextdoor.com/sharekit/?body=${enc(shareText)}&url=${enc(shareUrl)}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${enc(shareUrl)}&quote=${enc(shareText)}`,
      whatsapp: `https://wa.me/?text=${enc(shareText + "\n" + shareUrl)}`,
      x:        `https://twitter.com/intent/tweet?text=${enc(shareText)}&url=${enc(shareUrl)}`,
      telegram: `https://t.me/share/url?url=${enc(shareUrl)}&text=${enc(shareText)}`,
      reddit:   `https://www.reddit.com/submit?url=${enc(shareUrl)}&title=${enc(v.title)}`,
      pinterest:`https://pinterest.com/pin/create/button/?url=${enc(shareUrl)}&description=${enc(shareText)}`,
      email:    `mailto:?subject=${enc(v.title)}&body=${enc(shareText + "\n" + shareUrl)}`,
      sms:      `sms:?&body=${enc(shareText + "\n" + shareUrl)}`,
      messenger:`https://www.facebook.com/dialog/send?link=${enc(shareUrl)}&app_id=0`,
      instagram:`https://www.instagram.com/`,
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

  // Toggle a value in/out of a string[] state array (multi-select chips).
  const toggleIn = (
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    value: string,
  ) => setter((arr) => (arr.includes(value) ? arr.filter((x) => x !== value) : [...arr, value]));

  const selectedCat = CATEGORIES.find((c) => c.key === cat);
  const catExamples = selectedCat?.examples ?? [];

  // Short structured health fields — rendered as scannable chips inside the read
  // panel (label + value), one chip per available value.
  const healthChips = useMemo(
    () =>
      [
        { label: "Condition", value: data.visible_condition },
        { label: "Body", value: data.vet_notes?.bcs },
        { label: "Posture", value: data.vet_notes?.posture },
        { label: "Hydration", value: data.vet_notes?.hydration },
      ].filter(
        (c): c is { label: string; value: string } =>
          typeof c.value === "string" && c.value.trim() !== "",
      ),
    [data],
  );

  return (
    <div className="min-h-[100dvh] bg-[#FAF8F5]">
      <BrandHeader />

      <div className="mx-auto w-full max-w-[420px] px-4 pb-10 pt-4">
        {/* ============ SHAREABLE CARD ============ */}
        <article className="overflow-hidden rounded-2xl border-2 border-[#E8C97A] bg-white shadow-lg shadow-[0_18px_50px_-22px_rgba(20,15,5,0.35)] ring-1 ring-black/5">
          {/* PHOTO */}
          <div className="relative w-full overflow-hidden bg-black" style={{ aspectRatio: "4/3" }}>
            <img src={image} alt={name} className="absolute inset-0 h-full w-full object-cover" />

            {/* Badge top-left */}
            <span
              className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-extrabold uppercase tracking-[0.12em] text-white shadow-lg"
              style={{ background: v.badgeGradient }}
            >
              <span>{v.badgeIcon}</span>
              <span>{v.badgeText}</span>
            </span>

            {/* Top-right: JUST REPORTED + live ago */}
            <div className="absolute right-3 top-3 flex flex-col items-end gap-1">
              <span className="rounded-full bg-black/65 px-2.5 py-1 text-[9.5px] font-bold uppercase tracking-[0.14em] text-white/95 backdrop-blur">
                Just Reported
              </span>
              <span className="rounded-full bg-white/95 px-2.5 py-0.5 text-[10.5px] font-bold text-[#0B0B0C] shadow-sm tabular-nums">
                ⏱ {ago} waiting
              </span>
            </div>
          </div>

          {/* CONTENT */}
          <div className="px-5 pb-5 pt-5">
            {/* Title */}
            <h2
              className="font-serif font-bold leading-[1.05] tracking-tight"
              style={{ color: v.titleColor, fontSize: 26 }}
            >
              {v.title}
            </h2>
            {/* Subhead */}
            <p className="mt-1 font-serif text-[16px] italic font-semibold leading-snug text-[#6B7280]">
              {v.subhead}
            </p>

            {/* Species */}
            {speciesLine && (
              <p className="mt-2 text-[14px] font-medium text-[#6B7280]">{speciesLine}</p>
            )}

            {/* ============ ANIMAL INFO — compact pills + report-detail pills ============ */}
            {(infoPills.length > 0 || effectiveLoc) && (
              <div className="mt-3">
                {/* Chips: one per available animal-info field */}
                {infoPills.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {infoPills.map((p) => (
                      <span
                        key={p.label}
                        className="inline-flex items-center gap-1 rounded-full border border-[#EDE5D8] bg-white px-2.5 py-1 text-[13px]"
                      >
                        <span className="text-[#9CA3AF]">{p.label}</span>
                        <span className="font-bold text-[#374151]">{p.value}</span>
                      </span>
                    ))}
                  </div>
                )}

                {/* Report-detail chips: Case # · AI confidence · Reported by · Date */}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {data.caseId && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-[#EDE5D8] bg-white px-2.5 py-1 text-[13px]">
                      <span className="text-[#9CA3AF]">Case #</span>
                      <span className="font-bold text-[#374151]">{data.caseId}</span>
                    </span>
                  )}
                  {data.ai_confidence && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-[#EDE5D8] bg-white px-2.5 py-1 text-[13px]">
                      <span className="text-[#9CA3AF]">AI confidence</span>
                      <span className="font-bold text-[#374151]">{capWord(String(data.ai_confidence))}</span>
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1 rounded-full border border-[#EDE5D8] bg-white px-2.5 py-1 text-[13px]">
                    <span className="text-[#9CA3AF]">Reported by</span>
                    <span className="font-bold text-[#374151]">Reporter</span>
                  </span>
                  {data.reportedAt && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-[#EDE5D8] bg-white px-2.5 py-1 text-[13px]">
                      <span className="text-[#9CA3AF]">Date</span>
                      <span className="font-bold text-[#374151]">{new Date(data.reportedAt).toLocaleDateString()}</span>
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* ============ LOCATION — most important control for a rescuer ============ */}
            <div className="mt-4">
              {/* Current location label — shown first, directly under the info chips */}
              <p className="flex items-start gap-1.5 text-[14px] font-medium text-[#374151]">
                <span style={{ color: "#FFDF3B" }}>📍</span>
                <span>{effectiveLoc?.label || `Near ${street} · ${city}`}</span>
              </p>

              {/* View Map & Directions — below the address line */}
              {mapHref && (
                <a
                  href={mapHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-[14px] px-4 py-3.5 text-[14px] font-extrabold uppercase tracking-wide text-white shadow-md transition active:scale-[0.99] hover:brightness-105"
                  style={{ background: `linear-gradient(135deg, ${BLUE1} 0%, ${BLUE2} 100%)` }}
                >
                  <span>🗺️</span>
                  <span>View Map &amp; Directions</span>
                </a>
              )}

              {/* 2. Confirm / add / correct the address — always visible */}
              <div className="mt-2 rounded-xl border border-[#C7DBFF] bg-[#EFF6FF] px-3.5 py-3">
                <p className="text-[13.5px] leading-relaxed text-[#1E3A8A]">
                  📍 Is this where the animal is? If the map is off, add the exact
                  address or nearest cross-streets.
                </p>
                <div className="mt-2.5 flex flex-col gap-2 sm:flex-row">
                  <label htmlFor="voyce-address" className="sr-only">
                    Exact address or nearest cross-streets
                  </label>
                  <input
                    id="voyce-address"
                    type="text"
                    inputMode="text"
                    value={addrInput}
                    onChange={(e) => setAddrInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void setLocationFromInput();
                      }
                    }}
                    placeholder="e.g. 5th Ave & Main St, Springfield"
                    className="min-w-0 flex-1 rounded-[10px] border border-[#C7DBFF] bg-white px-3 py-2.5 text-[14px] text-[#111827] outline-none transition placeholder:text-[#9CA3AF] focus:border-[#1D4ED8] focus:ring-2 focus:ring-[#93C5FD]"
                  />
                  <button
                    type="button"
                    onClick={() => void setLocationFromInput()}
                    disabled={geocoding || !addrInput.trim()}
                    className="shrink-0 rounded-[10px] px-4 py-2.5 text-[13px] font-extrabold uppercase tracking-wide text-white shadow-sm transition active:scale-95 hover:brightness-105 disabled:opacity-50"
                    style={{ background: `linear-gradient(135deg, ${BLUE1} 0%, ${BLUE2} 100%)` }}
                  >
                    {geocoding ? "Setting…" : "Set location"}
                  </button>
                </div>
                {manualLoc && (
                  <p className="mt-2 text-[12.5px] font-semibold text-[#047857]">
                    ✓ Location updated for the map and directions.
                  </p>
                )}
              </div>
            </div>

            {/* Story */}
            {story && (
              <p className="mt-3 line-clamp-3 text-[16px] italic leading-relaxed text-[#4B5563]">
                {`“${story}”`}
              </p>
            )}

            {/* Urgency block */}
            {v.urgency && (
              <div
                className="mt-4 flex items-start gap-2.5 rounded-xl border-l-[4px] px-3.5 py-2.5"
                style={{ background: v.urgency.bg, borderColor: v.urgency.border }}
              >
                <span className="text-[18px] leading-none">{v.urgency.icon}</span>
                <p className="text-[15px] font-bold leading-relaxed" style={{ color: v.urgency.border }}>
                  {v.urgency.title}{" "}
                  <span className="font-semibold opacity-90">{v.urgency.body}</span>
                </p>
              </div>
            )}

            {/* Big alert button */}
            {v.alertBtn && (
              <button
                onClick={() => openModal()}
                className="mt-4 w-full rounded-[14px] px-4 py-3.5 text-[13.5px] font-extrabold uppercase tracking-wide text-white shadow-md transition active:scale-[0.99]"
                style={{ background: v.alertBtn.gradient }}
              >
                {v.alertBtn.label}
              </button>
            )}

            {/* 4-button action row */}
            {v.actionRow && (
              <div className="mt-3 grid grid-cols-4 gap-2">
                {v.actionRow.map((a) => (
                  <button
                    key={a.label}
                    onClick={() => openModal()}
                    className="flex flex-col items-center justify-center gap-1 rounded-xl bg-[#F3F4F6] px-1.5 py-2 text-[10.5px] font-semibold text-[#374151] transition hover:bg-[#E5E7EB] active:scale-95"
                  >
                    <span className="text-[16px] leading-none">{a.icon}</span>
                    <span>{a.label}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Urgency line */}
            <p
              className="mt-4 flex items-center gap-1.5 text-[14px] font-bold"
              style={{ color: v.urgencyLine.color }}
            >
              <span>{v.urgencyLine.icon}</span>
              <span>{v.urgencyLine.text}</span>
            </p>

            {/* I CAN HELP AS */}
            <p className="mt-4 text-[12px] font-bold uppercase tracking-[0.1em] text-[#9CA3AF]">
              I can help as:
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {v.pills.map((p) => (
                <button
                  key={p.label}
                  onClick={() => openModal(p.role)}
                  className="rounded-full px-3.5 py-2 text-[14px] font-bold transition active:scale-95"
                  style={{
                    background: p.bg,
                    color: p.text,
                    border: p.bg === "transparent" ? `1.5px solid ${p.text}` : "none",
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Divider */}
            <div className="my-[18px] h-px w-full bg-[#F3F4F6]" />

            {/* OR SHARE */}
            <p className="text-center text-[12px] font-bold uppercase tracking-[0.14em] text-[#9CA3AF]">
              Or share to get more eyes on {name}
            </p>

            {/* Row 1: 3 columns */}
            <div className="mt-3 grid grid-cols-3 gap-2">
              {SHARE_PRIMARY.map((s) => (
                <button
                  key={s.id}
                  onClick={() => doShare(s.id)}
                  className="flex flex-col items-center justify-center gap-1 rounded-xl py-2.5 text-[10.5px] font-bold shadow-sm transition active:scale-95"
                  style={{ background: s.bg, color: s.text }}
                  aria-label={`Share to ${s.label}`}
                >
                  {"iconPath" in s && s.iconPath ? <Ico d={s.iconPath} /> : (
                    <span className="text-[11px] font-extrabold tracking-tight">{s.glyph}</span>
                  )}
                  <span>{s.label}</span>
                </button>
              ))}
            </div>

            {/* Row 2: 2 columns */}
            <div className="mt-2 grid grid-cols-2 gap-2">
              {SHARE_SECONDARY.map((s) => (
                <button
                  key={s.id}
                  onClick={() => doShare(s.id)}
                  className="flex items-center justify-center gap-2 rounded-xl py-2.5 text-[12px] font-bold shadow-sm transition active:scale-95"
                  style={{ background: s.bg, color: s.text }}
                  aria-label={`Share to ${s.label}`}
                >
                  <Ico d={s.iconPath} />
                  <span>{s.id === "copy" && copied ? "Copied!" : s.label}</span>
                </button>
              ))}
            </div>

            {/* Row 3: More */}
            <button
              onClick={() => setShareMoreOpen(true)}
              className="mt-2 w-full rounded-xl border-[1.5px] border-[#FFDF3B] bg-black py-2.5 text-[12px] font-bold tracking-wide text-[#FFDF3B] transition active:scale-[0.99]"
            >
              ⋯  More share options
            </button>

            {/* ============ SEE WHAT VOYCE READ (collapsible full AI read) ============ */}
            <div className="mt-4">
              <button
                onClick={() => setShowRead((s) => !s)}
                aria-expanded={showRead}
                className="flex w-full items-center justify-between gap-2 rounded-xl px-4 py-3.5 text-[13px] font-bold uppercase tracking-wide shadow-md transition hover:brightness-105 active:scale-[0.99]"
                style={{ background: "linear-gradient(135deg, #FFDF3B 0%, #C9871A 100%)", color: "#3A2A07" }}
              >
                <span>📋 {showRead ? "Hide Rescue Card & Health Assessment" : "Rescue Card & Health Assessment detail"}</span>
                <span className="text-[12px] leading-none opacity-80">{showRead ? "▲" : "→"}</span>
              </button>

              {showRead && (
                <div className="mt-2 space-y-3 rounded-xl border border-[#F0E4C6] bg-[#FFFDF7] px-4 py-4">
                  {data.first_look && (
                    <div>
                      <p className="text-[12px] font-bold uppercase tracking-[0.1em] text-[#C9871A]">
                        ✨ Voyce's First Look
                      </p>
                      <p className="mt-1 text-[15px] leading-relaxed text-[#4B5563]">{data.first_look}</p>
                    </div>
                  )}

                  {data.behavior && (
                    <div>
                      <p className="text-[12px] font-bold uppercase tracking-[0.1em] text-[#9CA3AF]">
                        Behavior
                      </p>
                      <p className="mt-1 text-[15px] leading-relaxed text-[#4B5563]">{data.behavior}</p>
                    </div>
                  )}

                  {/* Short structured health fields — scannable chips */}
                  {healthChips.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {healthChips.map((c) => (
                        <span
                          key={c.label}
                          className="inline-flex items-center gap-1 rounded-full border border-[#EDE5D8] bg-white px-2.5 py-1 text-[13px]"
                        >
                          <span className="text-[#9CA3AF]">{c.label}</span>
                          <span className="font-bold text-[#374151]">{c.value}</span>
                        </span>
                      ))}
                    </div>
                  )}

                  {Array.isArray(data.observations) && data.observations.length > 0 && (
                    <div>
                      <p className="text-[12px] font-bold uppercase tracking-[0.1em] text-[#9CA3AF]">
                        What Voyce observed
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {data.observations.map((o, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center rounded-full border border-[#EDE5D8] bg-white px-2.5 py-1 text-[13px] font-medium text-[#374151]"
                          >
                            {o}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {Array.isArray(data.symptoms) && data.symptoms.length > 0 && (
                    <div>
                      <p className="text-[12px] font-bold uppercase tracking-[0.1em] text-[#9CA3AF]">
                        Possible signs
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {data.symptoms.map((s, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center rounded-full border border-[#EDE5D8] bg-white px-2.5 py-1 text-[13px] font-medium text-[#374151]"
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {data.vet_notes?.clinical && (
                    <div>
                      <p className="text-[12px] font-bold uppercase tracking-[0.1em] text-[#9CA3AF]">
                        Summary — not a diagnosis
                      </p>
                      <p className="mt-1 text-[15px] leading-relaxed text-[#4B5563]">{data.vet_notes.clinical}</p>
                    </div>
                  )}

                  {data.environment_text && (
                    <div>
                      <p className="text-[12px] font-bold uppercase tracking-[0.1em] text-[#9CA3AF]">
                        Where we found them
                      </p>
                      <p className="mt-1 text-[15px] leading-relaxed text-[#4B5563]">{data.environment_text}</p>
                    </div>
                  )}

                  {Array.isArray(data.next_steps) && data.next_steps.length > 0 && (
                    <div>
                      <p className="text-[12px] font-bold uppercase tracking-[0.1em] text-[#C9871A]">
                        Suggested next steps
                      </p>
                      <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[15px] leading-relaxed text-[#4B5563]">
                        {data.next_steps.map((n, i) => (
                          <li key={i}>{n}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* ============ CORRECT THIS — re-categorize + flag what the photo missed ============ */}
                  <div className="rounded-xl border border-[#F0E4C6] bg-white px-3.5 py-3.5">
                    {!sentUpdate ? (
                      <>
                        <p className="text-[15px] font-extrabold text-[#3A2A07]">Not quite right? Fix it</p>
                        <p className="mt-0.5 text-[14px] leading-relaxed text-[#9CA3AF]">
                          Correct the category and tell us what the photo couldn't show.
                        </p>

                        {/* a. What is this? — single-select category pills */}
                        <p className="mt-3 text-[12px] font-bold uppercase tracking-[0.1em] text-[#9CA3AF]">
                          What is this?
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {CATEGORIES.map((c) => {
                            const active = c.key === cat;
                            return (
                              <button
                                key={c.key}
                                onClick={() => {
                                  setCat(c.key);
                                  setExamples([]);
                                }}
                                className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[14px] font-bold transition active:scale-95"
                                style={{
                                  background: active ? "#FFDF3B" : "#FFFDF7",
                                  color: active ? "#3A2A07" : "#6B7280",
                                  border: active ? "1.5px solid #C9871A" : "1.5px solid #F0E4C6",
                                }}
                              >
                                <span>{c.icon}</span>
                                <span>{c.label}</span>
                              </button>
                            );
                          })}
                        </div>

                        {/* b. Examples for the selected category — multi-select chips */}
                        {catExamples.length > 0 && (
                          <>
                            <p className="mt-3 text-[12px] font-bold uppercase tracking-[0.1em] text-[#9CA3AF]">
                              {selectedCat?.label} — what fits?
                            </p>
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {catExamples.map((ex) => {
                                const active = examples.includes(ex);
                                return (
                                  <button
                                    key={ex}
                                    onClick={() => toggleIn(setExamples, ex)}
                                    className="rounded-full px-3 py-1.5 text-[14px] font-semibold transition active:scale-95"
                                    style={{
                                      background: active ? "#FFDF3B" : "#FFFDF7",
                                      color: active ? "#3A2A07" : "#6B7280",
                                      border: active ? "1.5px solid #C9871A" : "1.5px solid #F0E4C6",
                                    }}
                                  >
                                    {ex}
                                  </button>
                                );
                              })}
                            </div>
                          </>
                        )}

                        {/* c. What the photo couldn't show — multi-select chips */}
                        <p className="mt-3 text-[12px] font-bold uppercase tracking-[0.1em] text-[#9CA3AF]">
                          What the photo couldn't show
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {WITNESSED.map((w) => {
                            const active = witnessed.includes(w);
                            return (
                              <button
                                key={w}
                                onClick={() => toggleIn(setWitnessed, w)}
                                className="rounded-full px-3 py-1.5 text-[14px] font-semibold transition active:scale-95"
                                style={{
                                  background: active ? "#FFDF3B" : "#FFFDF7",
                                  color: active ? "#3A2A07" : "#6B7280",
                                  border: active ? "1.5px solid #C9871A" : "1.5px solid #F0E4C6",
                                }}
                              >
                                {w}
                              </button>
                            );
                          })}
                        </div>

                        {/* d. Buttons */}
                        <button
                          onClick={() => setSentUpdate(true)}
                          className="mt-4 w-full rounded-[14px] px-4 py-3 text-[13px] font-extrabold uppercase tracking-wide shadow-md transition active:scale-[0.99]"
                          style={{ background: "linear-gradient(135deg,#FFDF3B,#C9871A)", color: "#3A2A07" }}
                        >
                          🔔 Update &amp; notify the pack
                        </button>
                        <button
                          onClick={() => setShowRead(false)}
                          className="mt-2 w-full rounded-[14px] border-[1.5px] border-[#F0E4C6] bg-white px-4 py-2.5 text-[12.5px] font-semibold text-[#9CA3AF] transition active:scale-[0.99]"
                        >
                          Nothing to change
                        </button>
                      </>
                    ) : (
                      /* e. Green confirmation banner (simulated, pre-launch) */
                      <div className="rounded-xl border border-[#A7F3D0] bg-[#ECFDF5] px-3.5 py-3.5">
                        <p className="text-[15px] font-extrabold text-[#065F46]">✅ Update sent to the pack</p>
                        <p className="mt-1 text-[14px] leading-relaxed text-[#047857]">
                          Updated to {selectedCat?.label ?? "Injured / Sick"}
                          {examples.length > 0 ? `, ${examples.join(", ")}` : ""}
                          {witnessed.length > 0 ? ` · Flagged: ${witnessed.join(", ")}` : ""}
                        </p>
                        <p className="mt-2 text-[12px] italic leading-relaxed text-[#059669]">
                          Your report and the update are safe — this is a preview of launch alerts.
                        </p>
                      </div>
                    )}
                  </div>

                  <p className="border-t border-[#F0E4C6] pt-3 text-[12px] italic leading-relaxed text-[#9CA3AF]">
                    AI observations &amp; suggestions — not a diagnosis. Confirm with a licensed vet.
                  </p>
                </div>
              )}
            </div>

            {/* Nearby helpers footer */}
            {v.helpersBody && (
              <div
                className="mt-5 -mx-5 -mb-5 flex items-start gap-2.5 px-5 py-3.5"
                style={{ background: v.helpersBg, color: v.helpersText }}
              >
                <span className="text-[15px] leading-none">👥</span>
                <p className="text-[14px] leading-relaxed font-medium">{v.helpersBody}</p>
              </div>
            )}
          </div>
        </article>

        {/* PRE-LAUNCH BANNER */}
        <p
          className="mx-auto mt-4 max-w-[360px] text-center text-[14px] italic leading-relaxed"
          style={{ color: "#C9871A" }}
        >
          🐾 Pre-launch · shares grow Voyce.<br />
          Real alerts launch with the app.
        </p>

        {/* BE THE FIRST CTA */}
        <div
          className="mt-4 rounded-2xl px-5 py-5 text-center shadow-[0_10px_30px_-15px_rgba(217,119,6,0.55)]"
          style={{
            background: "linear-gradient(135deg, #FFDF3B 0%, #F59E0B 100%)",
            color: "#3A2A07",
          }}
        >
          <h3 className="font-serif text-[18px] font-bold leading-tight">
            Be the first {v.ctaRole} in {city}
          </h3>
          <p className="mt-1.5 text-[15px] leading-relaxed">
            Join the pack so the next animal in need reaches you — not no one.
          </p>
          <button
            onClick={() => openModal()}
            className="mt-3 w-full rounded-full bg-black px-5 py-3 text-[12.5px] font-extrabold uppercase tracking-wider text-[#FFDF3B] transition active:scale-[0.99]"
          >
            Join the Pack →
          </button>
        </div>

        {/* Continue */}
        <div className="mt-6 flex justify-center">
          <button
            onClick={onContinue}
            className="text-[12.5px] font-semibold text-[#8A5A0E] underline-offset-2 hover:underline"
          >
            Continue to status →
          </button>
        </div>
      </div>

      {/* MORE SHARE MODAL */}
      {shareMoreOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-0 sm:items-center sm:p-4"
          onClick={() => setShareMoreOpen(false)}
        >
          <div
            className="relative w-full max-w-md overflow-hidden rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-serif text-[17px] font-bold">More share options</h3>
              <button
                onClick={() => setShareMoreOpen(false)}
                aria-label="Close"
                className="rounded-full bg-black/5 px-2.5 py-1 text-sm text-foreground/70 hover:bg-black/10"
              >
                ✕
              </button>
            </div>
            <div className="grid grid-cols-4 gap-2.5">
              {SHARE_MORE.map((s) => (
                <button
                  key={s.id}
                  onClick={() => {
                    doShare(s.id);
                    setShareMoreOpen(false);
                  }}
                  className="flex flex-col items-center justify-center gap-1.5 rounded-xl py-3 text-[10.5px] font-bold shadow-sm transition active:scale-95"
                  style={{ background: s.bg, color: s.text ?? "#fff" }}
                >
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-white/25 text-[12px] font-extrabold">
                    {s.label.charAt(0)}
                  </span>
                  <span>{s.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <JoinNetworkModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        initialRole={modalRole}
        city={city === "your city" ? undefined : city}
        animalName={name}
      />
    </div>
  );
}
