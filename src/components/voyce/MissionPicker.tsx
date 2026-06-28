import pawLogo from "@/assets/voyce-paw.png";
import { MISSION_LIST, type MissionId } from "@/lib/missions";

const GOLD = "#C9871A";

type IconProps = { size?: number; color?: string };

const baseStroke = {
  fill: "none" as const,
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function HeartPulseIcon({ size = 26, color = "currentColor" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" stroke={color} {...baseStroke}>
      <path d="M20.5 10.5c0-2.3-1.8-4-4-4-1.7 0-3.3 1-4.5 2.6C10.8 7.5 9.2 6.5 7.5 6.5c-2.2 0-4 1.7-4 4 0 1.4.6 2.7 1.6 3.8" />
      <path d="M5.1 14.3c1.9 2.3 4.8 4.6 6.9 6.2 2.5-1.9 6.1-4.9 7.9-7.5" />
      <path d="M3 13h3.5l1.5-2.5L10 15l2-7 1.8 5h3.7" />
    </svg>
  );
}

function HourglassIcon({ size = 26, color = "currentColor" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" stroke={color} {...baseStroke}>
      <path d="M6 3h12" />
      <path d="M6 21h12" />
      <path d="M7 3c0 4 4 5 4 8.5v1C11 16 7 17 7 21" />
      <path d="M17 3c0 4-4 5-4 8.5v1C13 16 17 17 17 21" />
      <circle cx="11" cy="18" r="0.6" fill={color} stroke="none" />
      <circle cx="13" cy="19" r="0.6" fill={color} stroke="none" />
      <circle cx="12" cy="17" r="0.6" fill={color} stroke="none" />
    </svg>
  );
}

function PawInLensIcon({ size = 26, color = "currentColor" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" stroke={color} {...baseStroke}>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M15.5 15.5L20 20" />
      {/* paw inside */}
      <ellipse cx="10.5" cy="12" rx="1.6" ry="1.2" />
      <circle cx="7.8" cy="9.5" r="0.9" />
      <circle cx="10.5" cy="8.4" r="0.9" />
      <circle cx="13.2" cy="9.5" r="0.9" />
    </svg>
  );
}

function ShieldPawIcon({ size = 26, color = "currentColor" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" stroke={color} {...baseStroke}>
      <path d="M12 3l7 2.5v6c0 4.2-3 8-7 9.5-4-1.5-7-5.3-7-9.5v-6L12 3z" />
      <ellipse cx="12" cy="13.2" rx="1.6" ry="1.2" />
      <circle cx="9.3" cy="10.8" r="0.85" />
      <circle cx="12" cy="9.7" r="0.85" />
      <circle cx="14.7" cy="10.8" r="0.85" />
    </svg>
  );
}

function OwlIcon({ size = 26, color = "currentColor" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" stroke={color} {...baseStroke}>
      {/* head + body silhouette */}
      <path d="M12 3c-3.6 0-6.3 2.6-6.3 6 0 1.5.5 2.8 1.3 3.8-.5 1.4-.5 3 0 4.6.7 2.2 2.7 3.6 5 3.6s4.3-1.4 5-3.6c.5-1.6.5-3.2 0-4.6.8-1 1.3-2.3 1.3-3.8 0-3.4-2.7-6-6.3-6z" />
      {/* ear tufts */}
      <path d="M7.2 4.8L6 3" />
      <path d="M16.8 4.8L18 3" />
      {/* eyes */}
      <circle cx="9.5" cy="9.5" r="1.8" />
      <circle cx="14.5" cy="9.5" r="1.8" />
      <circle cx="9.5" cy="9.5" r="0.55" fill={color} stroke="none" />
      <circle cx="14.5" cy="9.5" r="0.55" fill={color} stroke="none" />
      {/* beak */}
      <path d="M12 11l-0.8 1.4h1.6z" />
    </svg>
  );
}

function MissionIcon({ id, color }: { id: MissionId; color: string }) {
  switch (id) {
    case "injured":
      return <HeartPulseIcon color={color} />;
    case "at-risk-shelter":
      return <HourglassIcon color={color} />;
    case "lost-found":
      return <PawInLensIcon color={color} />;
    case "prevention":
      return <ShieldPawIcon color={color} />;
    case "wildlife":
      return <OwlIcon color={color} />;
  }
}

export function MissionPicker({ onPick }: { onPick: (id: MissionId) => void }) {
  return (
    <div className="min-h-[100dvh] bg-background pb-12">
      <header className="flex items-center justify-between px-5 pt-[max(1rem,env(safe-area-inset-top))]">
        <div className="flex items-center gap-2">
          <img src={pawLogo} alt="Voyce" width={22} height={22} className="h-5 w-5" />
          <span className="font-serif text-base font-semibold tracking-tight">Voyce</span>
        </div>
        <div className="rounded-full bg-card px-3 py-1 text-[11px] font-medium text-muted-foreground shadow-sm">
          AI is advisory · not a diagnosis
        </div>
      </header>

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

        <p className="mt-5 text-center text-[11px] text-muted-foreground">
          🔒 Your report is confidential and shared only with trusted rescues near you.
        </p>
      </main>
    </div>
  );
}
