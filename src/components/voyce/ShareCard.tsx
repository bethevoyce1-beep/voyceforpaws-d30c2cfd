import { useMemo, useState } from "react";
import type { Assessment } from "@/lib/analyze.functions";
import { MISSIONS, type MissionId } from "@/lib/missions";
import { BrandHeader } from "@/components/voyce/BrandHeader";
import { JoinNetworkModal } from "@/components/voyce/JoinNetworkModal";
import type { NetworkRole } from "@/lib/signups.functions";

type Variant = {
  header: string;          // header bar color
  badge: string;           // mission badge text
  badgeIcon: string;
  title: string;           // title color
  urgencyBg: string;
  urgencyText: string;
  urgencyIcon: string;
  urgencyLine: string;
  ctaRole: string;         // "Rescuer", "Foster", etc — used in "Be the first ___"
  pills: { icon: string; label: string; bg: string; text: string; role: NetworkRole }[];
};

const RED = "#C9302C";
const GOLD = "#D97706";
const BLUE = "#2563EB";
const GREEN = "#047857";
const TEAL = "#0E7490";

function pill(label: string, icon: string, bg: string, text: string, role: NetworkRole) {
  return { label, icon, bg, text, role };
}

function variantFor(mission: MissionId, data: Assessment): Variant {
  switch (mission) {
    case "injured":
      return {
        header: RED, badge: "URGENT", badgeIcon: "🚨", title: RED,
        urgencyBg: "#FDECEC", urgencyText: "#7E1F1F", urgencyIcon: "🚨",
        urgencyLine: "Help needed within hours",
        ctaRole: "Rescuer",
        pills: [
          pill("Foster",    "🏠", "#FFF7D6", "#7A5A0E", "foster"),
          pill("Rescue",    "🐾", "#FDECEC", "#7E1F1F", "rescuer"),
          pill("Adopt",     "💛", "#FFE9B0", "#5A3F08", "animal_lover"),
          pill("Pledge",    "🤝", "#F5EDDC", "#5A3F08", "animal_lover"),
          pill("Transport", "🚐", "#EAF2FF", "#1E3A8A", "animal_lover"),
        ],
      };
    case "at-risk-shelter":
      return {
        header: GOLD, badge: "AT RISK", badgeIcon: "⏳", title: GOLD,
        urgencyBg: "#FFF4E0", urgencyText: "#7A4A07", urgencyIcon: "⏳",
        urgencyLine: "Foster or pull commitment needed today",
        ctaRole: "Foster",
        pills: [
          pill("Foster",    "🏠", "#FFF7D6", "#7A5A0E", "foster"),
          pill("Rescue",    "🐾", "#FDECEC", "#7E1F1F", "rescuer"),
          pill("Adopt",     "💛", "#FFE9B0", "#5A3F08", "animal_lover"),
          pill("Pledge",    "🤝", "#F5EDDC", "#5A3F08", "animal_lover"),
          pill("Transport", "🚐", "#EAF2FF", "#1E3A8A", "animal_lover"),
        ],
      };
    case "lost-found":
      return {
        header: BLUE,
        badge: data.is_likely_pet ? "FOUND" : "LOST",
        badgeIcon: data.is_likely_pet ? "📍" : "🔍",
        title: BLUE,
        urgencyBg: "#EAF2FF", urgencyText: "#1E3A8A", urgencyIcon: "🔍",
        urgencyLine: data.is_likely_pet
          ? "Help reunite this pet with their family"
          : "Last seen nearby — neighbors please look",
        ctaRole: "Animal Lover",
        pills: [
          pill("I've seen them", "👁",  "#EAF2FF", "#1E3A8A", "animal_lover"),
          pill("Contact owner",  "📞",  "#EAF2FF", "#1E3A8A", "animal_lover"),
          pill("Safe hold",      "🏠",  "#FFF7D6", "#7A5A0E", "foster"),
          pill("Adopt if unclaimed", "💛", "#FFE9B0", "#5A3F08", "animal_lover"),
          pill("Pledge for care", "🤝", "#F5EDDC", "#5A3F08", "animal_lover"),
        ],
      };
    case "prevention":
      return {
        header: GREEN, badge: "PREVENTION", badgeIcon: "🌿", title: GREEN,
        urgencyBg: "#E7F5EC", urgencyText: "#0F3A22", urgencyIcon: "🌿",
        urgencyLine: "Care now prevents the next litter",
        ctaRole: "Animal Lover",
        pills: [
          pill("Foster pups", "🏠", "#FFF7D6", "#7A5A0E", "foster"),
          pill("Adopt",       "💛", "#FFE9B0", "#5A3F08", "animal_lover"),
          pill("TNR",         "✂",  "#E7F5EC", "#0F3A22", "rescuer"),
          pill("Vaccinate",   "💉", "#E7F5EC", "#0F3A22", "vet"),
          pill("Sterilize",   "🔧", "#E7F5EC", "#0F3A22", "vet"),
          pill("Volunteer",   "🌳", "#E7F5EC", "#0F3A22", "animal_lover"),
        ],
      };
    case "wildlife":
      return {
        header: TEAL, badge: "WILDLIFE", badgeIcon: "🦌", title: TEAL,
        urgencyBg: "#E4F0F8", urgencyText: "#0F2A3A", urgencyIcon: "🦌",
        urgencyLine: "Licensed rehabber needed — do not handle",
        ctaRole: "Animal Lover",
        pills: [
          pill("Rehabber",  "📞", "#E4F0F8", "#0F2A3A", "rescuer"),
          pill("Transport", "🚐", "#EAF2FF", "#1E3A8A", "animal_lover"),
          pill("Safe hold", "🏠", "#FFF7D6", "#7A5A0E", "foster"),
          pill("Volunteer", "🌳", "#E7F5EC", "#0F3A22", "animal_lover"),
        ],
      };
  }
}

