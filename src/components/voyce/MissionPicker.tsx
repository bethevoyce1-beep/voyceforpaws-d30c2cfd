import pawLogo from "@/assets/voyce-paw.png";
import { MISSION_LIST, type MissionId } from "@/lib/missions";

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
          {MISSION_LIST.map((m) => (
            <button
              key={m.id}
              onClick={() => onPick(m.id)}
              className="group relative flex items-start gap-3 overflow-hidden rounded-2xl border border-border bg-card p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md active:scale-[0.99]"
              style={{
                boxShadow: `inset 4px 0 0 0 ${m.accent}`,
              }}
            >
              <span
                className="flex h-12 w-12 flex-none items-center justify-center rounded-xl text-2xl"
                style={{ background: m.accentSoft }}
                aria-hidden
              >
                {m.icon}
              </span>
              <span className="flex flex-col">
                <span
                  className="font-serif text-[17px] font-semibold leading-tight"
                  style={{ color: m.titleColor }}
                >
                  {m.label}
                </span>
                <span className="mt-0.5 text-[13.5px] leading-snug text-muted-foreground">
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
          ))}
        </div>

        <p className="mt-6 text-center text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          Anonymous · No login required
        </p>
      </main>
    </div>
  );
}
