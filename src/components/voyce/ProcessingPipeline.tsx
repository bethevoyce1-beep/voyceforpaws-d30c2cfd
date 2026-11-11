import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { Assessment } from "@/lib/analyze.functions";
import type { PhotoMeta } from "@/lib/exif";
import { getUrgency } from "@/lib/urgency";
import { AIDisclosureBanner } from "@/components/voyce/AIDisclosureBanner";
import { BrandHeader } from "@/components/voyce/BrandHeader";



type Geo = {
  lat: number;
  lon: number;
  label: string; // place/neighbourhood/city or "Your area"
  accuracy: "High" | "Approx" | "Photo";
  accuracyM?: number; // numeric GPS accuracy in metres, when known
  precision?: string; // Google location_type (ROOFTOP | ...) or "approximate"
  note?: string; // why a fallback was used, if any
};

// Supabase project — the publishable (anon) key is not secret; it already ships
// in the public landing page. Used to call the reverse-geocode edge function.
const SB_URL =
  (import.meta.env.VITE_SUPABASE_URL as string | undefined) ||
  "https://okmukfrhvqkxphzueqww.supabase.co";
const SB_KEY =
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ||
  "sb_publishable_e_OWsyXVeFqgV6EVGAKKTw_sgEV2cTN";

type Resolved = {
  label: string;
  // ROOFTOP | RANGE_INTERPOLATED | GEOMETRIC_CENTER | APPROXIMATE | approximate
  precision: string;
  source: string; // "google" | "nominatim"
  note?: string;
};

// Turn coordinates into a human place label + a precision signal. Prefers the
// `reverse-geocode` edge function (Google rooftop when the Geocoding API is
// enabled, Nominatim fallback baked in). If the function is unreachable, falls
// back to calling Nominatim directly so the flow still resolves a label.
async function resolveAddress(lat: number, lon: number): Promise<Resolved> {
  try {
    const r = await fetch(`${SB_URL}/functions/v1/reverse-geocode`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SB_KEY,
        Authorization: `Bearer ${SB_KEY}`,
      },
      body: JSON.stringify({ lat, lon }),
    });
    if (r.ok) {
      const j = (await r.json()) as Partial<Resolved> | null;
      if (j && typeof j.label === "string" && j.label) {
        return {
          label: j.label,
          precision: j.precision || "approximate",
          source: j.source || "google",
          note: j.note,
        };
      }
    }
  } catch {
    /* fall through to direct Nominatim */
  }
  return {
    label: await reverseGeocodeNominatim(lat, lon),
    precision: "approximate",
    source: "nominatim",
  };
}

