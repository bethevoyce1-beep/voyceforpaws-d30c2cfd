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
import { readPhotoMeta, type PhotoMeta } from "@/lib/exif";
import { ReportDetails } from "@/components/voyce/ReportDetails";
import type { ReportDetails as ReportDetailsData } from "@/components/voyce/ReportDetails";
import { BackNavContext } from "@/components/voyce/BrandHeader";
import { RescueReport } from "@/components/voyce/RescueReport";
import { StatusTimeline } from "@/components/voyce/StatusTimeline";
import { DemoGate } from "@/components/voyce/DemoGate";
import { Outcome } from "@/components/voyce/Outcome";
import { MissionPicker } from "@/components/voyce/MissionPicker";
import { ShareCard } from "@/components/voyce/ShareCard";
import { AcsShareCard } from "@/components/voyce/AcsShareCard";
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

type Stage = "mission" | "shelter" | "capture" | "processing" | "report" | "details" | "share" | "timeline" | "gate" | "outcome";

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
  const [captureMeta, setCaptureMeta] = useState<PhotoMeta | null>(null);
  const [location, setLocation] = useState<{ lat: number; lon: number; label: string } | null>(null);
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [acsAnimal, setAcsAnimal] = useState<AcsAnimal | null>(null);
  const [reportDetails, setReportDetails] = useState<ReportDetailsData | null>(null);
  const [aiPending, setAiPending] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Analyze the photo as soon as it's captured — the AI goes first, then the
  // reporter refines details afterward ("what did Voyce miss?").
  const runAnalysis = useCallback(
    async (dataUrl: string, meta: PhotoMeta | null) => {
      setAiPending(true);
      setAiError(null);
      setAssessment(null);
      try {
        const result = await analyzeImage({
          data: { imageDataUrl: dataUrl, mission, context: {} },
        });
        const caseId = (() => {
          try {
            const n = (parseInt(localStorage.getItem("voyce_case_seq") || "0", 10) || 0) + 1;
            localStorage.setItem("voyce_case_seq", String(n));
            return "VFP-" + String(n).padStart(4, "0");
          } catch {
            return "VFP-" + String(Date.now()).slice(-4);
          }
        })();
        setAssessment(
          meta?.takenAt
            ? { ...result, caseId, reportedAt: new Date(meta.takenAt).toISOString() }
            : { ...result, caseId },
        );
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

  // Photo captured/selected → analyze immediately, then collect the reporter's
  // corrections in the "Tell us about them" form.
  const handleCaptured = useCallback(
    async (src: string, meta?: PhotoMeta | null) => {
      const dataUrl = await toDataUrl(src);
      setCaptured(dataUrl);
      setCaptureMeta(meta ?? null);
      setStage("processing");
      void runAnalysis(dataUrl, meta ?? null);
    },
    [runAnalysis],
  );

  // Reporter finished the "Tell us about them" form → build the final card.
  const startReport = useCallback((details: ReportDetailsData) => {
    setReportDetails(details);
    setStage("report");
  }, []);

  const reset = () => {
    setStage("mission");
    setCaptured(null);
    setCaptureMeta(null);
    setLocation(null);
    setAssessment(null);
    setAcsAnimal(null);
    setReportDetails(null);
    setAiError(null);
  };

  // Back navigation — each step knows the step to return to. Surfaced as a ←
  // arrow in the shared header (via BackNavContext) on screens that don't
  // already have their own back control.
  const backTargets: Partial<Record<Stage, Stage>> = {
    processing: "capture",
    details: "capture",
    report: "details",
    share: "report",
    timeline: "share",
  };
  const goBack = () => {
    const prev = backTargets[stage];
    if (prev) setStage(prev);
  };
  // Wrap a screen so the header shows a back arrow to the previous step.
  const withBack = (el: React.ReactNode) => (
    <BackNavContext.Provider value={goBack}>{el}</BackNavContext.Provider>
  );

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
          setAcsAnimal(animal);
          setStage("share");
        }}
      />
    );
  }

  if (stage === "details" && captured && assessment) {
    return withBack(
      <ReportDetails
        image={captured}
        mission={mission}
        assessment={assessment}
        onContinue={startReport}
      />
    );
  }

  if (stage === "processing") {
    return withBack(
      <ProcessingPipeline
        image={captured}
        meta={captureMeta}
        onLocate={setLocation}
        aiPending={aiPending}
        aiError={aiError}
        assessment={assessment}
        onComplete={() => assessment && setStage("details")}
        onRetry={() => {
          setCaptured(null);
          setCaptureMeta(null);
          setAssessment(null);
          setAiError(null);
          setStage("capture");
        }}
      />
    );
  }

  if (stage === "report" && assessment && captured) {
    return withBack(
      <RescueReport
        image={captured}
        data={assessment}
        mission={mission}
        location={location}
        situation={reportDetails?.situation}
        onContinue={() => setStage("share")}
      />
    );
  }
  if (stage === "share" && mission === "at-risk-shelter" && acsAnimal) {
    return withBack(
      <AcsShareCard
        animal={acsAnimal}
        onContinue={() => setStage("timeline")}
      />
    );
  }
  if (stage === "share" && assessment && captured) {
    return withBack(
      <ShareCard
        image={captured}
        data={assessment}
        mission={mission}
        onContinue={() => setStage("timeline")}
      />
    );
  }
  if (stage === "timeline") {
    return withBack(<StatusTimeline onContinue={() => setStage("gate")} />);
  }
  if (stage === "gate") {
    return <DemoGate onDone={() => setStage("outcome")} />;
  }
  if (stage === "outcome") {
    return <Outcome onRestart={reset} />;
  }

  return (
    <CaptureScreen
      onAnalyze={handleCaptured}
      mission={mission}
      onBack={() => setStage("mission")}
    />
  );
}


