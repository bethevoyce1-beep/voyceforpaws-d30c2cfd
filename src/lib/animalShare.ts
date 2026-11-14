// One place that decides what a shared shelter animal looks like: the link,
// the message text, and how each app is opened. The board row and the animal
// card both use this, so a share reads the same wherever it starts.
import { statusLabel, normalizeStatusKey, type AcsAnimal } from "@/lib/acs.functions";
import { deadlineForAnimal, formatDeadlineClock } from "@/lib/acs.timer";

export const APP_ORIGIN = "https://app.voyceforpaws.org";

/** The animal's own Voyce page, which carries its photo and name for link previews. */
export function animalUrl(id: string): string {
  return `${APP_ORIGIN}/a/${encodeURIComponent(id)}`;
}

function titleCase(s: string): string {
  return s.toLowerCase().replace(/\b([a-z])/g, (m) => m.toUpperCase());
}

/** ACS coat codes spelled out: "DOMESTIC SH" -> "Domestic Shorthair". */
export function proseBreed(breed: string): string {
  return titleCase(breed)
    .replace(/\bSh\b/g, "Shorthair")
    .replace(/\bMh\b/g, "Medium Hair")
    .replace(/\bLh\b/g, "Longhair");
}

const SEX_WORDS: Record<string, string> = { F: "Female", S: "Spayed female", M: "Male", N: "Neutered male" };

/** "Domestic Shorthair · 3y 3m · Female" */
export function vitalsLine(a: AcsAnimal): string {
  const sex = a.sex ? SEX_WORDS[a.sex.trim().toUpperCase()] ?? a.sex : null;
  return [a.breed ? proseBreed(a.breed) : null, a.age, sex].filter(Boolean).join(" · ");
}

const LISTING_KEYS = new Set(["foster_care", "foster_family_pending", "at_acs"]);

/** "Thu, Nov 14, 5:30 PM CT" — the shelter's deadline in its own time zone. */
export function deadlineWords(a: AcsAnimal): string | null {
  const d = deadlineForAnimal(a);
  if (!d || d.getTime() <= Date.now()) return null;
  const day = d.toLocaleDateString("en-US", {
    timeZone: "America/Chicago",
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  return `${day}, ${formatDeadlineClock(d)}`;
}

export type AnimalShare = { url: string; title: string; text: string };

/**
 * The share message. Only states what the shelter published: the real
 * deadline when there is one, ACS's listing location for animals filed from
 * their listing page, and nothing about a deadline otherwise.
 */
export function buildAnimalShare(a: AcsAnimal, shelterName = "San Antonio ACS"): AnimalShare {
  const name = a.name && a.name !== "Unnamed" ? titleCase(a.name) : "This animal";
  const label = statusLabel(a);
  const key = normalizeStatusKey(a.status_key);
  const url = animalUrl(a.id);
  const vitals = vitalsLine(a);
  const when = deadlineWords(a);

  const lines = [`🚨 ${label}: ${name} (ID ${a.id}) at ${shelterName}`];
  if (when) lines.push(`⏰ Needs out by ${when}`);
  else if (LISTING_KEYS.has(key) && a.custody_location) lines.push(`📍 ACS listing: ${a.custody_location}`);
  if (vitals) lines.push(`🐾 ${vitals}`);
  lines.push("", "Foster, rescue, adopt, or share:", url);

  return { url, title: `${name} needs help · Voyce for Paws`, text: lines.join("\n") };
}

/** True on phones and tablets, where the system share sheet is the right tool. */
export function prefersNativeShare(): boolean {
  if (typeof navigator === "undefined" || typeof window === "undefined") return false;
  const nav = navigator as Navigator & { share?: unknown };
  if (typeof nav.share !== "function") return false;
  return window.matchMedia?.("(pointer: coarse)").matches ?? false;
}

/** Opens the phone's own share sheet. Resolves false when it isn't available. */
export async function shareNative(s: AnimalShare): Promise<boolean> {
  const nav = typeof navigator !== "undefined" ? (navigator as Navigator & { share?: (d: ShareData) => Promise<void> }) : null;
  if (!nav?.share) return false;
  try {
    // The URL is already the last line of the text; passing it separately too
    // makes some apps print it twice.
    await nav.share({ title: s.title, text: s.text });
  } catch {
    // Cancelled by the user — nothing to do.
  }
  return true;
}

export async function copyShare(s: AnimalShare): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(s.text);
    return true;
  } catch {
    return false;
  }
}

/**
 * Where each app's share opens. Apps with no web "share this" link
 * (Instagram, Snapchat, Messenger on desktop) get the text copied first and
 * the app opened, so the person can paste it.
 */
export function shareTarget(platform: string, s: AnimalShare): { href: string; copyFirst?: boolean } | null {
  const enc = encodeURIComponent;
  switch (platform) {
    // Nextdoor requires `source`, and takes the link inside the body (it
    // builds the preview from the last URL in the text).
    case "nextdoor":
      return { href: `https://nextdoor.com/sharekit/?source=voyceforpaws&body=${enc(s.text)}` };
    // Facebook ignores pre-filled text; it builds the post from the page's
    // preview tags, which is why the link is the animal's own Voyce page.
    case "facebook":
      return { href: `https://www.facebook.com/sharer/sharer.php?u=${enc(s.url)}` };
    case "whatsapp":
      return { href: `https://wa.me/?text=${enc(s.text)}` };
    case "x":
      return { href: `https://twitter.com/intent/tweet?text=${enc(s.text.replace(`\n${s.url}`, ""))}&url=${enc(s.url)}` };
    case "telegram":
      return { href: `https://t.me/share/url?url=${enc(s.url)}&text=${enc(s.text.replace(`\n${s.url}`, ""))}` };
    case "linkedin":
      return { href: `https://www.linkedin.com/sharing/share-offsite/?url=${enc(s.url)}` };
    case "reddit":
      return { href: `https://www.reddit.com/submit?url=${enc(s.url)}&title=${enc(s.title)}` };
    case "pinterest":
      return { href: `https://pinterest.com/pin/create/button/?url=${enc(s.url)}&description=${enc(s.text)}` };
    case "email":
      return { href: `mailto:?subject=${enc(s.title)}&body=${enc(s.text)}` };
    case "sms":
      return { href: `sms:?&body=${enc(s.text)}` };
    case "messenger":
      return prefersNativeShare()
        ? { href: `fb-messenger://share/?link=${enc(s.url)}` }
        : { href: "https://www.messenger.com/", copyFirst: true };
    case "instagram":
      return { href: "https://www.instagram.com/", copyFirst: true };
    case "snapchat":
      return { href: "https://www.snapchat.com/", copyFirst: true };
    default:
      return null;
  }
}
