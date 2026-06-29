import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import pawLogo from "@/assets/voyce-paw.png";
import sampleDogEye from "@/assets/sample-dog-eye.jpg";
import sampleCatEar from "@/assets/sample-cat-ear.jpg";
import samplePaw from "@/assets/sample-paw.jpg";
import sampleCatNose from "@/assets/sample-cat-nose.jpg";
import sampleDogSkin from "@/assets/sample-dog-skin.jpg";
import sampleBird from "@/assets/sample-bird.jpg";
import { analyzeImage, type Assessment } from "@/lib/analyze.functions";
import { ProcessingPipeline } from "@/components/voyce/ProcessingPipeline";
import { RescueReport } from "@/components/voyce/RescueReport";
import { StatusTimeline } from "@/components/voyce/StatusTimeline";
import { DemoGate } from "@/components/voyce/DemoGate";
import { Outcome } from "@/components/voyce/Outcome";
import { MissionPicker } from "@/components/voyce/MissionPicker";
import { ShareCard } from "@/components/voyce/ShareCard";
import { ShelterPicker } from "@/components/voyce/ShelterPicker";
import type { AcsAnimal } from "@/lib/acs.functions";
import { BrandHeader } from "@/components/voyce/BrandHeader";
import { MISSIONS, type MissionId } from "@/lib/missions";



export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Voyce — A voice for every animal" },
      {
        name: "description",
        content:
          "Snap or upload a photo of an animal. Voyce builds a rescue card in seconds. AI is advisory, not a diagnosis.",
      },
    ],
  }),
  component: Home,
});

const SAMPLES = [
  { src: sampleDogEye, label: "Dog eye" },
  { src: sampleCatEar, label: "Cat ear" },
  { src: samplePaw, label: "Paw pad" },
  { src: sampleCatNose, label: "Cat nose" },
  { src: sampleDogSkin, label: "Skin spot" },
  { src: sampleBird, label: "Bird beak" },
];

type Stage = "mission" | "shelter" | "capture" | "processing" | "report" | "share" | "timeline" | "gate" | "outcome";