function shareName(data: Assessment): string {
  const breed = data.breed && !/unknown|mixed/i.test(data.breed) ? data.breed : "";
  const species = data.species || "animal";
  return (breed || species).replace(/^\w/, (c) => c.toUpperCase());
}

function locationLine(data: Assessment): string {
  const scene = data.location_scene || "";
  const short = scene.split(/[.,]/)[0].trim();
  return short && short.length < 60 ? short : "Location pinned nearby";
}

function buildShareText(data: Assessment, mission: MissionId, v: Variant): string {
  const m = MISSIONS[mission];
  const name = shareName(data);
  const where = locationLine(data);
  const first = (data.first_look || "").split(".")[0].trim();
  const helpLines = mission === "lost-found"
    ? `👁 I've seen them\n📞 Contact owner\n🏠 Safe hold\n💛 Adopt if unclaimed\n🤝 Pledge for care`
    : `🏠 Foster temporarily\n🚑 Pull / Rescue\n❤️ Adopt\n🤝 Pledge support\n🚐 Help transport`;
  return [
    `${v.badgeIcon} ${name} — ${v.urgencyLine} near ${where}`,
    ``,
    `🐾 ${first || m.callout.body}`,
    `📍 Spotted: ${where}`,
    `⏰ Reported: just now`,
    ``,
    `How you can help:`,
    helpLines,
    ``,
    `Voyce is pre-launch. Every share grows the rescue community network. When we launch fully, real alerts go to nearest helpers instantly.`,
    `See live cases or join → voyceforpaws.lovable.app`,
  ].join("\n");
}

type SharePlatform = "nextdoor" | "facebook" | "whatsapp" | "x" | "copy";

const PLATFORMS: { id: SharePlatform; label: string; icon: string; bg: string; text: string }[] = [
  { id: "nextdoor", label: "Nextdoor", icon: "🏘", bg: "#1F9D57", text: "#FFFFFF" },
  { id: "facebook", label: "Facebook", icon: "📘", bg: "#1877F2", text: "#FFFFFF" },
  { id: "whatsapp", label: "WhatsApp", icon: "💬", bg: "#25D366", text: "#FFFFFF" },
  { id: "x",        label: "X",        icon: "✕",  bg: "#111111", text: "#FFFFFF" },
  { id: "copy",     label: "Copy link",icon: "📋", bg: "#E5E5E5", text: "#1F1F1F" },
];

