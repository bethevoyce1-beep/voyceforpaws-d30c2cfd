import { useMemo, useState } from "react";
import type { AcsAnimal } from "@/lib/acs.functions";
import {
  buildAnimalShare,
  copyShare,
  prefersNativeShare,
  shareNative,
  shareTarget,
} from "@/lib/animalShare";

// ============================================================
// Share sheet — a labeled grid (platform + one-line purpose). Opened from the
// animal card and from each board row on computers; phones use their own
// share sheet instead (see openAnimalShare).
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

/**
 * Share an animal the same way from anywhere: the phone's own share sheet on
 * phones, otherwise the app grid (`openGrid`).
 */
export function openAnimalShare(a: AcsAnimal, openGrid: () => void) {
  if (prefersNativeShare()) void shareNative(buildAnimalShare(a));
  else openGrid();
}

export function ShareSheet({ animal, onClose }: { animal: AcsAnimal; onClose: () => void }) {
  const share = useMemo(() => buildAnimalShare(animal), [animal]);
  const [copied, setCopied] = useState<string | null>(null);

  const doShare = async (platform: string) => {
    if (platform === "copy") {
      if (await copyShare(share)) {
        setCopied("copy");
        setTimeout(() => setCopied(null), 2000);
      }
      return;
    }
    const t = shareTarget(platform, share);
    if (!t || typeof window === "undefined") return;
    if (t.copyFirst && (await copyShare(share))) {
      // No web share link for this app: copy the message, then open it to paste.
      setCopied(platform);
      setTimeout(() => setCopied(null), 4000);
    }
    window.open(t.href, "_blank", "noopener,noreferrer");
    if (!t.copyFirst) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between px-5 pt-5">
          <div>
            <h3 className="font-serif text-[19px] font-bold leading-tight">
              Share {animal.name} (ID {animal.id})
            </h3>
            <p className="mt-1 text-[12px] leading-snug text-[#6B7280]">
              Every share helps. <b>Nextdoor</b> is best for finding a local rescuer or foster
              fast — neighbors see neighborhood posts.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="ml-2 shrink-0 rounded-full bg-black/5 px-2.5 py-1 text-sm text-foreground/70 hover:bg-black/10"
          >
            ✕
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2.5 overflow-y-auto px-5 pb-3 pt-4">
          {SHARE_SHEET.map((s) => (
            <button
              key={s.id}
              onClick={() => void doShare(s.id)}
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
                {copied === s.id ? (s.id === "copy" ? "Copied!" : "Copied — paste it there") : s.sub}
              </span>
            </button>
          ))}
        </div>
        <p className="px-5 pb-5 text-center text-[10.5px] text-[#9CA3AF]">
          Links open {animal.name}&rsquo;s Voyce page: {share.url.replace("https://", "")}
        </p>
      </div>
    </div>
  );
}
