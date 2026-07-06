import { useEffect, useState } from "react";
import { BrandHeader } from "@/components/voyce/BrandHeader";

// Shown right after the reporter taps "Send to rescuers" on the rescue card —
// the network-alert steps play here (AFTER the real send) so the "we alerted
// the network" moment is accurate. Auto-advances to the share screen.
const STEPS = [
  {
    icon: "📢",
    title: "Alerting the network",
    sub: "Closest rescuers, fosters, shelters, and animal lovers get it first — anyone willing to help. The alert keeps rippling out to the whole network.",
  },
  {
    icon: "✅",
    title: "Report sent",
    sub: "It's saved to your home screen. We'll let you know the moment someone steps up to help.",
  },
];

export function NetworkAlerting({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const t1 = window.setTimeout(() => setStep(1), 1200);
    const t2 = window.setTimeout(() => setStep(2), 2700);
    const t3 = window.setTimeout(onComplete, 3600);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
  }, [onComplete]);

  return (
    <div className="flex min-h-[100dvh] flex-col bg-background pb-10">
      <BrandHeader />
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 pt-7">
        <h1 className="font-serif text-[24px] font-semibold tracking-tight">
          Sending your report
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Reaching the closest helpers first.
        </p>

        <ol className="mt-6 space-y-3">
          {STEPS.map((s, i) => {
            const done = i < step;
            const active = i === step;
            return (
              <li
                key={s.title}
                className={`flex gap-3 rounded-2xl border px-4 py-3.5 transition ${
                  done
                    ? "border-[#BFE3C6] bg-[#EDF7EF]"
                    : active
                      ? "border-[#F0DCA6] bg-[#FDF6E3]"
                      : "border-border bg-background/60"
                }`}
              >
                <div
                  className={`mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full text-[13px] font-bold ${
                    done
                      ? "bg-[#2f9d57] text-white"
                      : active
                        ? "bg-[#FFDF3B] text-[#3A2A07]"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {done ? "✓" : active ? "⠋" : ""}
                </div>
                <div>
                  <div className="text-[15px] font-semibold">
                    {s.icon} {s.title}
                  </div>
                  <div className="mt-0.5 text-[12.5px] leading-snug text-muted-foreground">
                    {s.sub}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>

        <div className="mt-auto pt-8 text-center text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          AI is advisory — not a diagnosis
        </div>
      </div>
    </div>
  );
}
