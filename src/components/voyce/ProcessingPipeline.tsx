import { useEffect, useState } from "react";

const STEPS = [
  "Getting location",
  "Processing image",
  "AI analyzing photo",
  "Creating rescue card",
  "Alerting the network",
  "Report ready",
];

export function ProcessingPipeline({
  aiPending,
  aiError,
  onComplete,
}: {
  aiPending: boolean;
  aiError: string | null;
  onComplete: () => void;
}) {
  const [elapsed, setElapsed] = useState(0);
  const [step, setStep] = useState(0);

  // Mission timer
  useEffect(() => {
    const t = setInterval(() => setElapsed((e) => e + 0.1), 100);
    return () => clearInterval(t);
  }, []);

  // Step animation: 0→1 (1s), 1→2 (1.5s), gate on AI (step 2 = AI), then 3,4,5
  useEffect(() => {
    if (step >= STEPS.length - 1) return;
    // Pause at step 2 (AI) until aiPending=false
    if (step === 2 && aiPending) return;
    const delays = [900, 1100, 0, 1600, 1700, 1400];
    const t = setTimeout(() => setStep((s) => s + 1), delays[step]);
    return () => clearTimeout(t);
  }, [step, aiPending]);

  useEffect(() => {
    if (step === STEPS.length - 1 && !aiPending && !aiError) {
      const t = setTimeout(onComplete, 800);
      return () => clearTimeout(t);
    }
  }, [step, aiPending, aiError, onComplete]);

  const mm = Math.floor(elapsed / 60);
  const ss = Math.floor(elapsed % 60).toString().padStart(2, "0");

  return (
    <div className="flex min-h-[100dvh] flex-col bg-background px-6 pt-[max(2rem,env(safe-area-inset-top))] pb-10">
      <div className="mx-auto w-full max-w-md flex-1 flex flex-col">
        <div className="flex items-center justify-between">
          <div className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
            Mission timer
          </div>
          <div className="font-mono text-2xl font-semibold tabular-nums text-[oklch(0.45_0.13_70)]">
            {mm}:{ss}
          </div>
        </div>

        <h1 className="mt-8 font-serif text-3xl font-semibold tracking-tight">
          Voyce is on it
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Building the rescue card for this animal.
        </p>

        <ol className="mt-8 space-y-3">
          {STEPS.map((label, i) => {
            const done = i < step || (i === STEPS.length - 1 && step === STEPS.length - 1 && !aiPending);
            const active = i === step && !done;
            const isAiStep = i === 2;
            const failed = isAiStep && aiError;
            return (
              <li
                key={label}
                className={`flex items-center gap-3 rounded-2xl border px-4 py-3 transition ${
                  done
                    ? "border-[oklch(0.85_0.15_140)]/40 bg-[oklch(0.95_0.06_140)]/40"
                    : active
                      ? "border-[oklch(0.88_0.16_85)] bg-[oklch(0.96_0.08_85)]/40"
                      : "border-border bg-card/60"
                }`}
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center">
                  {failed ? (
                    <span className="text-lg">⚠️</span>
                  ) : done ? (
                    <svg viewBox="0 0 24 24" className="h-6 w-6 text-[oklch(0.55_0.18_140)]">
                      <path
                        fill="currentColor"
                        d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"
                      />
                    </svg>
                  ) : active ? (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-[oklch(0.65_0.18_60)] border-t-transparent" />
                  ) : (
                    <span className="h-2 w-2 rounded-full bg-muted-foreground/30" />
                  )}
                </span>
                <span
                  className={`text-sm ${
                    done
                      ? "text-foreground/80"
                      : active
                        ? "font-medium text-foreground"
                        : "text-muted-foreground"
                  }`}
                >
                  {label}
                </span>
              </li>
            );
          })}
        </ol>

        {aiError && (
          <div className="mt-4 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {aiError}
          </div>
        )}

        <div className="mt-auto pt-10 text-center text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          AI is advisory — not a diagnosis
        </div>
      </div>
    </div>
  );
}
