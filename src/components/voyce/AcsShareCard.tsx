import { useEffect, useMemo, useState } from "react";
import { BrandHeader } from "@/components/voyce/BrandHeader";
import { JoinNetworkModal } from "@/components/voyce/JoinNetworkModal";
import { supabase } from "@/integrations/supabase/client";
import type { AcsAnimal } from "@/lib/acs.functions";
import type { NetworkRole } from "@/lib/signups.functions";

// ============================================================
// SAN ANTONIO ACS — hardcoded partner contact info
// ============================================================
const ACS = {
  name: "San Antonio ACS",
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

// ============================================================
// Countdown to today's capacity deadline (UPDATED June 30, 2026)
//   Mon–Fri 5:00 PM, Sat 12:30 PM, Sun closed (rolls to Monday 5:00 PM)
//   Previous (now wrong): Mon–Fri 12:30 PM, Sat 11:00 AM
// ============================================================
function nextDeadline(now = new Date()): Date {
  const d = new Date(now);
  for (let i = 0; i < 7; i++) {
    const day = d.getDay(); // 0 Sun .. 6 Sat
    const target = new Date(d);
    if (day === 0) {
      // Sunday — ACS closed; roll to Monday 5:00 PM
      target.setDate(d.getDate() + 1);
      target.setHours(17, 0, 0, 0);
    } else if (day === 6) {
      // Saturday — capacity deadline 12:30 PM
      target.setHours(12, 30, 0, 0);
    } else {
      // Mon–Fri — capacity deadline 5:00 PM
      target.setHours(17, 0, 0, 0);
    }
    if (target.getTime() > now.getTime()) return target;
    d.setDate(d.getDate() + 1);
    d.setHours(0, 0, 0, 0);
  }
  return now;
}

function useCountdown(): string {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const ms = Math.max(0, nextDeadline(new Date(now)).getTime() - now);
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

// ============================================================
// Master share text (PawBoost-style)
// ============================================================
function buildShareText(a: AcsAnimal, deepLink: string): string {
  const story = (a.story || "").split(/[.!]/)[0].trim().slice(0, 100);
  return [
    `🚨 URGENT — ${a.name} needs help at ${ACS.name}`,
    ``,
    `🐾 ${story || `${a.days_at_shelter} days in the kennel — needs out today.`}`,
    ``,
    `📍 ${ACS.name} · ID ${a.kennel_id ?? "—"}`,
    `⏰ ${a.days_at_shelter} days at shelter · capacity deadline today`,
    ``,
    `How you can help:`,
    `🏠 Foster · 🚑 Rescue · 💛 Adopt · 🤝 Pledge · 🚐 Transport`,
    ``,
    `📞 Contact ACS: ${ACS.phone}`,
    `🔗 Real ACS listing: ${deepLink}`,
    ``,
    `Voyce is pre-launch — every share grows the rescue community network. Real alerts go to nearest helpers when we launch.`,
    `→ voyceforpaws.lovable.app`,
  ].join("\n");
}

// ============================================================
// Share platform metadata
// ============================================================
function Ico({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden>
      <path d={d} />
    </svg>
  );
}

const SHARE_PRIMARY = [
  { id: "nextdoor", label: "Nextdoor", bg: "#5BA32C", text: "#fff", glyph: "ND" },
  { id: "facebook", label: "Facebook", bg: "#1877F2", text: "#fff",
    iconPath: "M22 12a10 10 0 1 0-11.6 9.9v-7H8v-2.9h2.4V9.4c0-2.4 1.5-3.8 3.6-3.8 1 0 2 .2 2 .2v2.3h-1.2c-1.2 0-1.6.7-1.6 1.5V12h2.7l-.4 2.9h-2.3V22A10 10 0 0 0 22 12Z" },
  { id: "whatsapp", label: "WhatsApp", bg: "#25D366", text: "#fff",
    iconPath: "M20 3.5A10 10 0 0 0 4.1 16.6L3 21l4.5-1.1A10 10 0 1 0 20 3.5Zm-5 16a8.4 8.4 0 0 1-4.3-1.2l-.3-.2-2.7.7.7-2.6-.2-.3A8.4 8.4 0 1 1 15 19.5Z" },
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
  const countdown = useCountdown();
  const [modalOpen, setModalOpen] = useState(false);
  const [modalRole, setModalRole] = useState<NetworkRole | undefined>();
  const [shareMoreOpen, setShareMoreOpen] = useState(false);
  const [addMediaOpen, setAddMediaOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const openModal = (role?: NetworkRole) => {
    setModalRole(role);
    setModalOpen(true);
  };

  const id = animal.kennel_id ?? "—";
  const NAME = animal.name.toUpperCase();
  const kennel = animal.kennel ?? id;
  const specLine = [animal.breed, animal.age, animal.color, `kennel ${kennel}`, `${animal.days_at_shelter}d`]
    .filter(Boolean)
    .join(" · ");

  const acsDeepLink = `${ACS.searchPage}?id=${encodeURIComponent(id)}`;
  const pdfDeepLink = `${ACS.pdfList}#${encodeURIComponent(id)}`;
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
      reddit: `https://www.reddit.com/submit?url=${enc(shareUrl)}&title=${enc(`URGENT — ${animal.name} at ${ACS.name}`)}`,
      pinterest: `https://pinterest.com/pin/create/button/?url=${enc(shareUrl)}&description=${enc(shareText)}`,
      email: `mailto:?subject=${enc(`URGENT — ${animal.name} needs help at ${ACS.name}`)}&body=${enc(shareText + "\n" + shareUrl)}`,
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

  return (
    <div style={{ minHeight: "100dvh", background: PAPER }}>
      <BrandHeader />

      <div className="mx-auto w-full max-w-[420px] px-4 pb-10 pt-3" style={{ color: INK }}>
        <article
          className="overflow-hidden rounded-2xl bg-white ring-1 ring-black/5"
          style={{ boxShadow: "0 22px 60px -28px rgba(20,15,5,0.45)" }}
        >
          {/* ===== 1. HERO PHOTO ===== */}
          <div className="relative w-full overflow-hidden bg-black" style={{ aspectRatio: "4/3" }}>
            <img
              src={animal.photo_url}
              alt={animal.name}
              className="absolute inset-0 h-full w-full object-cover"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
            {/* days */}
            <span className="absolute left-3 top-3 rounded-full bg-black/80 px-3 py-1 text-[11px] font-bold text-white shadow-lg">
              {animal.days_at_shelter} days at shelter
            </span>
            {/* IMMEDIATE RISK */}
            <span
              className="absolute right-3 top-3 rounded-full px-3 py-1 text-[10.5px] font-extrabold uppercase tracking-[0.12em] text-white shadow-lg"
              style={{ background: `linear-gradient(135deg, ${RED1} 0%, ${RED2} 100%)` }}
            >
              ⏰ Immediate Risk
            </span>
            {/* countdown */}
            <span
              className="absolute bottom-3 right-3 rounded-full px-3 py-1 text-[12px] font-extrabold text-white shadow-lg tabular-nums"
              style={{ background: `linear-gradient(135deg, ${RED1} 0%, ${RED2} 100%)` }}
            >
              ⏳ {countdown}
            </span>
          </div>

          {/* ===== 2. NAME BLOCK ===== */}
          <div className="px-5 pb-2 pt-5">
            <h2 className="font-serif text-[28px] font-bold leading-[1.05] tracking-tight" style={{ color: INK }}>
              {NAME}
            </h2>
            <p className="mt-1 text-[12px] text-[#6B7280]">
              ID {id} · Kennel {kennel}
            </p>
            <p className="mt-1 text-[13px] font-medium text-[#4B5563]">{specLine}</p>
          </div>

          {/* ===== 3. TIME LEFT CARD ===== */}
          <div className="mx-5 my-4 rounded-xl border-l-[4px] px-3.5 py-3" style={{ background: "#FEF2F2", borderColor: RED1 }}>
            <p className="text-[10.5px] font-extrabold uppercase tracking-[0.12em]" style={{ color: RED2 }}>
              ⏳ Time left before today's capacity deadline
            </p>
            <p className="mt-1 font-mono text-[22px] font-extrabold tabular-nums" style={{ color: RED2 }}>
              {countdown}
            </p>
            <p className="mt-1 text-[11.5px] text-[#6B7280]">
              ACS capacity euthanasia · 5:00 PM Mon–Fri / 12:30 PM Sat · confirm with ACS
            </p>
          </div>

          {/* ===== 4. THEIR STORY ===== */}
          <div className="mx-5 mb-4 overflow-hidden rounded-xl ring-1 ring-black/5">
            <div
              className="flex items-center gap-2 px-4 py-2 text-[10.5px] font-bold uppercase tracking-[0.12em] text-white"
              style={{ background: `linear-gradient(135deg, ${GOLD} 0%, ${GOLD_DEEP} 100%)` }}
            >
              <span>🐾</span>
              <span>Their Story · from ACS / shelter volunteers</span>
            </div>
            <p className="bg-[#FFFBEB] px-4 py-3 text-[14px] leading-[1.55] text-[#3A2A07]">
              {animal.story ||
                `${animal.name} has been waiting ${animal.days_at_shelter} days in kennel ${kennel}. ACS volunteers know this dog well — calm, kennel-stressed, ready for a soft place to land.`}
            </p>
          </div>

          {/* ===== 5. SHELTER CONTACT ===== */}
          <div className="mx-5 mb-4 grid grid-cols-2 gap-2">
            <a
              href={adoptMailto}
              className="rounded-xl px-3 py-2.5 text-center text-[12px] font-bold shadow-sm transition active:scale-95"
              style={{ background: `linear-gradient(135deg, ${GOLD} 0%, ${GOLD_DEEP} 100%)`, color: GOLD_INK }}
            >
              ✉️ Email Adoptions
            </a>
            <a
              href={fosterMailto}
              className="rounded-xl px-3 py-2.5 text-center text-[12px] font-bold shadow-sm transition active:scale-95"
              style={{ background: `linear-gradient(135deg, ${GOLD} 0%, ${GOLD_DEEP} 100%)`, color: GOLD_INK }}
            >
              📝 Foster Application
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
              📍 Directions
            </a>
          </div>

          {/* ===== 6. FIND VIDEOS & POSTS ===== */}
          <div className="mx-5 mb-4 rounded-xl bg-[#FFFBEB] p-3.5 ring-1 ring-[#F3E5B6]">
            <p className="text-[10.5px] font-bold uppercase tracking-[0.12em]" style={{ color: GOLD_DEEP }}>
              🔍 Find videos & posts
            </p>
            <p className="mt-1 text-[12.5px] leading-snug text-[#6B5832]">
              Voyce searches ACS's Facebook + YouTube + the web by ID. Verify before sharing.
            </p>
            <p className="mt-2.5 text-[11px] font-bold" style={{ color: GOLD_DEEP }}>
              📌 Auto-find this dog's videos & posts
            </p>
            <div className="mt-2 grid grid-cols-3 gap-2">
              <a href={findFb} target="_blank" rel="noopener noreferrer"
                 className="rounded-lg bg-[#1877F2] py-2 text-center text-[11px] font-bold text-white shadow-sm active:scale-95">Facebook</a>
              <a href={findYt} target="_blank" rel="noopener noreferrer"
                 className="rounded-lg bg-[#FF0000] py-2 text-center text-[11px] font-bold text-white shadow-sm active:scale-95">YouTube</a>
              <a href={findWeb} target="_blank" rel="noopener noreferrer"
                 className="rounded-lg bg-[#374151] py-2 text-center text-[11px] font-bold text-white shadow-sm active:scale-95">Web</a>
            </div>
            <p className="mt-3 text-[11px] italic text-[#6B5832]">
              Searches ACS pages by {id}. Found the right one? Tap below to save it with credit.
            </p>
            <button
              onClick={() => setAddMediaOpen(true)}
              className="mt-2 w-full rounded-lg border border-[#E1B85B] bg-white py-2 text-[11.5px] font-bold text-[#7A5A0A] transition active:scale-95"
            >
              + Add a video, photo, or post you found
            </button>
          </div>

          {/* ===== 7. MAIN ACTION ROW ===== */}
          <div className="mx-5 mb-4 grid grid-cols-5 gap-1.5">
            <button
              onClick={() => openModal("rescuer")}
              className="flex flex-col items-center justify-center gap-0.5 rounded-lg py-2.5 text-[10px] font-extrabold uppercase tracking-wide text-white shadow-sm active:scale-95"
              style={{ background: `linear-gradient(135deg, ${RED1} 0%, ${RED2} 100%)` }}
            >
              <span className="text-[14px]">🆘</span>
              <span>Help</span>
            </button>
            <button
              onClick={() => openModal("rescuer")}
              className="flex flex-col items-center justify-center gap-0.5 rounded-lg py-2.5 text-[10px] font-extrabold uppercase tracking-wide active:scale-95"
              style={{ background: `linear-gradient(135deg, ${GOLD} 0%, ${GOLD_DEEP} 100%)`, color: GOLD_INK }}
            >
              <span className="text-[14px]">🐾</span>
              <span>Rescue</span>
            </button>
            <button
              onClick={() => openModal("foster")}
              className="flex flex-col items-center justify-center gap-0.5 rounded-lg py-2.5 text-[10px] font-extrabold uppercase tracking-wide active:scale-95"
              style={{ background: `linear-gradient(135deg, ${GOLD} 0%, ${GOLD_DEEP} 100%)`, color: GOLD_INK }}
            >
              <span className="text-[14px]">🏠</span>
              <span>Foster</span>
            </button>
            <a
              href={adoptMailto}
              className="flex flex-col items-center justify-center gap-0.5 rounded-lg border border-[#D9D2C2] bg-white py-2.5 text-[10px] font-extrabold uppercase tracking-wide text-[#1A1611] active:scale-95"
            >
              <span className="text-[14px]">💛</span>
              <span>Adopt</span>
            </a>
            <button
              onClick={() => doShare("copy")}
              className="flex flex-col items-center justify-center gap-0.5 rounded-lg border border-[#D9D2C2] bg-white py-2.5 text-[10px] font-extrabold uppercase tracking-wide text-[#1A1611] active:scale-95"
            >
              <span className="text-[14px]">📤</span>
              <span>Share</span>
            </button>
          </div>

          {/* ===== 8. ACS DEEP LINK (black) ===== */}
          <a
            href={acsDeepLink}
            target="_blank"
            rel="noopener noreferrer"
            className="mx-5 mb-2 block rounded-xl bg-black px-4 py-3 transition active:scale-[0.99]"
          >
            <p className="text-[10.5px] font-bold uppercase tracking-[0.12em]" style={{ color: GOLD }}>
              🏛 {ACS.name.toUpperCase()} · ID {id}
            </p>
            <p className="mt-0.5 text-[12.5px] font-semibold" style={{ color: GOLD }}>
              🔗 See {animal.name}'s real photos & notes on ACS →
            </p>
          </a>

          {/* ===== 9. ACS PDF DEEP LINK ===== */}
          <a
            href={pdfDeepLink}
            target="_blank"
            rel="noopener noreferrer"
            className="mx-5 mb-4 block rounded-xl px-4 py-3 transition active:scale-[0.99]"
            style={{ background: CREAM, border: `1px solid ${GOLD_DEEP}` }}
          >
            <p className="text-[10.5px] font-bold uppercase tracking-[0.12em]" style={{ color: GOLD_DEEP }}>
              📋 ACS PDF list entry · {NAME} only
            </p>
            <p className="mt-0.5 text-[12px] text-[#6B5832]">
              Shows ONLY {animal.name}'s row — no other animals
            </p>
          </a>

          {/* ===== 10. VOYCE APP CTA with countdown ===== */}
          <button
            onClick={() => openModal("animal_lover")}
            className="mx-5 mb-4 flex w-[calc(100%-2.5rem)] items-center justify-between gap-3 rounded-xl px-4 py-3 text-left shadow-md transition active:scale-[0.99]"
            style={{ background: `linear-gradient(135deg, ${GOLD} 0%, ${GOLD_DEEP} 100%)`, color: GOLD_INK }}
          >
            <div className="min-w-0">
              <p className="text-[10.5px] font-extrabold uppercase tracking-[0.14em]">🎯 The Voyce App</p>
              <p className="mt-0.5 truncate text-[13px] font-bold">Help {animal.name} the moment we launch</p>
            </div>
            <span className="flex-none rounded-full bg-black/85 px-2.5 py-1 text-[11px] font-extrabold tabular-nums" style={{ color: GOLD }}>
              {countdown}
            </span>
          </button>

          {/* ===== 11. I CAN HELP AS pills ===== */}
          <p className="mx-5 text-[10.5px] font-bold uppercase tracking-[0.1em] text-[#9CA3AF]">
            I can help as:
          </p>
          <div className="mx-5 mt-2 flex flex-wrap gap-1.5">
            {[
              { label: "Foster", role: "foster" as NetworkRole, bg: "#D1FAE5", text: "#065F46" },
              { label: "Rescue", role: "rescuer" as NetworkRole, bg: "#FEE2E2", text: "#991B1B" },
              { label: "Adopt", role: "animal_lover" as NetworkRole, bg: "#FEF3C7", text: "#92400E" },
              { label: "Pledge", role: "animal_lover" as NetworkRole, bg: "transparent", text: "#92400E" },
              { label: "Transport", role: "animal_lover" as NetworkRole, bg: "#DBEAFE", text: "#1E40AF" },
            ].map((p) => (
              <button
                key={p.label}
                onClick={() => openModal(p.role)}
                className="rounded-full px-3.5 py-2 text-[12.5px] font-bold transition active:scale-95"
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

          {/* divider */}
          <div className="my-[18px] mx-5 h-px bg-[#F3F4F6]" />

          {/* ===== 12. SHARE SECTION ===== */}
          <p className="mx-5 text-center text-[10px] font-bold uppercase tracking-[0.14em] text-[#9CA3AF]">
            Or share to help save {animal.name}
          </p>
          <div className="mx-5 mt-3 grid grid-cols-3 gap-2">
            {SHARE_PRIMARY.map((s) => (
              <button
                key={s.id}
                onClick={() => doShare(s.id)}
                className="flex flex-col items-center justify-center gap-1 rounded-xl py-2.5 text-[10.5px] font-bold shadow-sm active:scale-95"
                style={{ background: s.bg, color: s.text }}
                aria-label={`Share to ${s.label}`}
              >
                {"iconPath" in s && s.iconPath ? <Ico d={s.iconPath} /> : (
                  <span className="text-[11px] font-extrabold">{s.glyph}</span>
                )}
                <span>{s.label}</span>
              </button>
            ))}
          </div>
          <div className="mx-5 mt-2 grid grid-cols-2 gap-2">
            {SHARE_SECONDARY.map((s) => (
              <button
                key={s.id}
                onClick={() => doShare(s.id)}
                className="flex items-center justify-center gap-2 rounded-xl py-2.5 text-[12px] font-bold shadow-sm active:scale-95"
                style={{ background: s.bg, color: s.text }}
                aria-label={`Share to ${s.label}`}
              >
                <Ico d={s.iconPath} />
                <span>{s.id === "copy" && copied ? "Copied!" : s.label}</span>
              </button>
            ))}
          </div>
          <button
            onClick={() => setShareMoreOpen(true)}
            className="mx-5 mt-2 mb-5 block w-[calc(100%-2.5rem)] rounded-xl border-[1.5px] border-[#FFDF3B] bg-black py-2.5 text-[12px] font-bold tracking-wide text-[#FFDF3B] transition active:scale-[0.99]"
          >
            ⋯  More share options
          </button>

          {/* ===== 13. NEARBY HELPERS FOOTER ===== */}
          <div
            className="flex items-start gap-2.5 px-5 py-3.5"
            style={{ background: CREAM, color: "#7A5A0A" }}
          >
            <span className="text-[15px] leading-none">👥</span>
            <p className="text-[11.5px] leading-[1.45] font-medium">
              Closest shelter partners & rescuers get it first, rippling outward — rescues, fosters &
              adopters will see {animal.name} the moment Voyce launches alerts.
            </p>
          </div>
        </article>

        {/* ===== 14. PRE-LAUNCH BANNER ===== */}
        <p
          className="mx-auto mt-4 max-w-[360px] text-center text-[12px] italic leading-[1.5]"
          style={{ color: GOLD_DEEP }}
        >
          🐾 Pre-launch · shares grow Voyce.<br />
          Real alerts launch with the app.
        </p>

        {/* ===== 15. BE THE FIRST CTA ===== */}
        <div
          className="mt-4 rounded-2xl px-5 py-5 text-center"
          style={{
            background: `linear-gradient(135deg, ${GOLD} 0%, ${GOLD_DEEP} 100%)`,
            color: GOLD_INK,
            boxShadow: "0 10px 30px -15px rgba(217,119,6,0.55)",
          }}
        >
          <h3 className="font-serif text-[18px] font-bold leading-tight">
            Be the first Rescue Partner in San Antonio
          </h3>
          <p className="mt-1.5 text-[13px] leading-[1.45]">
            Join the network so the next at-risk shelter animal reaches you — not no one.
          </p>
          <button
            onClick={() => openModal("rescuer")}
            className="mt-3 w-full rounded-full bg-black px-5 py-3 text-[12.5px] font-extrabold uppercase tracking-wider"
            style={{ color: GOLD }}
          >
            Join the Network →
          </button>
        </div>

        <div className="mt-6 flex justify-center">
          <button
            onClick={onContinue}
            className="text-[12.5px] font-semibold underline-offset-2 hover:underline"
            style={{ color: GOLD_DEEP }}
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
                  className="flex flex-col items-center justify-center gap-1.5 rounded-xl py-3 text-[10.5px] font-bold shadow-sm active:scale-95"
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

  const submit = async () => {
    setErr(null);
    if (!/^https?:\/\//i.test(url.trim())) {
      setErr("Paste a full link starting with http:// or https://");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.from("acs_animal_media").insert({
        animal_id: animalId,
        source,
        url: url.trim(),
        credit: credit.trim() || null,
        note: note.trim() || null,
      });
      if (error) throw error;
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
