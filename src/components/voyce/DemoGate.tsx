import { useState } from "react";
import { BrandHeader } from "@/components/voyce/BrandHeader";


const ROLES = ["Rescuer", "Foster", "Shelter-Rescue", "Neighbor", "Supporter"];

export function DemoGate({ onDone }: { onDone: () => void }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<string>("Neighbor");
  const [followJourney, setFollowJourney] = useState(true);
  const [consent, setConsent] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      setError("Enter a valid email.");
      return;
    }
    if (!consent) {
      setError("Please accept the privacy notice to continue.");
      return;
    }
    // Anonymous-first: just acknowledge locally for the demo.
    console.info("[voyce] early access:", { email, role, followJourney });
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="flex min-h-[100dvh] flex-col bg-background">
        <BrandHeader />
        <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <div className="max-w-md">

          <div className="text-5xl">🎉</div>
          <h1 className="mt-4 font-serif text-3xl font-semibold tracking-tight">You're in.</h1>
          <p className="mt-2 text-foreground/80">
            We'll email you the moment Voyce launches.
          </p>
          <button
            onClick={onDone}
            className="mt-8 rounded-full bg-gradient-to-b from-[oklch(0.90_0.16_85)] to-[oklch(0.78_0.15_70)] px-6 py-2.5 text-sm font-semibold text-[oklch(0.25_0.04_60)] shadow-md"
          >
            Continue →
          </button>
        </div>
        </div>
      </div>
    );

  }

  return (
    <div className="min-h-[100dvh] bg-background pb-12">
      <BrandHeader />
      <div className="px-6 pt-6">

      <form onSubmit={submit} className="mx-auto w-full max-w-md">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-[oklch(0.96_0.05_85)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[oklch(0.40_0.10_60)]">
          ⚡ Live demo · what you just saw
        </div>
        <h1 className="mt-4 font-serif text-3xl font-semibold tracking-tight leading-tight">
          Want this watching your neighborhood for real?
        </h1>
        <p className="mt-2 text-sm text-foreground/75">
          Voyce launches this summer. Get on the early-access list. Always free, no fees, no spam.
        </p>

        <div className="mt-6">
          <label className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="mt-1.5 w-full rounded-xl border border-border bg-card px-4 py-3 text-base outline-none focus:border-[oklch(0.78_0.15_70)] focus:ring-2 focus:ring-[oklch(0.88_0.16_85)]/40"
          />
        </div>

        <div className="mt-5">
          <div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            I am a…
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {ROLES.map((r) => (
              <button
                type="button"
                key={r}
                onClick={() => setRole(r)}
                className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
                  role === r
                    ? "border-[oklch(0.78_0.15_70)] bg-[oklch(0.88_0.16_85)] text-[oklch(0.25_0.04_60)] shadow-sm"
                    : "border-border bg-card text-foreground/80 hover:border-[oklch(0.85_0.12_70)]"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        <label className="mt-6 flex items-start gap-3 rounded-2xl border-2 border-[oklch(0.85_0.16_85)] bg-[oklch(0.98_0.04_85)] px-4 py-3 cursor-pointer">
          <input
            type="checkbox"
            checked={followJourney}
            onChange={(e) => setFollowJourney(e.target.checked)}
            className="mt-1 h-4 w-4 accent-[oklch(0.78_0.15_70)]"
          />
          <span className="text-sm leading-relaxed">
            <span className="mr-1">💛</span>
            <span className="font-semibold">Yes, follow this animal's journey.</span> Get updates as the pack responds, rescue progresses, and a happy ending unfolds.
          </span>
        </label>

        <label className="mt-3 flex items-start gap-3 px-1 cursor-pointer">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-1 h-4 w-4 accent-[oklch(0.78_0.15_70)]"
          />
          <span className="text-xs text-muted-foreground leading-relaxed">
            I agree to the <a href="https://voyceforpaws.org/privacy" target="_blank" rel="noreferrer" className="underline">Privacy Policy</a> and <a href="https://voyceforpaws.org/terms" target="_blank" rel="noreferrer" className="underline">Terms</a>.
          </span>
        </label>

        {error && (
          <div className="mt-3 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        <button
          type="submit"
          className="mt-6 w-full rounded-full bg-gradient-to-b from-[oklch(0.90_0.16_85)] to-[oklch(0.78_0.15_70)] px-6 py-3.5 text-sm font-semibold text-[oklch(0.25_0.04_60)] shadow-md hover:brightness-105 active:scale-[0.99] transition"
        >
          Reserve early access →
        </button>
        <div className="mt-3 text-center">
          <button
            type="button"
            onClick={onDone}
            className="text-xs text-muted-foreground underline-offset-2 hover:underline"
          >
            Skip for now
          </button>
        </div>
      </form>
      </div>
    </div>

  );
}
