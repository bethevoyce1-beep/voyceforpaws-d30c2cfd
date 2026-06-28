import { useEffect, useState } from "react";
import { BrandHeader } from "@/components/voyce/BrandHeader";


const STEPS = ["REPORTED", "PROCESSED", "LIVE", "HELPED"];

export function StatusTimeline({ onContinue }: { onContinue: () => void }) {
  const [active, setActive] = useState(1); // REPORTED + PROCESSED done, LIVE pending
  useEffect(() => {
    const t = setTimeout(() => setActive(2), 1400);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="flex min-h-[100dvh] flex-col bg-background px-6 pt-[max(2rem,env(safe-area-inset-top))] pb-32">
      <div className="mx-auto w-full max-w-md">
        <div className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
          Reporter view · Just now
        </div>
        <h1 className="mt-3 font-serif text-3xl font-semibold tracking-tight">
          Your report is live
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your report is being processed. You'll see it on your home screen shortly.
        </p>

        {/* Timeline */}
        <div className="mt-10">
          <div className="relative flex items-center justify-between">
            <div className="absolute left-0 right-0 top-1/2 h-0.5 -translate-y-1/2 bg-border" />
            <div
              className="absolute left-0 top-1/2 h-0.5 -translate-y-1/2 bg-[oklch(0.78_0.15_70)] transition-all duration-700"
              style={{ width: `${(active / (STEPS.length - 1)) * 100}%` }}
            />
            {STEPS.map((label, i) => {
              const done = i <= active;
              return (
                <div key={label} className="relative z-10 flex flex-col items-center gap-2">
                  <div
                    className={`h-4 w-4 rounded-full border-2 transition ${
                      done
                        ? "border-[oklch(0.78_0.15_70)] bg-[oklch(0.88_0.16_85)] shadow-sm"
                        : "border-border bg-background"
                    }`}
                  />
                  <span
                    className={`text-[10px] font-semibold tracking-[0.1em] ${
                      done ? "text-[oklch(0.38_0.10_60)]" : "text-muted-foreground"
                    }`}
                  >
                    {label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-10 rounded-2xl border border-border bg-card px-4 py-4 text-sm text-foreground/85">
          Cases like yours typically reach <span className="font-semibold">12-40 nearby helpers</span> within 5 miles.
        </div>

        <div className="mt-8 text-center text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          AI is advisory — not a diagnosis
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/95 px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
        <div className="mx-auto flex max-w-md justify-end">
          <button
            onClick={onContinue}
            className="rounded-full bg-gradient-to-b from-[oklch(0.90_0.16_85)] to-[oklch(0.78_0.15_70)] px-6 py-2.5 text-sm font-semibold text-[oklch(0.25_0.04_60)] shadow-md hover:brightness-105 active:scale-[0.98] transition"
          >
            Continue →
          </button>
        </div>
      </div>
    </div>
  );
}
