import { BrandHeader } from "@/components/voyce/BrandHeader";

export function Outcome({ onRestart }: { onRestart: () => void }) {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-background pb-12">
      <BrandHeader />
      <div className="flex-1 px-6 pt-8">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center">

        <h1 className="font-serif text-3xl font-semibold tracking-tight leading-tight">
          Thank you for raising your voice.
        </h1>
        <p className="mt-3 text-foreground/80">
          Every report makes the network stronger. Here's how you can keep going:
        </p>

        <div className="mt-6 space-y-3">
          <a
            href="https://voyceforpaws.org/#join-network"
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-between rounded-2xl border border-[oklch(0.85_0.12_70)] bg-gradient-to-b from-[oklch(0.97_0.05_85)] to-[oklch(0.93_0.08_85)] px-5 py-4 text-left shadow-sm transition hover:brightness-105"
          >
            <span className="text-base font-semibold text-[oklch(0.30_0.08_60)]">💛 Join the community network</span>
            <span className="text-[oklch(0.40_0.10_60)]">→</span>
          </a>
          <a
            href="https://voyceforpaws.org/#support"
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-between rounded-2xl border border-border bg-card px-5 py-4 text-left shadow-sm transition hover:border-[oklch(0.85_0.12_70)]"
          >
            <span className="text-base font-semibold text-foreground">❤ Help us launch faster</span>
            <span className="text-muted-foreground">→</span>
          </a>
          <button
            onClick={onRestart}
            className="flex w-full items-center justify-between rounded-2xl border border-border bg-card px-5 py-4 text-left shadow-sm transition hover:border-[oklch(0.85_0.12_70)]"
          >
            <span className="text-base font-semibold text-foreground">↺ Try another animal</span>
            <span className="text-muted-foreground">→</span>
          </button>
        </div>

        <div className="mt-10 text-center text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          AI is advisory — not a diagnosis
        </div>
      </div>
      </div>
    </div>

  );
}
