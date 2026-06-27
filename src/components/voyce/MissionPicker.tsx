import { Activity, Hourglass, Search, ShieldCheck, Leaf, type LucideIcon } from "lucide-react";
import pawLogo from "@/assets/voyce-paw.png";
import { MISSION_LIST, type MissionId } from "@/lib/missions";

type TileVisual = {
  Icon: LucideIcon;
  iconGradient: string;
  tileGradient: string;
  borderColor: string;
  shadowColor: string;
  eyebrow: string;
};


const VISUALS: Record<MissionId, TileVisual> = {
  injured: {
    Icon: Activity,
    iconGradient: "linear-gradient(135deg, #FF6B35 0%, #D14848 100%)",
    tileGradient: "linear-gradient(180deg, rgba(255,107,53,0.08) 0%, #FAF8F5 70%)",
    borderColor: "rgba(255,107,53,0.4)",
    shadowColor: "rgba(255,107,53,0.25)",
    eyebrow: "Emergency",
  },
  "at-risk-shelter": {
    Icon: Hourglass,
    iconGradient: "linear-gradient(135deg, #D14848 0%, #8B2424 100%)",
    tileGradient: "linear-gradient(180deg, rgba(209,72,72,0.08) 0%, #FAF8F5 70%)",
    borderColor: "rgba(209,72,72,0.4)",
    shadowColor: "rgba(209,72,72,0.25)",
    eyebrow: "At risk",
  },
  "lost-found": {
    Icon: Search,
    iconGradient: "linear-gradient(135deg, #FFD24A 0%, #C9871A 100%)",
    tileGradient: "linear-gradient(180deg, rgba(201,135,26,0.08) 0%, #FAF8F5 70%)",
    borderColor: "rgba(201,135,26,0.4)",
    shadowColor: "rgba(201,135,26,0.25)",
    eyebrow: "Reunite",
  },
  prevention: {
    Icon: ShieldCheck,
    iconGradient: "linear-gradient(135deg, #4ADE80 0%, #1F9D57 100%)",
    tileGradient: "linear-gradient(180deg, rgba(31,157,87,0.08) 0%, #FAF8F5 70%)",
    borderColor: "rgba(31,157,87,0.4)",
    shadowColor: "rgba(31,157,87,0.25)",
    eyebrow: "Prevention",
  },
  wildlife: {
    Icon: Leaf,
    iconGradient: "linear-gradient(135deg, #9DB7FF 0%, #4A8FB5 100%)",
    tileGradient: "linear-gradient(180deg, rgba(74,143,181,0.08) 0%, #FAF8F5 70%)",
    borderColor: "rgba(74,143,181,0.4)",
    shadowColor: "rgba(74,143,181,0.25)",
    eyebrow: "Wildlife",
  },
};

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
        <h1 className="font-serif text-3xl font-semibold tracking-tight">Who needs help?</h1>
        <p className="mt-1 text-[15px] text-muted-foreground">
          Pick the type of case so Voyce can tune the AI and rescue flow.
        </p>

        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {MISSION_LIST.map((m) => {
            const v = VISUALS[m.id];
            const Icon = v.Icon;
            return (
              <button
                key={m.id}
                onClick={() => onPick(m.id)}
                className="group relative flex items-start gap-4 overflow-hidden rounded-2xl p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:scale-[1.02] active:scale-[0.99]"
                style={{
                  background: v.tileGradient,
                  border: `1.5px solid ${v.borderColor}`,
                  boxShadow: `0 4px 14px -6px ${v.shadowColor}`,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = `0 10px 24px -8px ${v.shadowColor}`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = `0 4px 14px -6px ${v.shadowColor}`;
                }}
              >
                <span
                  className="flex h-14 w-14 flex-none items-center justify-center"
                  style={{
                    background: v.iconGradient,
                    borderRadius: 14,
                    boxShadow: `0 6px 16px ${v.shadowColor}, inset 0 1px 0 rgba(255,255,255,0.3)`,
                  }}
                  aria-hidden
                >
                  <Icon size={26} color="#FFFFFF" strokeWidth={2} />
                </span>
                <span className="flex flex-col">
                  <span
                    className="text-[10.5px] font-bold uppercase tracking-[0.16em]"
                    style={{ color: m.accent }}
                  >
                    {v.eyebrow}
                  </span>
                  <span
                    className="mt-0.5 font-serif text-[17px] font-semibold leading-tight"
                    style={{ color: m.titleColor }}
                  >
                    {m.label}
                  </span>
                  <span className="mt-1 text-[13.5px] leading-snug" style={{ color: "#4B4945" }}>
                    {m.sub}
                  </span>
                </span>
                <span
                  className="ml-auto self-center text-lg opacity-50 transition group-hover:translate-x-0.5 group-hover:opacity-100"
                  style={{ color: m.accent }}
                  aria-hidden
                >
                  →
                </span>
              </button>
            );
          })}
        </div>

        <p className="mt-6 text-center text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          Anonymous · No login required
        </p>
      </main>
    </div>
  );
}