// Direct Nominatim fallback (used only if the edge function can't be reached).
// Deliberately OMITS the house number — at zoom=18 Nominatim snaps to the
// nearest known number and prints it as exact, which is the "few houses off"
// bug. Street + neighbourhood + city is honest for an approximate fix.
async function reverseGeocodeNominatim(lat: number, lon: number): Promise<string> {
  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&addressdetails=1&zoom=18&lat=${lat}&lon=${lon}`,
      { headers: { Accept: "application/json" } },
    );
    if (!r.ok) return "Your area";
    const j = (await r.json()) as {
      name?: string;
      display_name?: string;
      address?: Record<string, string>;
    };
    const a = j.address ?? {};
    const place =
      a.road || a.pedestrian || j.name || a.leisure || a.amenity || a.building;
    const area = a.neighbourhood || a.suburb || a.quarter || a.city_district;
    const city = a.city || a.town || a.village || a.municipality || a.county;
    const parts = [place, area, city].filter((p): p is string => Boolean(p));
    const seen = new Set<string>();
    const uniq = parts.filter((p) => (seen.has(p) ? false : (seen.add(p), true)));
    if (uniq.length) return uniq.slice(0, 3).join(", ");
    if (j.display_name) return j.display_name.split(",").slice(0, 2).join(",").trim();
    return "Your area";
  } catch {
    return "Your area";
  }
}

type Props = {
  image: string | null;
  meta: PhotoMeta | null;
  aiPending: boolean;
  aiError: string | null;
  assessment: Assessment | null;
  onComplete: () => void;
  onRetry?: () => void;
  onLocate?: (loc: { lat: number; lon: number; label: string; accuracy?: number; precision?: string }) => void;
};

const GOLD = "#FFDF3B";
const DEEP_GOLD = "#C9871A";
const GREEN = "oklch(0.6 0.17 145)";

// Shared with RescueCard: the reporter's address-visibility choice, set here on
// the analyzing screen BEFORE the card goes out, so it's locked in at send time.
const LOC_PRIVACY_KEY = "voyce_loc_privacy";
type LocPrivacy = "exact" | "area" | "hidden";

// Step durations in ms. Kept snappy so the flow is only gated by the real AI
// call (step index 3 waits for aiPending) — minimal fixed overhead so the card
// appears as soon as the AI returns.
const STEP_MS = [120, 200, 120, 250, 120];

export function ProcessingPipeline({ image, meta, aiPending, aiError, assessment, onComplete, onRetry, onLocate }: Props) {
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

  // Determine the animal's location. If the uploaded photo carried its own GPS,
  // trust that (it's where the animal actually is). Otherwise fall back to the
  // reporter's current device location.
  useEffect(() => {
    if (meta && meta.lat != null && meta.lon != null) {
      const la = meta.lat;
      const lo = meta.lon;
      void resolveAddress(la, lo).then((res) =>
        setGeo({
          lat: la,
          lon: lo,
          label: res.label,
          accuracy: "Photo",
          precision: res.precision,
          note: res.note,
        }),
      );
      return;
    }
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGeo({ lat: 0, lon: 0, label: "Your area", accuracy: "Approx" });
      return;
    }
    // Sample high-accuracy fixes for ~5s and keep the SMALLEST-accuracy (most
    // precise) reading, instead of trusting a single first fix — a first fix is
    // often coarse and reverse-geocodes to the wrong house. Always fresh
    // (maximumAge:0), never a cached/coarse position.
    let best: GeolocationPosition | null = null;
    let done = false;
    let watchId = 0;
    let timer = 0;
    const opts: PositionOptions = {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 8000,
    };
    const finalize = async () => {
      if (done) return;
      done = true;
      window.clearTimeout(timer);
      try {
        navigator.geolocation.clearWatch(watchId);
      } catch {
        /* ignore */
      }
      if (!best) {
        setGeo({ lat: 0, lon: 0, label: "Your area", accuracy: "Approx" });
        return;
      }
      const { latitude, longitude, accuracy } = best.coords;
      const res = await resolveAddress(latitude, longitude);
      setGeo({
        lat: latitude,
        lon: longitude,
        label: res.label,
        accuracy: accuracy != null && accuracy < 100 ? "High" : "Approx",
        accuracyM: accuracy ?? undefined,
        precision: res.precision,
        note: res.note,
      });
    };
    watchId = navigator.geolocation.watchPosition(
      (pos) => {
        if (!best || pos.coords.accuracy < best.coords.accuracy) best = pos;
        // A rooftop-tight fix (<=20m) is as good as it gets — lock in early.
        if (pos.coords.accuracy != null && pos.coords.accuracy <= 20)
          void finalize();
      },
      () => {
        if (!best) void finalize();
      },
      opts,
    );
    // Collect for ~5s, then lock in the smallest-accuracy fix.
    timer = window.setTimeout(() => void finalize(), 5000);
    return () => {
      done = true;
      window.clearTimeout(timer);
      try {
        navigator.geolocation.clearWatch(watchId);
      } catch {
        /* ignore */
      }
    };
  }, [meta]);

  // Report the resolved location up so the rescue card can offer a "View Map"
  // link to the animal's GPS. Skip the (0,0) "unknown" fallback.
  useEffect(() => {
    if (geo && (geo.lat !== 0 || geo.lon !== 0)) {
      onLocate?.({
        lat: geo.lat,
        lon: geo.lon,
        label: geo.label,
        accuracy: geo.accuracyM,
        precision: geo.precision,
      });
    }
  }, [geo, onLocate]);

  // Advance steps on a timer. Step 4 (index 3) waits for AI; final step waits for AI too.
  const timerRef = useRef<number | null>(null);
  useEffect(() => {
    if (step >= 5) return;
    // Gate AI step: don't advance past step index 3 until AI is done
    if (step === 3 && aiPending) return;
    timerRef.current = window.setTimeout(() => setStep((s) => s + 1), STEP_MS[step]);
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [step, aiPending]);

  // Complete handoff
  useEffect(() => {
    if (step >= 5 && !aiPending && !aiError) {
      setFrozen(true);
      const t = setTimeout(onComplete, 120);
      return () => clearTimeout(t);
    }
  }, [step, aiPending, aiError, onComplete]);

  const mm = Math.floor(elapsed / 60);
  const ss = Math.floor(elapsed % 60).toString().padStart(2, "0");
  const progressPct = Math.min(100, (Math.min(step, 5) / 5) * 100);

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
        sub: "Reading the photo into a Rescue Profile + Voyce's First Look.",
      },
    ],
    [],
  );

  return (
    <div className="flex min-h-[100dvh] flex-col bg-background pb-10">
      <BrandHeader />
      <AIDisclosureBanner />
      <div className="mx-auto w-full max-w-md flex-1 flex flex-col px-5 pt-5">

        {/* Pre-launch pill — same as the capture/intake screens, so the "Live
            Demo · Pre-launch" note is visible on every path after a photo is
            taken (mobile native camera, desktop webcam, upload, or sample). */}
        <div className="mb-3 flex justify-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#E8C97A] bg-gradient-to-b from-[#FBF1C8] to-[#F5E3A0] px-3.5 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-[#7A5A0A] shadow-sm">
            <span aria-hidden>📷</span>
            <span>Live Demo · Pre-launch</span>
          </span>
        </div>

        {/* Header row */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-serif text-[26px] leading-tight font-semibold tracking-tight">
              The Rescue Journey
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Your one photo can help this rescue happen faster
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

        {/* Animal photo being analyzed — Voyce-styled: gold frame + gold scan
            sweep + status chip. Distinct from Karuna's plain photo rectangle;
            reassures the reporter the right photo is being read. */}
        {image && (
          <div
            className="relative mx-auto mt-4 w-full overflow-hidden rounded-2xl border-2 shadow-md"
            style={{ borderColor: GOLD, aspectRatio: "4 / 3" }}
          >
            <img
              src={image}
              alt="Animal being analyzed"
              className="absolute inset-0 h-full w-full object-cover"
            />
            {aiPending && (
              <div
                className="voyce-scan pointer-events-none absolute inset-x-0 h-1/3"
                style={{
                  background:
                    "linear-gradient(to bottom, transparent, rgba(255,223,59,0.45), transparent)",
                }}
              />
            )}
            <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-[color:rgba(255,223,59,0.55)]" />
            <div className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm backdrop-blur-md">
              <span aria-hidden>{aiPending ? "🔍" : "✓"}</span>
              <span>{aiPending ? "Reading the photo…" : "Photo read"}</span>
            </div>
            <style>{`
              @keyframes voyce-scan {
                0% { transform: translateY(-110%); }
                100% { transform: translateY(410%); }
              }
              .voyce-scan { animation: voyce-scan 1.2s ease-in-out infinite; }
            `}</style>
          </div>
        )}

        {/* Address visibility — chosen NOW, before the card is sent to the
            pack. Defaults to the safe "Area only". */}
        <AddressPrivacyPicker />

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
          {Math.min(step, 5)}/5
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

        {aiError && (() => {
          const noAnimal = aiError.startsWith("NO_ANIMAL:");
          // Message is either "NO_ANIMAL:<subject>|<text>" (new) or
          // "NO_ANIMAL: <text>" (older) - handle both so nothing breaks.
          let subject = "";
          let text = aiError;
          if (noAnimal) {
            const rest = aiError.replace(/^NO_ANIMAL:\s*/, "");
            const bar = rest.indexOf("|");
            if (bar >= 0) {
              subject = rest.slice(0, bar).trim().toLowerCase();
              text = rest.slice(bar + 1).trim();
            } else {
              text = rest;
            }
          }
          const SUBJECT_UI = {
            person:  { icon: "🧑", headline: "That's a person, not an animal" },
            food:    { icon: "🍽️", headline: "That's food, not an animal" },
            vehicle: { icon: "🚗", headline: "That's a vehicle, not an animal" },
            plant:   { icon: "🪴", headline: "That's a plant, not an animal" },
            object:  { icon: "📦", headline: "That's an object, not an animal" },
            scenery: { icon: "🏞️", headline: "No animal in this scene" },
          };
          const ui = SUBJECT_UI[subject] || { icon: "🐾", headline: "No animal found in this photo" };
          return (
            <div
              className={`mt-4 rounded-xl border px-4 py-4 text-sm ${
                noAnimal
                  ? "border-[#C9871A]/40 bg-[#FFF7E6] text-[#7a5a12]"
                  : "border-destructive/40 bg-destructive/10 text-destructive"
              }`}
            >
              {noAnimal && (
                <div className="mb-1 text-[15px] font-bold">{ui.icon} {ui.headline}</div>
              )}
              <p className="leading-relaxed">{text}</p>
              {onRetry && (
                <button
                  type="button"
                  onClick={onRetry}
                  className="mt-3 w-full rounded-xl py-3 text-[14px] font-bold uppercase tracking-wide shadow-sm transition active:scale-[0.99]"
                  style={{ background: `linear-gradient(135deg, ${GOLD} 0%, ${DEEP_GOLD} 100%)`, color: "#3A2A07" }}
                >
                  📷 Try another photo
                </button>
              )}
            </div>
          );
        })()}

        <div className="mt-auto pt-8 text-center text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          AI is advisory — not a diagnosis
        </div>
      </div>
    </div>
  );
}

function AddressPrivacyPicker() {
  const [val, setVal] = useState<LocPrivacy>(() => {
    try {
      const v = typeof window !== "undefined" ? window.localStorage.getItem(LOC_PRIVACY_KEY) : null;
      return v === "exact" || v === "area" || v === "hidden" ? v : "area";
    } catch {
      return "area";
    }
  });

  const pick = (v: LocPrivacy) => {
    setVal(v);
    try {
      window.localStorage.setItem(LOC_PRIVACY_KEY, v);
    } catch {
      /* ignore */
    }
  };

  const opts: { id: LocPrivacy; label: string }[] = [
    { id: "area", label: "Area only" },
    { id: "exact", label: "Show exact" },
    { id: "hidden", label: "🙈 Hide" },
  ];

  const note =
    val === "exact"
      ? "Rescuers will see the precise spot + map pin."
      : val === "area"
        ? "Only a general area shows — no exact pin or street address."
        : "No location shows. You can still share it privately with rescuers.";

  return (
    <div className="mt-4 rounded-2xl border border-[#F0C88A] bg-[#FFF9EC] px-4 py-3">
      <div className="text-[12.5px] font-bold text-[#8A5A0E]">
        📍 Who can see the address on this alert?
      </div>
      <p className="mt-0.5 text-[11.5px] leading-snug text-[#6B5832]">
        Set this now — it locks in before your card goes out to the pack.
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {opts.map((o) => {
          const on = val === o.id;
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => pick(o.id)}
              className="rounded-full border px-2.5 py-1 text-[12px] font-bold transition active:scale-[0.97]"
              style={
                on
                  ? { borderColor: DEEP_GOLD, background: "#FFF6E5", color: "#8A5A0E" }
                  : { borderColor: "#E3DAC4", background: "#fff", color: "#6B5832" }
              }
            >
              {on ? "✓ " : ""}
              {o.label}
            </button>
          );
        })}
      </div>
      <p className="mt-1.5 text-[11px] text-[#8A5A0E]">{note}</p>
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
            ? "border-[color:var(--voyce-gold,#FFDF3B)] bg-[oklch(0.97_0.07_85)]/60 shadow-sm"
            : "border-border bg-card/50 opacity-70"
      }`}
      style={
        active
          ? ({ ["--voyce-gold" as never]: GOLD } as CSSProperties)
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
    const t1 = setTimeout(() => setShow((s) => ({ ...s, acc: true })), 80);
    const t2 = setTimeout(() => setShow((s) => ({ ...s, approx: true })), 160);
    const t3 = setTimeout(() => setShow((s) => ({ ...s, map: true })), 240);
    const t4 = setTimeout(() => setShow((s) => ({ ...s, pin: true })), 320);
    return () => [t1, t2, t3, t4].forEach(clearTimeout);
  }, []);

  const label = geo?.label ?? "Your area";
  const accuracy = geo?.accuracy ?? "Approx";
  const hasReal = !!geo && geo.lat !== 0 && geo.lon !== 0;
  // Interactive OpenStreetMap embed (no API key, reliable). A small bounding box
  // around the point gives a street-level view with a marker on the animal.
  const mapEmbed = hasReal
    ? (() => {
        const d = 0.004; // ~400m box
        const bbox = `${geo!.lon - d},${geo!.lat - d},${geo!.lon + d},${geo!.lat + d}`;
        return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik`;
      })()
    : null;
  // Free Google Maps deep-links (no API key). On a phone these open the native
  // Maps app with turn-by-turn directions, satellite, and street-level house view.
  const directionsLink = hasReal
    ? `https://www.google.com/maps/dir/?api=1&destination=${geo!.lat},${geo!.lon}`
    : null;
  const satelliteLink = hasReal
    ? `https://www.google.com/maps/@${geo!.lat},${geo!.lon},19z/data=!3m1!1e3`
    : null;
  const streetViewLink = hasReal
    ? `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${geo!.lat},${geo!.lon}`
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
      {geo?.precision && geo.precision !== "ROOFTOP" && (
        <div
          className={`transition-opacity duration-300 ${show.approx ? "opacity-100" : "opacity-0"} text-[12px] italic text-[#8A5A0E]`}
        >
          Approximate — confirm the exact spot on the map.
        </div>
      )}
      {hasReal && mapEmbed && (
        <div
          className={`mt-2 overflow-hidden rounded-xl border border-border transition-opacity duration-500 ${
            show.map ? "opacity-100" : "opacity-0"
          }`}
        >
          <div className="relative">
            <iframe
              title="Animal location map"
              src={mapEmbed}
              loading="lazy"
              className="block h-[190px] w-full border-0"
            />
            {/* Custom red location pin at map centre (bbox is centred on the point,
                so screen-centre = the animal). OSM's own marker is dropped above. */}
            <span aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-full">
              <svg width="26" height="26" viewBox="0 0 24 24" style={{ filter: "drop-shadow(0 1px 1.5px rgba(0,0,0,0.35))" }}>
                <path fill="#DC2626" stroke="#ffffff" strokeWidth="1.5" d="M12 2c-3.9 0-7 3.1-7 7 0 5 7 13 7 13s7-8 7-13c0-3.9-3.1-7-7-7z" />
                <circle cx="12" cy="9" r="2.5" fill="#ffffff" />
              </svg>
            </span>
          </div>
          <div className="grid grid-cols-3 divide-x divide-border border-t border-border bg-card text-center text-[12px] font-semibold text-[color:oklch(0.45_0.13_150)]">
            <a href={directionsLink ?? "#"} target="_blank" rel="noopener noreferrer" className="py-2.5 transition hover:bg-muted">
              🧭 Directions
            </a>
            <a href={satelliteLink ?? "#"} target="_blank" rel="noopener noreferrer" className="py-2.5 transition hover:bg-muted">
              🛰️ Satellite
            </a>
            <a href={streetViewLink ?? "#"} target="_blank" rel="noopener noreferrer" className="py-2.5 transition hover:bg-muted">
              🏠 Street View
            </a>
          </div>
        </div>
      )}
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
    const timers = [80, 160, 240].map((d, i) =>
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
      {ready && revealed >= lines.length && (
        <div
          className={`pt-1 text-[11.5px] italic leading-snug text-muted-foreground transition-opacity duration-500 ${
            revealed >= lines.length ? "opacity-100" : "opacity-0"
          }`}
        >
          ⚠️ AI may misidentify. Final assessments rest with rescuers and licensed vets.
        </div>
      )}
    </div>
  );
}