function CaptureScreen({
  onAnalyze,
  mission,
  onBack,
}: {
  onAnalyze: (src: string, meta?: PhotoMeta | null) => void;
  mission: MissionId;
  onBack: () => void;
}) {
  const m = MISSIONS[mission];
  const missionLabel = m.capturePillLabel;
  const missionAccent = m.accent;

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  // EXIF metadata (capture time + GPS) of the most recently picked photo.
  const captureMetaRef = useRef<PhotoMeta | null>(null);
  // Separate refs so buttons open the right thing (image vs video, gallery vs camera).
  const videoUploadRef = useRef<HTMLInputElement | null>(null);   // "Upload a Video" → gallery
  const videoRecordRef = useRef<HTMLInputElement | null>(null);   // "Record a Video" → device camera
  // "intake" = pre-camera screen with 4 capture options + pre-launch banner.
  const [mode, setMode] = useState<"intake" | "loading" | "camera" | "samples" | "permission">("intake");
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  // Visible notice while a video is being processed into a still frame for the AI.
  const [videoProcessing, setVideoProcessing] = useState(false);

  // Track the active camera stream so we can stop it cleanly on unmount or mode-switch.
  const streamRef = useRef<MediaStream | null>(null);

  /**
   * Extract a single still frame from a user-supplied video and hand it back as a data URL.
   * Voyce's AI pipeline only reads images — pulling a frame lets video reports feed the
   * same rescue-card generator without any backend changes.
   *
   * Strategy:
   *   - Load the video off-screen with metadata + preload set.
   *   - Seek to ~1 second in (avoids black title frames) or 20 percent of duration.
   *   - Draw that frame to a canvas and export as a JPEG.
   */
  const extractVideoFrame = useCallback((file: File): Promise<string> => {
    return new Promise<string>((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const v = document.createElement("video");
      v.preload = "auto";
      v.muted = true;
      v.playsInline = true;
      v.setAttribute("playsinline", "true");
      v.setAttribute("webkit-playsinline", "true");
      v.setAttribute("muted", "true");
      // iOS Safari will NOT decode or seek an off-DOM <video>, so mount it hidden.
      v.style.cssText =
        "position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0;pointer-events:none;";
      document.body.appendChild(v);
      v.src = url;

      let done = false;
      const cleanup = () => {
        try {
          v.pause();
          v.removeAttribute("src");
          v.load();
        } catch {
          // ignore
        }
        if (v.parentNode) v.parentNode.removeChild(v);
        URL.revokeObjectURL(url);
      };
      const finish = (dataUrl: string) => {
        if (done) return;
        done = true;
        cleanup();
        resolve(dataUrl);
      };
      const fail = (err: Error) => {
        if (done) return;
        done = true;
        cleanup();
        reject(err);
      };

      const grab = () => {
        try {
          const w = v.videoWidth || 720;
          const h = v.videoHeight || 1280;
          const canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            fail(new Error("Could not read frame"));
            return;
          }
          ctx.drawImage(v, 0, 0, w, h);
          finish(canvas.toDataURL("image/jpeg", 0.9));
        } catch (err) {
          fail(err instanceof Error ? err : new Error("Frame extract failed"));
        }
      };

      // Never hang: if no frame within 10s, fail gracefully so the UI recovers.
      const timer = window.setTimeout(() => {
        if (v.videoWidth && v.readyState >= 2) grab();
        else fail(new Error("Couldn't read a frame from this video — try Upload a Photo instead."));
      }, 10000);

      const seekAndGrab = () => {
        v.onseeked = () => {
          window.clearTimeout(timer);
          grab();
        };
        const target = Math.min(1, (isFinite(v.duration) ? v.duration : 5) * 0.2);
        try {
          v.currentTime = target;
        } catch {
          window.clearTimeout(timer);
          grab();
        }
      };

      v.onloadeddata = () => {
        // iOS needs an actual play() to decode frames before we can draw one.
        const p = v.play();
        if (p && typeof (p as Promise<void>).then === "function") {
          (p as Promise<void>)
            .then(() => {
              try {
                v.pause();
              } catch {
                // ignore
              }
              seekAndGrab();
            })
            .catch(() => seekAndGrab());
        } else {
          seekAndGrab();
        }
      };
      v.onerror = () => fail(new Error("Video could not be read"));
    });
  }, []);

  const handleVideoFile = useCallback(
    async (file: File) => {
      setVideoProcessing(true);
      try {
        const frameDataUrl = await extractVideoFrame(file);
        setVideoProcessing(false);
        captureMetaRef.current = null; // video frame — use current time/location
        setPreview(frameDataUrl);
      } catch (e) {
        setVideoProcessing(false);
        const msg = e instanceof Error ? e.message : "Could not read video";
        setError(msg);
        setMode("samples");
      }
    },
    [extractVideoFrame],
  );

  useEffect(() => {
    // Cleanup-only effect. The camera stream is now started on demand when the
    // user taps "Take a Photo" from the intake screen — no auto-request.
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  // Auto-start analysis the moment a photo/frame is captured or selected, so the
  // user doesn't have to tap "Analyze" separately. onAnalyze advances to the
  // analysis stage, so this runs once per capture.
  useEffect(() => {
    if (preview) onAnalyze(preview, captureMetaRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preview]);

  const startCameraFlow = useCallback(async () => {
    const mobile = isLikelyMobile();
    const hasCamera =
      typeof navigator !== "undefined" &&
      !!navigator.mediaDevices &&
      typeof navigator.mediaDevices.getUserMedia === "function";
    if (!mobile || !hasCamera) {
      // Desktop or browser without a camera — fall back to sample picker.
      setMode("samples");
      return;
    }
    setMode("loading");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
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
  }, []);

  // "Take a Photo": on phones/tablets, open the native camera via a file input
  // with capture="environment". This is far more reliable than getUserMedia +
  // canvas, which returned blank/broken frames on iOS Safari. On desktop, keep
  // the existing webcam/sample flow.
  const handleTakePhoto = useCallback(() => {
    if (isLikelyMobile()) {
      cameraInputRef.current?.click();
    } else {
      void startCameraFlow();
    }
  }, [startCameraFlow]);

  const capture = () => {
    const video = videoRef.current;
    if (!video) return;
    captureMetaRef.current = null; // live capture — use current time/location
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

        {/* Mission intake screen — added June 30, 2026. Matches landing-page modal:
            4 capture options + pre-launch banner + inclusive copy. */}
        {mode === "intake" && (
          <div className="flex flex-1 flex-col items-center px-5 pb-32 pt-20">
            <div className="w-full max-w-md">
              {/* Pre-launch pill */}
              <div className="mx-auto mb-5 inline-flex items-center gap-1.5 rounded-full border border-[#E8C97A] bg-gradient-to-b from-[#FBF1C8] to-[#F5E3A0] px-3.5 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-[#7A5A0A] shadow-sm">
                <span aria-hidden>📷</span>
                <span>Live Demo · Pre-launch</span>
              </div>

              {/* Mission title + cinematic description */}
              <h1
                className="text-center font-serif text-[28px] font-bold leading-[1.1] tracking-tight"
                style={{ color: m.titleColor }}
              >
                {m.intakeTitle}
              </h1>
              <p className="mx-auto mt-3 max-w-sm text-center text-[14px] leading-relaxed text-foreground/80">
                {m.intakeDescription}
              </p>

              {/* 4-button grid: Take Photo / Record Video / Upload Photo / Upload Video */}
              <p className="mt-6 text-center text-[12.5px] font-semibold uppercase tracking-[0.12em] text-foreground/60">
                How are you reaching out?
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2.5">
                {/* PRIMARY: Take a Photo — gold gradient */}
                <button
                  type="button"
                  onClick={handleTakePhoto}
                  className="flex flex-col items-center justify-center gap-1.5 rounded-2xl py-4 text-[13.5px] font-bold shadow-sm transition active:scale-[0.98] hover:brightness-105"
                  style={{
                    background: "linear-gradient(135deg, #FFDF3B 0%, #C9871A 100%)",
                    color: "#3A2A07",
                  }}
                >
                  <span className="text-[20px]" aria-hidden>📷</span>
                  <span>Take a Photo</span>
                </button>
                {/* Record a Video — purple accent. Opens device camera in video mode
                    on mobile. Voyce extracts a still frame for the AI to analyze. */}
                <button
                  type="button"
                  onClick={() => videoRecordRef.current?.click()}
                  className="flex flex-col items-center justify-center gap-1.5 rounded-2xl py-4 text-[13.5px] font-bold shadow-sm transition active:scale-[0.98] hover:brightness-105"
                  style={{
                    background: "linear-gradient(135deg, #A78BFA 0%, #7C5BD9 100%)",
                    color: "#FFFFFF",
                  }}
                >
                  <span className="text-[20px]" aria-hidden>🎥</span>
                  <span>Record a Video</span>
                </button>
                {/* Upload a Photo — outlined */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-border bg-card py-4 text-[13.5px] font-bold text-foreground shadow-sm transition active:scale-[0.98] hover:bg-background"
                >
                  <span className="text-[20px]" aria-hidden>⬆️</span>
                  <span>Upload a Photo</span>
                </button>
                {/* Upload a Video — outlined. Opens gallery/file picker for video files.
                    Voyce extracts a still frame for the AI to analyze. */}
                <button
                  type="button"
                  onClick={() => videoUploadRef.current?.click()}
                  className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-border bg-card py-4 text-[13.5px] font-bold text-foreground shadow-sm transition active:scale-[0.98] hover:bg-background"
                >
                  <span className="text-[20px]" aria-hidden>⬆️</span>
                  <span>Upload a Video</span>
                </button>
              </div>

              {/* Privacy helper — same wording as landing-page modal */}
              <p className="mt-3 text-center text-[11px] leading-relaxed text-foreground/55">
                📱 Camera opens automatically on mobile &amp; tablet · 🔒 Stays on your device until you tap Send
              </p>

              {/* Voyce AI ready indicator — pulsing dot */}
              <div className="mx-auto mt-5 flex w-full items-center justify-center gap-2 rounded-2xl border border-[#E8D58A] bg-gradient-to-b from-[#FBF1C8]/70 to-[#F5E3A0]/70 px-4 py-2.5">
                <span className="relative inline-flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#C9871A] opacity-65" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-[#C9871A]" />
                </span>
                <span className="text-[12.5px] font-semibold text-[#7A5A0A]">
                  ✨ Voyce AI · Ready to read your photo
                </span>
              </div>

              {/* Pre-launch + inclusivity note */}
              <div className="mt-4 rounded-xl border border-dashed border-[#E0D6BB] bg-[#FBF7EC] px-4 py-3 text-center text-[12px] leading-relaxed text-[#6B5832]">
                Try Voyce on a stray or injured animal you&apos;ve seen — photo or
                video, either works. <strong>We&apos;re not live yet</strong> — this is a
                preview of how Voyce will alert the network when we launch.
              </div>

              {/* Fallback: try a sample */}
              <button
                type="button"
                onClick={() => setMode("samples")}
                className="mx-auto mt-5 block text-[12.5px] font-medium text-[#8A5A0E] underline-offset-2 hover:underline"
              >
                🎲 No photo handy? Try with a sample →
              </button>
            </div>

            {/* Video-processing toast — shown while we extract a still frame for the AI */}
            {videoProcessing && (
              <div
                role="status"
                className="fixed inset-x-0 bottom-[max(1.5rem,env(safe-area-inset-bottom))] z-40 mx-auto flex w-fit max-w-[90%] items-center gap-2 rounded-full bg-[#1A1611] px-5 py-3 text-[13px] font-semibold text-white shadow-xl"
              >
                <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                <span>Reading a frame from your video…</span>
              </div>
            )}
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
            {/* Polish-list fix (June 30, 2026): warm helper text + brand viewfinder.
                Viewfinder uses brand gold border + soft black scrim for focus. */}
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <div className="mb-5 inline-flex items-center gap-1.5 rounded-full bg-black/55 px-3.5 py-1.5 text-[11.5px] font-semibold tracking-tight text-white shadow-md backdrop-blur-md">
                <span aria-hidden>🐾</span>
                <span>Center the animal in the frame</span>
              </div>
              <div className="aspect-square w-[78%] max-w-md rounded-3xl border-2 border-[oklch(0.88_0.16_85)]/85 shadow-[0_0_0_9999px_rgba(20,15,5,0.42)]" />
            </div>
            {/* Polish-list fix (June 30, 2026): brand-aligned shutter
                — gradient gold inner disc + soft highlight for depth
                — explicit "Take a photo" label below for clarity */}
            <div className="absolute left-1/2 bottom-[calc(env(safe-area-inset-bottom)+5rem)] z-10 -translate-x-1/2 flex flex-col items-center gap-2.5">
              <button
                type="button"
                onClick={capture}
                aria-label="Take a photo"
                className="rounded-full bg-white p-1.5 shadow-lg ring-2 ring-[oklch(0.88_0.16_85)] active:scale-95 transition hover:brightness-105"
              >
                <div
                  className="relative h-16 w-16 overflow-hidden rounded-full shadow-inner"
                  style={{ background: "linear-gradient(135deg, #FFDF3B 0%, #C9871A 100%)" }}
                >
                  <div
                    className="absolute inset-0 rounded-full"
                    style={{ background: "radial-gradient(circle at 32% 28%, rgba(255,255,255,0.45) 0%, transparent 48%)" }}
                  />
                </div>
              </button>
              <span className="rounded-full bg-white/95 px-3 py-1 text-[11px] font-bold tracking-wide text-[oklch(0.25_0.04_60)] shadow-sm backdrop-blur">
                Take a photo
              </span>
            </div>
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
          {/* Hide the bottom "Try with a sample" pill on intake (it has its own
              link) and on samples mode (would be redundant). */}
          {mode !== "samples" && mode !== "intake" && (
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

      {/* "Upload a Photo" file picker — gallery only, no camera.
          (Live camera capture has its own viewport in mode === "camera".) */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          captureMetaRef.current = await readPhotoMeta(f);
          const reader = new FileReader();
          reader.onload = () => setPreview(String(reader.result));
          reader.readAsDataURL(f);
        }}
      />

      {/* "Take a Photo" (mobile) — opens the native camera via capture="environment"
          and reuses the same reliable FileReader path as Upload a Photo. Replaces the
          getUserMedia + canvas capture that produced blank frames on iOS Safari. */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          captureMetaRef.current = await readPhotoMeta(f);
          const reader = new FileReader();
          reader.onload = () => setPreview(String(reader.result));
          reader.readAsDataURL(f);
        }}
      />

      {/* "Upload a Video" — file picker for videos (gallery on mobile, file browser
          on desktop). Voyce extracts a still frame for AI analysis. */}
      <input
        ref={videoUploadRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          void handleVideoFile(f);
        }}
      />

      {/* "Record a Video" — same accept, but capture="environment" hints the browser to
          open the device's video camera on mobile instead of the file picker. */}
      <input
        ref={videoRecordRef}
        type="file"
        accept="video/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          void handleVideoFile(f);
        }}
      />
    </div>
  );
}
