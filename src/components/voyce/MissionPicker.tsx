import pawLogo from "@/assets/voyce-paw.png";
import { MISSION_LIST, type MissionId } from "@/lib/missions";

const GOLD = "#C9871A";

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
          <img src={pawLogo} alt="" width={18} height={18} className="h-[18px] w-[18px] opacity-90" style={{ filter: "sepia(1) saturate(4) hue-rotate(-10deg) brightness(0.85)" }} />
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
          {MISSION_LIST.map((m) => (
            <button
              key={m.id}
              onClick={() => onPick(m.id)}
              className="group relative flex h-[124px] items-stretch overflow-hidden rounded-2xl border border-border bg-card text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md active:scale-[0.99]"
              style={{ boxShadow: `inset 4px 0 0 0 ${m.accent}` }}
            >
              {/* Left: icon tile */}
              <span
                className="my-auto ml-4 flex h-12 w-12 flex-none items-center justify-center rounded-xl text-2xl"
                style={{ background: m.accentSoft }}
                aria-hidden
              >
                {m.icon}
              </span>

              {/* Middle: text */}
              <span className="relative z-10 flex min-w-0 flex-1 flex-col justify-center px-3 py-3">
                <span
                  className="font-serif text-[16px] font-semibold leading-tight"
                  style={{ color: m.titleColor }}
                >
                  {m.label}
                </span>
                <span className="mt-1 text-[12.5px] leading-snug text-muted-foreground line-clamp-2">
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

              {/* Right: photo with gradient fade from accent → photo */}
              <span className="relative w-[40%] flex-none overflow-hidden">
                <img
                  src={m.photo}
                  alt=""
                  loading="lazy"
                  width={768}
                  height={768}
                  className="h-full w-full object-cover"
                />
                <span
                  className="pointer-events-none absolute inset-0"
                  style={{
                    background: `linear-gradient(to right, ${m.accentSoft} 0%, transparent 55%)`,
                  }}
                  aria-hidden
                />
              </span>
            </button>
          ))}
        </div>

        <div
          className="mt-5 rounded-xl border p-4 font-serif text-[14px] leading-snug"
          style={{ backgroundColor: "#FFF7E0", borderColor: GOLD }}
        >
          <div className="flex items-start gap-2">
            <span aria-hidden className="text-lg leading-none">💡</span>
            <div>
              <strong>Not sure which option fits?</strong>
              <p className="mt-0.5 text-muted-foreground">
                Just choose the closest match — Voyce AI will analyze the photo and automatically guide you to the right rescue category.
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
