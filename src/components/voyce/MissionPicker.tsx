import { useEffect } from "react";
import pawLogo from "@/assets/voyce-paw.png";
import { MISSION_LIST, type MissionId } from "@/lib/missions";
import { BrandHeader } from "@/components/voyce/BrandHeader";


const GOLD = "#C9871A";

type IconProps = { size?: number; color?: string };

const baseStroke = {
  fill: "none" as const,
  strokeWidth: 2.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function MedicalPlusIcon({ size = 28, color = "currentColor" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" stroke={color} {...baseStroke}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v10" />
      <path d="M7 12h10" />
    </svg>
  );
}

function HourglassIcon({ size = 28, color = "currentColor" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" stroke={color} {...baseStroke}>
      <path d="M5 3h14" />
      <path d="M5 21h14" />
      <path d="M5 3l7 9 7-9" />
      <path d="M5 21l7-9 7 9" />
    </svg>
  );
}

function MagnifierIcon({ size = 28, color = "currentColor" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" stroke={color} {...baseStroke}>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M15.5 15.5L20 20" />
    </svg>
  );
}

function ShieldIcon({ size = 28, color = "currentColor" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" stroke={color} {...baseStroke}>
      <path d="M12 3l7 2.5v6c0 4.2-3 8-7 9.5-4-1.5-7-5.3-7-9.5v-6L12 3z" />
    </svg>
  );
}

function OwlIcon({ size = 28, color = "currentColor" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" stroke={color} {...baseStroke}>
      <circle cx="12" cy="11" r="7" />
      <circle cx="9.5" cy="10" r="1.8" />
      <circle cx="14.5" cy="10" r="1.8" />
      <path d="M12 12.5l-.8 1.2h1.6z" />
    </svg>
  );
}

function MissionIcon({ id, color }: { id: MissionId; color: string }) {
  switch (id) {
    case "injured":
      return <MedicalPlusIcon color={color} />;
    case "at-risk-shelter":
      return <HourglassIcon color={color} />;
    case "lost-found":
      return <MagnifierIcon color={color} />;
    case "prevention":
      return <ShieldIcon color={color} />;
    case "wildlife":
      return <OwlIcon color={color} />;
  }
}

// Camera-first (July 5, 2026): Voyce opens straight to the camera — the
// landing page and social media explain the mission; the app's job is speed.
// The AI reads the situation from the photo and pre-fills it in the details
// form. This auto-advance runs ONCE per page load, so tapping Back from the
// camera still shows this full picker (At-Risk Shelter browsing, Wildlife,
// and the rest). ?full=1 keeps the picker on screen (for website links);
// ?go=1 / ?quick=1 are still accepted and do the same as the default now.
let autoAdvancedThisLoad = false;

export function MissionPicker({ onPick }: { onPick: (id: MissionId) => void }) {
  useEffect(() => {
    if (autoAdvancedThisLoad || typeof window === "undefined") return;
    autoAdvancedThisLoad = true;
    const q = new URLSearchParams(window.location.search);
    if (q.has("full")) return; // explicit request to browse all options
    onPick("injured");
  }, [onPick]);

  return (
    <div className="min-h-[100dvh] bg-background pb-12">
      <BrandHeader />


      <main className="mx-auto w-full max-w-2xl px-5 pt-8">
        <h1 className="text-center font-serif text-3xl font-semibold tracking-tight">
          How can we help{" "}
          <span className="italic" style={{ color: GOLD }}>
            today?
          </span>
        </h1>

        {/* paw divider */}
        <div className="mt-6 mb-6 flex items-center justify-center gap-3" aria-hidden>
          <span className="block h-px w-[60px]" style={{ backgroundColor: GOLD }} />
          <img
            src={pawLogo}
            alt=""
            width={18}
            height={18}
            className="h-[18px] w-[18px] opacity-90"
            style={{ filter: "sepia(1) saturate(4) hue-rotate(-10deg) brightness(0.85)" }}
          />
          <span className="block h-px w-[60px]" style={{ backgroundColor: GOLD }} />
        </div>

        <p
          className="mx-auto max-w-[640px] text-center text-[15px] leading-[1.5]"
          style={{ color: "#5A4F44", marginBottom: 32 }}
        >
          <span aria-hidden style={{ color: GOLD, marginRight: 6 }}>✨</span>
          Choose the closest match. Voyce AI will identify the situation and alert the appropriate rescue network.
        </p>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {MISSION_LIST.map((m) => {
            return (
              <button
                key={m.id}
                onClick={() => onPick(m.id)}
                className="group relative flex min-h-[124px] items-stretch overflow-hidden rounded-2xl border border-border bg-card text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md active:scale-[0.99]"
                style={{ boxShadow: `inset 4px 0 0 0 ${m.accent}` }}
              >
                {/* Left: icon tile */}
                <span
                  className="my-auto ml-4 flex h-12 w-12 flex-none items-center justify-center rounded-xl"
                  style={{ background: m.accentSoft }}
                  aria-hidden
                >
                  <MissionIcon id={m.id} color={m.accent} />
                </span>

                {/* Middle: text */}
                <span className="flex min-w-[180px] flex-1 flex-col justify-center px-3 py-3 sm:min-w-[240px]">
                  <span
                    className="font-serif text-[16px] font-semibold leading-tight"
                    style={{ color: m.titleColor }}
                  >
                    {m.label}
                  </span>
                  <span
                    className="mt-1 text-muted-foreground"
                    style={{ fontSize: 14, lineHeight: 1.4 }}
                  >
                    {m.sub}
                  </span>
                  <span
                    className="mt-1 text-base opacity-60 transition group-hover:translate-x-0.5 group-hover:opacity-100"
                    style={{ color: m.accent }}
                    aria-hidden
                  >
                    →
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        {/* Elegant helper callout */}
        <div
          className="mx-auto"
          style={{
            maxWidth: 580,
            marginTop: 32,
            marginBottom: 32,
            background: "#FFFBF3",
            border: "1px solid #E8D5A8",
            borderRadius: 16,
            padding: "24px 28px",
          }}
        >
          <div className="flex items-start gap-3">
            <span aria-hidden style={{ color: GOLD, fontSize: 16, lineHeight: 1.4 }}>✨</span>
            <div>
              <p
                className="font-serif"
                style={{ color: "#5A4F44", fontSize: 15, fontWeight: 400, lineHeight: 1.5, margin: 0 }}
              >
                Not sure which option fits?
              </p>
              <p
                style={{
                  marginTop: 6,
                  fontSize: 14,
                  fontStyle: "italic",
                  color: "#8A7F73",
                  lineHeight: 1.55,
                }}
              >
                Just choose the closest match — Voyce AI will analyze the photo and guide you to the right rescue category.
              </p>
            </div>
          </div>
        </div>

      </main>
    </div>
  );
}