function isLikelyMobile() {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

async function toDataUrl(src: string): Promise<string> {
  if (src.startsWith("data:")) return src;
  const res = await fetch(src);
  const blob = await res.blob();
  return await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

function assessmentFromAcs(a: AcsAnimal): Assessment {
  const urgent = a.status === "pm_cutoff" || a.urgency >= 85;
  return {
    title: `${a.name} · ${a.shelter_name}`,
    status: urgent ? "Urgent" : "Stable",
    status_reason: urgent
      ? `On the shelter's at-risk list · ${a.days_at_shelter} days in kennel`
      : `Listed at ${a.shelter_name}`,
    species: a.species || "dog",
    breed: a.breed || "Mixed",
    age: a.age || "unknown",
    weight: a.weight || "unknown",
    first_look:
      a.story ||
      `${a.name} is listed at ${a.shelter_name}, kennel ${a.kennel_id ?? "—"}. ${a.days_at_shelter} days in shelter.`,
    behavior: `Calm in kennel context · ${a.tags?.join(", ") || "standard intake"}`,
    location_scene: `${a.shelter_name}, kennel ${a.kennel_id ?? "—"}`,
    noticed: [],
    next_steps: [
      "Commit a foster bed tonight",
      "Coordinate rescue pull with shelter",
      "Share to grow the network",
    ],
    vet_notes: {
      bcs: "Not yet assessed",
      posture: "Kennel-stressed but responsive",
      hydration: "Provided in-kennel",
      clinical: `Animal ID: ${a.kennel_id ?? "n/a"} · Intake info via ${a.shelter_name}.`,
    },
    is_likely_pet: false,
    setting_type: "Shelter/Kennel",
    surface: "Concrete kennel floor with rubber mat",
    surrounding_objects: ["stainless water bowl", "kennel bars", "ID card"],
    lighting_conditions: "Fluorescent shelter lighting",
    safety_flags: ["None — controlled shelter environment"],
    environment_text: `${a.shelter_name} kennel ${a.kennel_id ?? "—"}. ${a.name} has been waiting ${a.days_at_shelter} days.`,
    health_signs: { sick: false, injured: false, lethargic: false, dehydrated: false },
    visible_condition: urgent ? "Concerning" : "Healthy",
    symptoms: [],
    clinical_actions: ["Intake exam", "Vaccinate per shelter protocol", "Spay/neuter pre-release"],
    differentials: [],
    reportedAt: a.last_pulled_at,
  };
}

function Home() {
  const [stage, setStage] = useState<Stage>("mission");
  const [mission, setMission] = useState<MissionId>("injured");
  const [captured, setCaptured] = useState<string | null>(null);
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [aiPending, setAiPending] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const startAnalysis = useCallback(
    async (src: string) => {
      setAiPending(true);
      setAiError(null);
      setAssessment(null);
      setStage("processing");
      try {
        const dataUrl = await toDataUrl(src);
        setCaptured(dataUrl);
        const result = await analyzeImage({
          data: { imageDataUrl: dataUrl, mission },
        });
        setAssessment(result);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "AI analysis failed.";
        console.error("[voyce] analyze failed:", msg);
        setAiError(msg);
      } finally {
        setAiPending(false);
      }
    },
    [mission],
  );

  const reset = () => {
    setStage("mission");
    setCaptured(null);
    setAssessment(null);
    setAiError(null);
  };

  if (stage === "mission") {
    return (
      <MissionPicker
        onPick={(id) => {
          setMission(id);
          setStage(id === "at-risk-shelter" ? "shelter" : "capture");
        }}
      />
    );
  }

  if (stage === "shelter") {
    return (
      <ShelterPicker
        onBack={() => setStage("mission")}
        onPick={(animal: AcsAnimal) => {
          setMission("at-risk-shelter");
          setCaptured(animal.photo_url);
          setAssessment(assessmentFromAcs(animal));
          setStage("share");
        }}
      />
    );
  }

  if (stage === "processing") {
    return (
      <ProcessingPipeline
        aiPending={aiPending}
        aiError={aiError}
        assessment={assessment}
        onComplete={() => assessment && setStage("report")}
      />
    );
  }

  if (stage === "report" && assessment && captured) {
    return (
      <RescueReport
        image={captured}
        data={assessment}
        mission={mission}
        onContinue={() => setStage("share")}
      />
    );
  }
  if (stage === "share" && assessment && captured) {
    return (
      <ShareCard
        image={captured}
        data={assessment}
        mission={mission}
        onContinue={() => setStage("timeline")}
      />
    );
  }
  if (stage === "timeline") {
    return <StatusTimeline onContinue={() => setStage("gate")} />;
  }
  if (stage === "gate") {
    return <DemoGate onDone={() => setStage("outcome")} />;
  }
  if (stage === "outcome") {
    return <Outcome onRestart={reset} />;
  }

  return (
    <CaptureScreen
      onAnalyze={startAnalysis}
      missionLabel={MISSIONS[mission].capturePillLabel}
      missionAccent={MISSIONS[mission].accent}
      onBack={() => setStage("mission")}
    />
  );
}


function CaptureScreen({
  onAnalyze,
  missionLabel,
  missionAccent,
  onBack,
}: {
  onAnalyze: (src: string) => void;
  missionLabel: string;
  missionAccent: string;
  onBack: () => void;
}) {

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [mode, setMode] = useState<"loading" | "camera" | "samples" | "permission">("loading");
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let activeStream: MediaStream | null = null;
    const mobile = isLikelyMobile();
    const hasCamera =
      typeof navigator !== "undefined" &&
      !!navigator.mediaDevices &&
      typeof navigator.mediaDevices.getUserMedia === "function";
    if (!mobile || !hasCamera) {
      setMode("samples");
      return;
    }
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        activeStream = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setMode("camera");
      } catch (e) {
        const name = (e as { name?: string })?.name ?? "";
        if (name === "NotAllowedError" || name === "SecurityError") {
          setMode("permission");
        } else {
          setMode("samples");
          setError("Camera unavailable — pick a sample below.");
        }
      }
    })();
    return () => {
      cancelled = true;
      activeStream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const capture = () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    setPreview(canvas.toDataURL("image/jpeg", 0.92));
  };

  return (
    <div className="relative flex min-h-[100dvh] flex-col bg-background text-foreground">
      <header className="sticky top-0 z-30">
        <BrandHeader />
      </header>


      <div className="absolute inset-x-0 top-[max(3.5rem,calc(env(safe-area-inset-top)+3rem))] z-20 flex justify-center px-4">
        <button
          onClick={onBack}
          className="flex items-center gap-2 rounded-full bg-background/90 px-3.5 py-1.5 text-[12px] font-semibold shadow-md backdrop-blur-md transition hover:bg-background"
          style={{ color: missionAccent, borderLeft: `3px solid ${missionAccent}` }}
        >
          <span>📋</span>
          <span>Reporting · {missionLabel}</span>
          <span className="text-muted-foreground/70 text-[11px]">change</span>
        </button>
      </div>



      <main className="relative flex flex-1 flex-col">
        {mode === "loading" && (
          <div className="flex flex-1 items-center justify-center">
            <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-[oklch(0.88_0.16_85)] border-t-transparent" />
          </div>
        )}

        {mode === "camera" && (
          <div className="relative flex-1 bg-black">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="aspect-square w-[78%] max-w-md rounded-3xl border-2 border-[oklch(0.88_0.16_85)]/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.25)]" />
            </div>
            <button
              type="button"
              onClick={capture}
              aria-label="Capture photo"
              className="absolute left-1/2 bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] z-10 -translate-x-1/2 rounded-full bg-white p-1.5 shadow-lg ring-2 ring-[oklch(0.88_0.16_85)] active:scale-95 transition"
            >
              <div className="h-16 w-16 rounded-full bg-[oklch(0.88_0.16_85)]" />
            </button>
          </div>
        )}

        {mode === "permission" && (
          <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
            <div className="max-w-sm">
              <h1 className="font-serif text-2xl font-semibold tracking-tight">Camera access blocked</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Enable camera in your browser settings, or try a sample photo instead.
              </p>
              <div className="mt-5 flex flex-col gap-2">
                <button
                  onClick={() => window.location.reload()}
                  className="rounded-full bg-[oklch(0.88_0.16_85)] px-5 py-2.5 text-sm font-semibold text-[oklch(0.25_0.04_60)] shadow-sm"
                >
                  Try again
                </button>
                <button
                  onClick={() => setMode("samples")}
                  className="rounded-full border border-border bg-card px-5 py-2.5 text-sm font-medium"
                >
                  Use a sample photo
                </button>
              </div>
            </div>
          </div>
        )}

        {mode === "samples" && (
          <div className="flex flex-1 flex-col items-center justify-center px-5 pt-24 pb-32">
            <div className="w-full max-w-2xl">
              <h1 className="text-center font-serif text-3xl font-semibold tracking-tight">
                Pick a starter photo
              </h1>
              <p className="mt-1 text-center text-sm text-muted-foreground">
                Tap any image to run a sample through Voyce.
              </p>
              {error && <p className="mt-3 text-center text-xs text-muted-foreground">{error}</p>}
              <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {SAMPLES.map((s) => (
                  <button
                    key={s.label}
                    onClick={() => onAnalyze(s.src)}
                    className="group relative aspect-square overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition hover:shadow-md hover:ring-2 hover:ring-[oklch(0.88_0.16_85)] active:scale-[0.98]"
                  >
                    <img
                      src={s.src}
                      alt={s.label}
                      width={512}
                      height={512}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 to-transparent px-2.5 py-1.5 text-left">
                      <span className="text-xs font-medium text-white">{s.label}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {preview && (
          <div className="absolute inset-0 z-30 flex flex-col bg-background">
            <div className="relative flex-1">
              <img src={preview} alt="Captured" className="absolute inset-0 h-full w-full object-contain" />
            </div>
            <div className="flex items-center justify-center gap-3 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4">
              <button
                onClick={() => setPreview(null)}
                className="rounded-full border border-border bg-card px-5 py-2.5 text-sm font-medium"
              >
                Retake
              </button>
              <button
                onClick={() => onAnalyze(preview)}
                className="rounded-full bg-gradient-to-b from-[oklch(0.90_0.16_85)] to-[oklch(0.78_0.15_70)] px-6 py-2.5 text-sm font-semibold text-[oklch(0.25_0.04_60)] shadow-md"
              >
                Analyze →
              </button>
            </div>
          </div>
        )}
      </main>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="pointer-events-auto flex items-center gap-2">
          {mode === "camera" && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="rounded-full bg-background/90 px-4 py-2.5 text-sm font-medium text-foreground shadow-md backdrop-blur-md hover:bg-background"
            >
              Upload
            </button>
          )}
          {mode !== "samples" && (
            <button
              type="button"
              onClick={() => setMode("samples")}
              className="rounded-full bg-[oklch(0.88_0.16_85)] px-5 py-2.5 text-sm font-semibold text-[oklch(0.25_0.04_60)] shadow-md hover:brightness-105 active:scale-[0.98] transition"
            >
              🎲 Try with a sample
            </button>
          )}
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          const reader = new FileReader();
          reader.onload = () => setPreview(String(reader.result));
          reader.readAsDataURL(f);
        }}
      />
    </div>
  );
}