export function ShareCard({
  image,
  data,
  mission,
  onContinue,
}: {
  image: string;
  data: Assessment;
  mission: MissionId;
  onContinue: () => void;
}) {
  const v = useMemo(() => variantFor(mission, data), [mission, data]);
  const m = MISSIONS[mission];
  const [modalOpen, setModalOpen] = useState(false);
  const [modalRole, setModalRole] = useState<NetworkRole | undefined>();
  const [copied, setCopied] = useState(false);

  const name = useMemo(() => {
    if (data.is_likely_pet) return shareName(data);
    const species = data.species ? data.species.charAt(0).toUpperCase() + data.species.slice(1) : "animal";
    return `Stray ${species}`;
  }, [data]);

  const where = useMemo(() => locationLine(data), [data]);
  const story = useMemo(() => {
    const t = (data.first_look || "").trim();
    return t.length > 220 ? t.slice(0, 217) + "…" : t;
  }, [data]);

  const openModal = (role?: NetworkRole) => {
    setModalRole(role);
    setModalOpen(true);
  };

  const share = (platform: SharePlatform) => {
    const text = buildShareText(data, mission, v);
    const url = typeof window !== "undefined" ? window.location.origin : "https://voyceforpaws.lovable.app";
    const enc = encodeURIComponent;
    if (platform === "copy") {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        void navigator.clipboard.writeText(`${text}\n${url}`).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        });
      }
      return;
    }
    const intents: Record<Exclude<SharePlatform, "copy">, string> = {
      nextdoor: `https://nextdoor.com/sharekit/?body=${enc(text)}&url=${enc(url)}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}&quote=${enc(text)}`,
      whatsapp: `https://wa.me/?text=${enc(text + "\n" + url)}`,
      x:        `https://twitter.com/intent/tweet?text=${enc(text)}&url=${enc(url)}`,
    };
    if (typeof window !== "undefined") {
      window.open(intents[platform], "_blank", "noopener,noreferrer");
    }
  };

  return (
    <div className="min-h-[100dvh] bg-[#FAF8F5] pb-32">
      <BrandHeader />

      <div className="mx-auto w-full max-w-2xl px-4 pt-5">
        <div className="mb-3 text-center">
          <h1 className="font-serif text-[22px] font-bold tracking-tight text-[#0B0B0C]">
            Share to Build the Network
          </h1>
          <p className="mt-1 text-[13px] text-foreground/65">
            Every share grows the rescue community. Tap a role to join, or share to get more eyes.
          </p>
        </div>

        {/* SHAREABLE CARD */}
        <article className="overflow-hidden rounded-3xl border border-[#EAE6DE] bg-white shadow-[0_12px_40px_-16px_rgba(60,40,10,0.25)]">

          {/* 1 — Header bar */}
          <div
            className="flex items-center justify-between gap-3 px-4 py-3"
            style={{ background: v.header, color: "#FFFFFF" }}
          >
            <div className="flex items-center gap-2.5">
              <span className="voyce-brand-mark" aria-hidden>
                <svg width="17" height="17" viewBox="0 0 100 100" fill="currentColor">
                  <path d="M50,91 C33,91 24,80 24,68 C24,56 33,49 50,49 C67,49 76,56 76,68 C76,80 67,91 50,91 Z" />
                  <ellipse cx="21" cy="40" rx="9.5" ry="13" />
                  <ellipse cx="39" cy="27" rx="9.5" ry="13" />
                  <ellipse cx="57" cy="27" rx="9.5" ry="13" />
                  <ellipse cx="73" cy="40" rx="9.5" ry="13" />
                </svg>
              </span>
              <span className="font-serif text-[15px] font-bold tracking-tight text-white">
                Voyce <em className="not-italic text-[#FFD24A] italic">for</em> Paws
              </span>
            </div>
            <span
              className="rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] shadow-sm"
              style={{
                background: "linear-gradient(135deg, #FFE48A 0%, #FFD24A 50%, #C9871A 100%)",
                color: "#3A2A07",
              }}
            >
              SAMPLE
            </span>
          </div>

          {/* 2 — Photo with badge overlay */}
          <div className="relative bg-black">
            <img
              src={image}
              alt={name}
              className="aspect-[16/9] w-full object-cover"
            />
            <span
              className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.14em] shadow-lg"
              style={{ background: v.header, color: "#FFFFFF" }}
            >
              <span>{v.badgeIcon}</span>
              <span>{v.badge}</span>
            </span>
          </div>

          {/* 3 — Name / title block */}
          <div className="px-5 pt-4">
            <h2
              className="font-serif text-[26px] font-bold leading-[1.1] tracking-tight"
              style={{ color: v.title }}
            >
              {name}
            </h2>
            <div className="mt-1 text-[12.5px] text-foreground/60">
              {[data.species, data.breed, data.age, data.weight]
                .filter((x) => x && !/^unknown/i.test(x))
                .join(" · ") || "Species unknown"}
            </div>
            <div className="mt-1.5 flex items-center gap-1.5 text-[13px] font-medium text-foreground/85">
              <span style={{ color: "#FFD24A" }}>📍</span>
              <span>{where}</span>
            </div>
          </div>

          {/* 4 — Story */}
          {story && (
            <blockquote className="mx-5 mt-3 border-l-2 border-[#FFD24A] pl-3 font-serif text-[14.5px] italic leading-relaxed text-foreground/80">
              "{story}"
            </blockquote>
          )}

          {/* 5 — Urgency block */}
          <div
            className="mx-5 mt-4 flex items-center gap-2.5 rounded-2xl px-4 py-3"
            style={{ background: v.urgencyBg, color: v.urgencyText }}
          >
            <span className="text-xl leading-none">{v.urgencyIcon}</span>
            <span className="text-[13.5px] font-bold">{v.urgencyLine}</span>
          </div>

          {/* 6 — I can help as: */}
          <div className="px-5 pt-5">
            <div className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-foreground/55">
              I can help as
            </div>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {v.pills.map((p) => (
                <button
                  key={p.label}
                  onClick={() => openModal(p.role)}
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-semibold shadow-sm transition hover:-translate-y-0.5 hover:shadow-md active:scale-[0.97]"
                  style={{ background: p.bg, color: p.text, border: `1px solid ${p.text}22` }}
                >
                  <span>{p.icon}</span>
                  <span>{p.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 7 — divider */}
          <div className="mx-5 my-5 h-px bg-[#EAE6DE]" />

          {/* 8 — Share */}
          <div className="px-5">
            <div className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-foreground/55">
              Or share to get more eyes
            </div>
            <div className="mt-2.5 grid grid-cols-5 gap-2">
              {PLATFORMS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => share(p.id)}
                  className="flex flex-col items-center justify-center gap-1 rounded-xl px-1.5 py-2.5 text-[10.5px] font-semibold shadow-sm transition hover:brightness-110 active:scale-[0.97]"
                  style={{ background: p.bg, color: p.text }}
                  aria-label={`Share to ${p.label}`}
                >
                  <span className="text-[15px] leading-none">{p.icon}</span>
                  <span>{p.label}</span>
                </button>
              ))}
            </div>
            {copied && (
              <div className="mt-2 text-center text-[11.5px] font-medium text-[#1F6B3D]">
                ✓ Copied to clipboard
              </div>
            )}
          </div>

          {/* 9 — Pre-launch banner */}
          <div className="mt-5 flex items-center justify-center gap-2 bg-[#FAF1D8] px-5 py-3 text-center">
            <span className="text-base">🐾</span>
            <span className="text-[12px] italic font-medium" style={{ color: "#C9871A" }}>
              Pre-launch · shares grow Voyce. Real alerts launch with the app.
            </span>
          </div>

          {/* 10 — Be the first CTA */}
          <div
            className="px-5 py-5"
            style={{
              background: "linear-gradient(135deg, #FFE48A 0%, #FFD24A 50%, #C9871A 100%)",
              color: "#3A2A07",
            }}
          >
            <div className="font-serif text-[18px] font-bold leading-tight tracking-tight">
              Be the first {v.ctaRole} in your city
            </div>
            <p className="mt-1.5 text-[13px] leading-relaxed">
              Join the network so the next animal in need reaches you — not no one.
            </p>
            <button
              onClick={() => openModal()}
              className="mt-3 w-full rounded-2xl border-2 border-[#FFD24A] bg-black px-5 py-3 text-[14px] font-bold uppercase tracking-wide text-white shadow-lg transition hover:brightness-110 active:scale-[0.99]"
            >
              Join the Network →
            </button>
          </div>
        </article>

        <p className="mx-auto mt-5 max-w-xl text-center text-[12px] italic leading-relaxed text-muted-foreground">
          This card was generated from the {m.label.toLowerCase()} report you just submitted.
        </p>
      </div>

      {/* Sticky continue */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/95 px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
          <button
            onClick={() => openModal()}
            className="text-[13px] font-semibold text-[#8A5A0E] underline-offset-2 hover:underline"
          >
            Join the network
          </button>
          <button
            onClick={onContinue}
            className="rounded-full bg-gradient-to-b from-[oklch(0.90_0.16_85)] to-[oklch(0.78_0.15_70)] px-6 py-2.5 text-sm font-semibold text-[oklch(0.25_0.04_60)] shadow-md transition hover:brightness-105 active:scale-[0.98]"
          >
            Continue →
          </button>
        </div>
      </div>

      <JoinNetworkModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        initialRole={modalRole}
      />
    </div>
  );
}
