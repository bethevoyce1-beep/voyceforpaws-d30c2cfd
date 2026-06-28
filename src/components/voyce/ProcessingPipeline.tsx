import { useEffect, useMemo, useRef, useState } from "react";
import type { Assessment } from "@/lib/analyze.functions";
import { getUrgency } from "@/lib/urgency";
import { AIDisclosureBanner } from "@/components/voyce/AIDisclosureBanner";


type Geo = {
  lat: number;
  lon: number;
  label: string; // city/state or "Your area"
  accuracy: "High" | "Approx";
};

type Props = {
  aiPending: boolean;
  aiError: string | null;
  assessment: Assessment | null;
  onComplete: () => void;
};

const GOLD = "#FFD24A";
const DEEP_GOLD = "#C9871A";
const GREEN = "oklch(0.6 0.17 145)";

// Step durations in ms (steps 2 and 4 are the wow moments)
const STEP_MS = [1000, 2500, 1000, 3000, 1000, 1000, 1000];

export function ProcessingPipeline({ aiPending, aiError, assessment, onComplete }: Props) {
  const [elapsed, setElapsed] = useState(0);
  const [step, setStep] = useState(0); // 0..6 active; 7 = all done
  const [frozen, setFrozen] = useState(false);
  const [geo, setGeo] = useState<Geo | null>(null);

  // Mission timer — ticks live, freezes when done
  useEffect(() => {
    if (frozen) return;
    const t = setInterval(() => setElapsed((e) => e + 0.1), 100);
    return () => clearInterval(t);
  }, [frozen]);

  // Kick off geolocation immediately so it's ready by step 2
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGeo({ lat: 0, lon: 0, label: "Your area", accuracy: "Approx" });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        let label = "Your area";
        try {
          const r = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10`,
            { headers: { Accept: "application/json" } },
          );
          if (r.ok) {
            const j = (await r.json()) as { address?: Record<string, string> };
            const a = j.address ?? {};
            const city = a.city || a.town || a.village || a.suburb || a.county;
            const region = a.state || a.region || a.country;
            if (city && region) label = `${city}, ${region}`;
            else if (region) label = region;
          }
        } catch {
          // ignore — keep fallback
        }
        setGeo({
          lat: latitude,
          lon: longitude,
          label,
          accuracy: accuracy && accuracy < 100 ? "High" : "Approx",
        });
      },
      () => setGeo({ lat: 0, lon: 0, label: "Your area", accuracy: "Approx" }),
      { enableHighAccuracy: true, timeout: 4000, maximumAge: 60000 },
    );
  }, []);

  // Advance steps on a timer. Step 4 (index 3) waits for AI; final step waits for AI too.
  const timerRef = useRef<number | null>(null);
  useEffect(() => {
    if (step >= 7) return;
    // Gate AI step: don't advance past step index 3 until AI is done
    if (step === 3 && aiPending) return;
    timerRef.current = window.setTimeout(() => setStep((s) => s + 1), STEP_MS[step]);
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [step, aiPending]);

  // Complete handoff
  useEffect(() => {
    if (step >= 7 && !aiPending && !aiError) {
      setFrozen(true);
      const t = setTimeout(onComplete, 900);
      return () => clearTimeout(t);
    }
  }, [step, aiPending, aiError, onComplete]);

  const mm = Math.floor(elapsed / 60);
  const ss = Math.floor(elapsed % 60).toString().padStart(2, "0");
  const progressPct = Math.min(100, (Math.min(step, 7) / 7) * 100);

  const steps = useMemo(
    () => [
      {
        title: "📍 Detecting your location",
        sub: "Using your phone's GPS to find the animal.",
      },
      {
        title: "📍 Location Found",
        sub: "GPS detected automatically",
      },
      {
        title: "🖼️ Preparing your photo",
        sub: "Optimizing for AI analysis.",
      },
      {
        title: "🤖 AI analyzing the photo ⭐",
        sub: "Voyce AI found:",
      },
      {
        title: "🪪 Creating rescue card",
        sub: "Rescue Profile + AI Health Assessment, side by side.",
      },
      {
        title: "📢 Alerting the network",
        sub: "Reaching rescuers, fosters, vets, shelters, and animal lovers nearby.",
      },
      {
        title: "❤️ Voyce answers",
        sub: "Your rescue card is ready. You'll be notified when someone responds.",
      },
    ],
    [],
  );

  return (
    <div className="flex min-h-[100dvh] flex-col bg-background pb-10">
      <AIDisclosureBanner />
      <div className="mx-auto w-full max-w-md flex-1 flex flex-col px-5 pt-5">

        {/* Header row */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-serif text-[26px] leading-tight font-semibold tracking-tight">
              Your Rescue Journey
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Voyce is working on this animal's behalf
            </p>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
              ⏱ Mission timer
            </span>
            <span
              className="font-mono text-2xl font-semibold tabular-nums"
              style={{ color: DEEP_GOLD }}
            >
              {mm}:{ss}
            </span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-5 h-2 w-full overflow-hidden rounded-full bg-[oklch(0.92_0.02_85)]">
          <div
            className="h-full rounded-full transition-[width] duration-500 ease-out"
            style={{
              width: `${progressPct}%`,
              background: `linear-gradient(90deg, ${GOLD}, ${DEEP_GOLD})`,
            }}
          />
        </div>
        <div className="mt-1.5 text-right text-[11px] font-medium text-muted-foreground tabular-nums">
          {Math.min(step, 7)}/7
        </div>

        {/* Steps */}
        <ol className="mt-5 space-y-2.5">
          {steps.map((s, i) => {
            const done = i < step;
            const active = i === step;
            return (
              <StepRow
                key={s.title}
                index={i}
                title={s.title}
                sub={s.sub}
                done={done}
                active={active}
                geo={geo}
                assessment={assessment}
                aiPending={aiPending}
              />
            );
          })}
        </ol>

        {aiError && (
          <div className="mt-4 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {aiError}
          </div>
        )}

        <div className="mt-auto pt-8 text-center text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          AI is advisory — not a diagnosis
        </div>
      </div>
    </div>
  );
}

function StepRow({
  index,
  title,
  sub,
  done,
  active,
  geo,
  assessment,
  aiPending,
}: {
  index: number;
  title: string;
  sub: string;
  done: boolean;
  active: boolean;
  geo: Geo | null;
  assessment: Assessment | null;
  aiPending: boolean;
}) {
  const visible = done || active;
  return (
    <li
      className={`flex items-start gap-3 rounded-2xl border px-4 py-3 transition-all duration-300 ${
        done
          ? "border-[oklch(0.85_0.15_140)]/40 bg-[oklch(0.96_0.05_140)]/50"
          : active
            ? "border-[color:var(--voyce-gold,#FFD24A)] bg-[oklch(0.97_0.07_85)]/60 shadow-sm"
            : "border-border bg-card/50 opacity-70"
      }`}
      style={
        active
          ? ({ ["--voyce-gold" as never]: GOLD } as React.CSSProperties)
          : undefined
      }
    >
      <StateIndicator done={done} active={active} />
      <div className="min-w-0 flex-1">
        <div
          className={`text-sm font-semibold ${
            done ? "text-foreground/85" : active ? "text-foreground" : "text-muted-foreground"
          }`}
        >
          {title}
        </div>
        <div
          className={`mt-0.5 text-[13px] ${
            active ? "text-foreground/80" : "text-muted-foreground"
          }`}
        >
          {sub}
        </div>

        {/* Step 2 — location wow moment */}
        {index === 1 && visible && <LocationReveal geo={geo} />}

        {/* Step 4 — AI reveal wow moment */}
        {index === 3 && visible && (
          <AIReveal assessment={assessment} aiPending={aiPending} />
        )}
      </div>
    </li>
  );
}

function StateIndicator({ done, active }: { done: boolean; active: boolean }) {
  if (done) {
    return (
      <span
        className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full ring-2"
        style={{ background: "oklch(0.96 0.08 145)", color: GREEN, boxShadow: `0 0 0 2px ${GOLD}33` }}
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4">
          <path fill="currentColor" d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z" />
        </svg>
      </span>
    );
  }
  if (active) {
    return (
      <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center">
        <span
          className="h-5 w-5 animate-spin rounded-full border-[2.5px] border-t-transparent"
          style={{ borderColor: DEEP_GOLD, borderTopColor: "transparent" }}
        />
      </span>
    );
  }
  return (
    <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center">
      <span className="h-3.5 w-3.5 rounded-full border-2 border-muted-foreground/30" />
    </span>
  );
}

function LocationReveal({ geo }: { geo: Geo | null }) {
  const [show, setShow] = useState({ acc: false, approx: false, map: false, pin: false });
  useEffect(() => {
    const t1 = setTimeout(() => setShow((s) => ({ ...s, acc: true })), 400);
    const t2 = setTimeout(() => setShow((s) => ({ ...s, approx: true })), 900);
    const t3 = setTimeout(() => setShow((s) => ({ ...s, map: true })), 1400);
    const t4 = setTimeout(() => setShow((s) => ({ ...s, pin: true })), 1800);
    return () => [t1, t2, t3, t4].forEach(clearTimeout);
  }, []);

  const label = geo?.label ?? "Your area";
  const accuracy = geo?.accuracy ?? "Approx";
  const hasReal = !!geo && geo.lat !== 0 && geo.lon !== 0;
  // OSM static map via staticmap.openstreetmap.de is unreliable; use a tile snippet
  const mapUrl = hasReal
    ? `https://staticmap.openstreetmap.de/staticmap.php?center=${geo!.lat},${geo!.lon}&zoom=12&size=240x160&maptype=mapnik`
    : null;

  return (
    <div className="mt-2 space-y-1 text-[13px]">
      <div
        className={`transition-opacity duration-300 ${show.acc ? "opacity-100" : "opacity-0"} text-foreground/80`}
      >
        Accuracy: <span className="font-medium">{accuracy}</span>
      </div>
      <div
        className={`transition-opacity duration-300 ${show.approx ? "opacity-100" : "opacity-0"} text-foreground/80`}
      >
        Approx: <span className="font-medium">{label}</span>
      </div>
      <div
        className={`relative mt-2 overflow-hidden rounded-lg border border-border bg-[oklch(0.94_0.03_85)] transition-all duration-500 ${
          show.map ? "h-[80px] w-[120px] opacity-100" : "h-0 w-[120px] opacity-0"
        }`}
      >
        {mapUrl ? (
          <img
            src={mapUrl}
            alt="Location snapshot"
            width={120}
            height={80}
            className="h-full w-full object-cover"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">
            map
          </div>
        )}
        {show.pin && (
          <span
            className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-full text-2xl drop-shadow"
            style={{ animation: "voyce-pin-drop 0.6s cubic-bezier(.34,1.56,.64,1) both" }}
          >
            📍
          </span>
        )}
      </div>
      <style>{`
        @keyframes voyce-pin-drop {
          0% { transform: translate(-50%, -180%); opacity: 0; }
          60% { transform: translate(-50%, -90%); opacity: 1; }
          80% { transform: translate(-50%, -110%); }
          100% { transform: translate(-50%, -100%); }
        }
      `}</style>
    </div>
  );
}

function AIReveal({
  assessment,
  aiPending,
}: {
  assessment: Assessment | null;
  aiPending: boolean;
}) {
  const category = useMemo(() => {
    if (!assessment) return null;
    const s = assessment.status;
    if (s === "Urgent") return "Injured Animal";
    if (s === "Monitoring") return assessment.is_likely_pet ? "Healthy Pet" : "At-Risk Animal";
    if (s === "Stable") return "Lost & Found";
    return "Healthy Pet";
  }, [assessment]);

  const priority = useMemo(() => {
    if (!assessment) return null;
    const u = getUrgency(assessment);
    return `${u.emoji} ${u.label}`;
  }, [assessment]);

  const species = assessment
    ? assessment.species.charAt(0).toUpperCase() + assessment.species.slice(1)
    : null;

  const ready = !!assessment && !aiPending;
  const lines = [
    { label: "Category", value: category },
    { label: "Priority", value: priority },
    { label: "Species", value: species },
  ];

  const [revealed, setRevealed] = useState(0);
  useEffect(() => {
    if (!ready) return;
    setRevealed(0);
    const timers = [500, 1000, 1500].map((d, i) =>
      setTimeout(() => setRevealed(i + 1), d),
    );
    return () => timers.forEach(clearTimeout);
  }, [ready]);

  return (
    <div className="mt-2 space-y-1.5">
      {!ready && (
        <div className="text-[12px] text-muted-foreground italic">Analyzing…</div>
      )}
      {ready &&
        lines.map((l, i) => (
          <div
            key={l.label}
            className={`flex items-center gap-2 text-[13px] transition-all duration-300 ${
              i < revealed ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0"
            }`}
          >
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" style={{ color: GREEN }}>
              <path fill="currentColor" d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z" />
            </svg>
            <span className="text-muted-foreground">{l.label}:</span>
            <span className="font-medium text-foreground">{l.value ?? "—"}</span>
          </div>
        ))}
    </div>
  );
}
