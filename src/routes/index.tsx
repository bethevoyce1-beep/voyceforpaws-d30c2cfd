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
import { dhashFromDataUrl } from "@/lib/imageHash";
import { ProcessingPipeline } from "@/components/voyce/ProcessingPipeline";
import { readPhotoMeta, type PhotoMeta } from "@/lib/exif";
import { ReportDetails } from "@/components/voyce/ReportDetails";
import type { ReportDetails as ReportDetailsData } from "@/components/voyce/ReportDetails";
import { BackNavContext, DonateContext } from "@/components/voyce/BrandHeader";
import { RescueReport } from "@/components/voyce/RescueReport";
import { ReviewSheet, type ReviewResult } from "@/components/voyce/ReviewSheet";
import { NetworkAlerting } from "@/components/voyce/NetworkAlerting";
import { StatusTimeline } from "@/components/voyce/StatusTimeline";
import { DemoGate } from "@/components/voyce/DemoGate";
import { Outcome } from "@/components/voyce/Outcome";
import { MissionPicker } from "@/components/voyce/MissionPicker";
import { ShareCard } from "@/components/voyce/ShareCard";
import { AcsShareCard } from "@/components/voyce/AcsShareCard";
import { ShelterPicker } from "@/components/voyce/ShelterPicker";
import { BottomTabBar, type BottomTab } from "@/components/voyce/BottomTabBar";
import { JoinNetworkModal } from "@/components/voyce/JoinNetworkModal";
import { DonateModal } from "@/components/voyce/DonateModal";
import {
  normalizeStatusKey,
  ACS_STATUS_MODEL,
  statusLabel,
  type AcsAnimal,
} from "@/lib/acs.functions";
import { BrandHeader } from "@/components/voyce/BrandHeader";
import { MISSIONS, isWildSpecies, type MissionId } from "@/lib/missions";



export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Voyce — A voice for every animal" },
      {
        name: "description",
        content:
          "Snap or upload a photo of an animal. Voyce builds a rescue card in seconds. AI is advisory — not a diagnosis.",
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

type Stage = "mission" | "shelter" | "capture" | "processing" | "report" | "details" | "alerting" | "share" | "timeline" | "gate" | "outcome";

// Anti-scam Tier 2 (July 5, 2026): when the app loaded, for the server's
// time-on-page check — reports fired in under 10 seconds are a bot signal.
const appLoadedAt = Date.now();

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

// Shrink + re-encode a captured photo before it's sent to the AI. Full-res
// phone photos produce multi-megabyte base64 data URLs that make analysis slow
// and sometimes fail on mobile with "Load failed" (oversized request / timeout).
// If the largest dimension exceeds maxDim, draw the image to a canvas scaled to
// fit and export as JPEG at `quality`. This NEVER throws — on any failure, or if
// the image is already small, it resolves with the original dataUrl unchanged.
// Non-data: inputs (bundled sample images) are returned as-is.
async function downscaleDataUrl(
  dataUrl: string,
  maxDim = 1280,
  quality = 0.82,
): Promise<string> {
  if (!dataUrl.startsWith("data:")) return dataUrl;
  return await new Promise<string>((resolve) => {
    try {
      const img = new Image();
      img.onload = () => {
        try {
          const w = img.naturalWidth || img.width;
          const h = img.naturalHeight || img.height;
          const largest = Math.max(w, h);
          if (!largest || largest <= maxDim) {
            resolve(dataUrl);
            return;
          }
          const scale = maxDim / largest;
          const canvas = document.createElement("canvas");
          canvas.width = Math.round(w * scale);
          canvas.height = Math.round(h * scale);
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            resolve(dataUrl);
            return;
          }
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL("image/jpeg", quality));
        } catch {
          resolve(dataUrl);
        }
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    } catch {
      resolve(dataUrl);
    }
  });
}

// Pick the best available photo for an ACS animal — the scraper doesn't
// populate thumb/photos yet, so this is often null and the ACS card / picker
// fall back to a graceful placeholder.
function acsPhoto(a: AcsAnimal): string | null {
  if (a.thumb && a.thumb.trim()) return a.thumb.trim();
  if (a.photos && a.photos.length > 0) return a.photos[0];
  return null;
}

// Build a rescue-card Assessment from an ACS row. Maps the plain-language
// status model onto the card's urgency, and uses the shelter's own note
// (story) as the "first look" so the card stays honest to ACS's listing.
function assessmentFromAcs(a: AcsAnimal): Assessment {
  const key = normalizeStatusKey(a.status_key);
  const meta = key === "left" ? ACS_STATUS_MODEL.atrisk : ACS_STATUS_MODEL[key];
  const urgent = key === "b6spt" || key === "immediate" || key === "atrisk";
  const label = statusLabel(a);
  const kennel = a.kennel ?? "—";
  const days = typeof a.days === "number" ? a.days : null;
  const daysLine = days !== null ? `${days} days in kennel` : "in kennel";
  const shelter = "San Antonio ACS";

  return {
    title: `${a.name} · ${shelter}`,
    status: urgent ? "Urgent" : "Stable",
    status_reason: `${label} · ${meta.meaning}`,
    species: "dog",
    breed: a.breed || "Mixed",
    age: a.age || a.age_raw || "unknown",
    weight: typeof a.weight === "number" ? `${a.weight} lb` : "unknown",
    size: "",
    color: a.color || "",
    first_look:
      a.story ||
      `${a.name} is listed at ${shelter}, kennel ${kennel}. ${daysLine}.`,
    behavior: "Calm in kennel context · standard intake",
    location_scene: `${shelter}, kennel ${kennel}`,
    noticed: [],
    next_steps: [
      meta.action,
      "Coordinate a foster or rescue pull with ACS",
      "Share to grow the pack",
    ],
    vet_notes: {
      bcs: "Not yet assessed",
      posture: "Kennel-stressed but responsive",
      hydration: "Provided in-kennel",
      clinical: `ACS ID: ${a.id} · Kennel ${kennel} · Intake info via ${shelter}.`,
    },
    is_likely_pet: false,
    setting_type: "Shelter/Kennel",
    surface: "Concrete kennel floor with rubber mat",
    surrounding_objects: ["stainless water bowl", "kennel bars", "ID card"],
    lighting_conditions: "Fluorescent shelter lighting",
    safety_flags: ["None — controlled shelter environment"],
    environment_text: `${shelter} kennel ${kennel}. ${a.name} ${
      days !== null ? `has been waiting ${days} days` : "is on the at-risk list"
    }.`,
    health_signs: { sick: false, injured: false, lethargic: false, dehydrated: false },
    visible_condition: urgent ? "Concerning" : "Healthy",
    symptoms: [],
    clinical_actions: ["Intake exam", "Vaccinate per shelter protocol", "Spay/neuter pre-release"],
    differentials: [],
    reportedAt: a.updated_at ?? undefined,
  };
}

// Map the reporter's confirmed situation pill to the mission that drives the
// rescue-card layout. A detected wild animal always routes to Wildlife (safety),
// and an explicit Wildlife pick is preserved.
function resolveMission(
  situation: string,
  current: MissionId,
  assessment: Assessment | null,
): MissionId {
  if (current === "wildlife") return "wildlife";
  if (assessment && assessment.is_likely_pet === false && isWildSpecies(assessment)) {
    return "wildlife";
  }
  switch (situation) {
    case "Injured or hit by a car":
    case "Sick or in distress":
      return "injured";
    case "Lost pet":
    case "Found pet":
    case "Abandoned puppies or kittens":
      return "lost-found";
    case "Stray, needs care":
    case "Needs spay or vaccine":
      return "prevention";
    case "At-risk shelter":
      return "at-risk-shelter";
    default:
      return current;
  }
}

function Home() {
  const [stage, setStage] = useState<Stage>("capture");
  const [mission, setMission] = useState<MissionId>("injured");
  const [captured, setCaptured] = useState<string | null>(null);
  const [captureMeta, setCaptureMeta] = useState<PhotoMeta | null>(null);
  const [capturedIsSample, setCapturedIsSample] = useState(false);
  // Batch capture (Phase 1: multi-upload) — extra images wait here and each
  // becomes its own rescue card, processed one after the next.
  const [queue, setQueue] = useState<{ src: string; meta: PhotoMeta | null }[]>([]);
  const [batchTotal, setBatchTotal] = useState(0);
  const [batchIndex, setBatchIndex] = useState(0);
  const [location, setLocation] = useState<{ lat: number; lon: number; label: string } | null>(null);
  const [animalIndex, setAnimalIndex] = useState(0);
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [acsAnimal, setAcsAnimal] = useState<AcsAnimal | null>(null);
  const [reportDetails, setReportDetails] = useState<ReportDetailsData | null>(null);
  const [aiPending, setAiPending] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [showReview, setShowReview] = useState(false);
  // Global overlays reachable from the tab bar / header on any screen.
  const [showJoin, setShowJoin] = useState(false);
  const [showDonate, setShowDonate] = useState(false);

  // Analyze the photo as soon as it's captured — the AI goes first, then the
  // reporter refines details afterward ("what did Voyce miss?").
  const runAnalysis = useCallback(
    async (dataUrl: string, meta: PhotoMeta | null, isSample = false, missionOverride?: MissionId) => {
      setAiPending(true);
      setAiError(null);
      setAssessment(null);
      try {
        // Downscale + compress before anything leaves the device. Full-res phone
        // photos are multi-megabyte and made analysis slow / fail on mobile with
        // "Load failed". Sample images (non data: URLs) pass through untouched.
        // The full-res `captured` is kept for on-screen display; only `small`
        // feeds the hash and the AI request.
        const small = await downscaleDataUrl(dataUrl);
        // Anti-scam Tier 2 (July 5, 2026): real captures carry a perceptual
        // hash (30-day dedup) and time-on-page. Sample photos are exempt —
        // they're the demo flow and repeat by design.
        const photoHash = isSample ? undefined : (await dhashFromDataUrl(small)) ?? undefined;
        const elapsedMs = isSample ? undefined : Date.now() - appLoadedAt;
        const result = await analyzeImage({
          data: { imageDataUrl: small, mission: missionOverride ?? mission, context: {}, photoHash, elapsedMs },
        });
        // Camera-first: on the first read, adopt the situation the AI saw in the
        // photo so the card opens in the right mission. Skipped on an explicit
        // re-read (missionOverride set by a reporter correction).
        if (!missionOverride) {
          setMission(resolveMission(result.suggested_situation ?? "", mission, result));
        }
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
      // Sample photos are bundled assets (not data: URLs) — the demo flow is
      // exempt from the anti-scam hash/timing checks.
      const isSample = !src.startsWith("data:");
      const dataUrl = await toDataUrl(src);
      setCaptured(dataUrl);
      setCaptureMeta(meta ?? null);
      setCapturedIsSample(isSample);
      setStage("processing");
      void runAnalysis(dataUrl, meta ?? null, isSample);
    },
    [runAnalysis],
  );

  // Phase 1 — start a batch: run the first image now, queue the rest.
  const handleBatch = useCallback(
    async (items: { src: string; meta: PhotoMeta | null }[]) => {
      if (items.length === 0) return;
      const [first, ...rest] = items;
      setQueue(rest);
      setBatchTotal(items.length);
      setBatchIndex(1);
      setAnimalIndex(0);
      await handleCaptured(first.src, first.meta);
    },
    [handleCaptured],
  );

  // Advance to the next queued image — it gets its own rescue card.
  const handleNextInBatch = useCallback(async () => {
    if (queue.length === 0) return;
    const [next, ...rest] = queue;
    setQueue(rest);
    setBatchIndex((i) => i + 1);
    setAnimalIndex(0);
    await handleCaptured(next.src, next.meta);
  }, [queue, handleCaptured]);

  // Reporter finished the "Tell us about them" form → show the rescue card so
  // they can review it. The pack-alerting animation now plays AFTER they tap
  // "Send to rescuers" on the card (see the report stage below), so the "we
  // alerted the pack" moment only happens once it's actually true.
  const startReport = useCallback(
    (details: ReportDetailsData) => {
      setReportDetails(details);
      // The reporter confirmed (or corrected) the situation on the details
      // pills. Map it to the matching mission so the rescue card renders in the
      // right layout. If that mission differs from what the photo was analyzed
      // under, re-read the photo with the corrected context so the suggested
      // next-steps fit; otherwise go straight to the card.
      const resolved = resolveMission(details.situation, mission, assessment);
      if (resolved !== mission && captured) {
        setMission(resolved);
        setStage("processing");
        void runAnalysis(captured, captureMeta, capturedIsSample, resolved);
      } else {
        setStage("report");
      }
    },
    [mission, assessment, captured, captureMeta, capturedIsSample, runAnalysis],
  );

  // Card-first: the review pop-up is the single confirm-and-send step. Applying
  // the reporter's confirmed situation sets the mission, then sends instantly to
  // the pack (the "Notifying the pack" animation).
  const handleReviewSend = useCallback(
    (r: ReviewResult) => {
      setReportDetails({
        animalType: r.animalType,
        situation: r.situation,
        witnessed: r.witnessed,
        notes: r.notes,
        email: "",
        phone: "",
      });
      const resolved = resolveMission(r.situation, mission, assessment);
      if (resolved !== mission) setMission(resolved);
      setShowReview(false);
      setStage("alerting");
    },
    [mission, assessment],
  );

  const reset = () => {
    setStage("capture");
    setMission("injured");
    setCaptured(null);
    setCaptureMeta(null);
    setCapturedIsSample(false);
    setLocation(null);
    setAnimalIndex(0);
    setAssessment(null);
    setAcsAnimal(null);
    setReportDetails(null);
    setAiError(null);
    setShowReview(false);
    setQueue([]);
    setBatchTotal(0);
    setBatchIndex(0);
  };

  // Bottom-tab navigation. Report is the camera-first home; At-Risk opens the
  // shelter list; Join opens the signup modal as an overlay WITHOUT navigating
  // away (so closing it returns to whatever tab was showing).
  const handleTab = useCallback((tab: BottomTab) => {
    switch (tab) {
      case "report":
        // Return to the capture intake — clears any half-started shelter/mission
        // context so the camera-first flow is exactly as it is on a fresh load.
        setMission("injured");
        setCaptured(null);
        setAssessment(null);
        setAcsAnimal(null);
        setQueue([]);
        setBatchTotal(0);
        setBatchIndex(0);
        setStage("capture");
        break;
      case "atrisk":
        setMission("at-risk-shelter");
        setStage("shelter");
        break;
      case "join":
        setShowJoin(true);
        break;
    }
  }, []);

  // Back navigation — each step knows the step to return to. Surfaced as a ←
  // arrow in the shared header (via BackNavContext) on screens that don't
  // already have their own back control.
  const backTargets: Partial<Record<Stage, Stage>> = {
    shelter: "mission",
    capture: "mission",
    processing: "capture",
    details: "report",
    alerting: "report",
    report: "capture",
    share: "report",
    timeline: "share",
    gate: "timeline",
    outcome: "gate",
  };
  const goBack = () => {
    const prev = backTargets[stage];
    if (prev) setStage(prev);
    // On the home screen there's nowhere further back — stay put.
  };
  const canGoBack = !!backTargets[stage];
  // Wrap a screen so it shows the header back arrow AND a bottom Back pill.
  const withBack = (el: React.ReactNode) => (
    <BackNavContext.Provider value={goBack}>
      {el}
      {canGoBack && <BackFab onClick={goBack} />}
      {queue.length > 0 ? (
        <NextBatchFab index={batchIndex} total={batchTotal} onClick={() => void handleNextInBatch()} />
      ) : (
        <RestartFab onClick={reset} />
      )}
    </BackNavContext.Provider>
  );

  // Make the phone/browser Back button step back through the app instead of
  // jumping out to the first page: keep a throwaway history entry armed and,
  // when it's popped, re-arm it and do an in-app back.
  const goBackRef = useRef(goBack);
  goBackRef.current = goBack;
  useEffect(() => {
    window.history.pushState(null, "");
    const onPop = () => {
      window.history.pushState(null, "");
      goBackRef.current();
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // Render the current stage. The bottom tab bar lives ONLY on the two home
  // screens (capture intake + shelter list) and is hidden throughout the report
  // flow; on the capture screen it's rendered from inside CaptureScreen so it
  // can also hide while the live camera / photo preview is open.
  const renderStage = () => {
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
        <>
          <ShelterPicker
            onBack={() => setStage("mission")}
            onTakePhoto={() => handleTab("report")}
            onPick={(animal: AcsAnimal) => {
              setMission("at-risk-shelter");
              setCaptured(acsPhoto(animal));
              setAssessment(assessmentFromAcs(animal));
              setAcsAnimal(animal);
              setStage("share");
            }}
          />
          {/* Home screen — tab bar is the primary nav (no BackFab/RestartFab). */}
          <BottomTabBar active="atrisk" onSelect={handleTab} />
        </>
      );
    }

    // At-risk shelter dogs ALWAYS render the single unified AcsShareCard —
    // never the photo-capture ReportDetails / RescueReport assessment screens.
    // Picking a board dog sets captured+assessment (for the card photo), which
    // used to make those "second card" stages reachable via back/forward. This
    // guard closes every path into them automatically — no refresh needed.
    if (
      mission === "at-risk-shelter" &&
      acsAnimal &&
      (stage === "details" ||
        stage === "processing" ||
        stage === "alerting" ||
        stage === "report" ||
        stage === "share")
    ) {
      return withBack(
        <AcsShareCard animal={acsAnimal} onContinue={() => setStage("timeline")} />
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
          onComplete={() => assessment && setStage("alerting")}
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

    if (stage === "alerting") {
      return withBack(<NetworkAlerting onComplete={() => setStage("share")} />);
    }

    if (stage === "report" && assessment && captured) {
      const animalsList = (assessment.animals && assessment.animals.length > 1
        ? assessment.animals
        : [assessment]
      ).map((a) => ({ ...a, caseId: a.caseId ?? assessment.caseId }));
      const idx = Math.min(animalIndex, animalsList.length - 1);
      return withBack(
        <>
          <RescueReport
            image={captured}
            data={animalsList[idx]}
            mission={mission}
            location={location}
            situation={reportDetails?.situation}
            animals={animalsList}
            animalIndex={idx}
            onSelectAnimal={setAnimalIndex}
            onContinue={() => setStage("share")}
            onDone={() => setStage("timeline")}
            onSend={() => setShowReview(true)}
            onEditDetails={() => setShowReview(true)}
          />
          {showReview && (
            <ReviewSheet
              mission={mission}
              assessment={animalsList[idx]}
              onCancel={() => setShowReview(false)}
              onSend={handleReviewSend}
            />
          )}
        </>
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
          location={location}
          onContinue={() => setStage("timeline")}
        />
      );
    }
    if (stage === "timeline") {
      return withBack(<StatusTimeline onContinue={() => setStage("gate")} />);
    }
    if (stage === "gate") {
      return withBack(<DemoGate onDone={() => setStage("outcome")} />);
    }
    if (stage === "outcome") {
      return withBack(<Outcome onRestart={reset} />);
    }

    return (
      <CaptureScreen
        onAnalyze={handleCaptured}
        onBatch={handleBatch}
        mission={mission}
        onBack={() => setStage("mission")}
        renderTabBar={(visible) =>
          visible ? <BottomTabBar active="report" onSelect={handleTab} /> : null
        }
      />
    );
  };

  return (
    <DonateContext.Provider value={() => setShowDonate(true)}>
      {renderStage()}

      {/* Global overlays — reachable from the tab bar (Join) and header (Donate)
          on any screen; they sit on top of the current tab without navigating. */}
      <JoinNetworkModal open={showJoin} onClose={() => setShowJoin(false)} />
      <DonateModal
        open={showDonate}
        onClose={() => setShowDonate(false)}
        onJoin={() => {
          setShowDonate(false);
          setShowJoin(true);
        }}
      />
    </DonateContext.Provider>
  );
}


function BackFab({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Go back"
      className="fixed bottom-4 left-4 z-40 flex items-center gap-1.5 rounded-full border border-border bg-card/95 px-4 py-2 text-[13px] font-semibold text-foreground shadow-lg backdrop-blur transition active:scale-95"
      style={{ marginBottom: "env(safe-area-inset-bottom)" }}
    >
      <span aria-hidden>←</span> Back
    </button>
  );
}

function RestartFab({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Test another animal"
      className="fixed bottom-4 left-[8.5rem] z-40 flex items-center gap-1.5 rounded-full border border-border bg-card/95 px-4 py-2 text-[13px] font-semibold text-[#8A5A0E] shadow-lg backdrop-blur transition active:scale-95"
      style={{ marginBottom: "env(safe-area-inset-bottom)" }}
    >
      <span aria-hidden>🔄</span> Test another
    </button>
  );
}

function NextBatchFab({ index, total, onClick }: { index: number; total: number; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Next photo in batch"
      className="fixed bottom-4 left-[8.5rem] z-40 flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-bold shadow-lg transition active:scale-95"
      style={{ background: "#FFDF3B", color: "#3A2A07" }}
    >
      Next ({Math.min(index + 1, total)} of {total}) →
    </button>
  );
}

function CaptureScreen({
  onAnalyze,
  onBatch,
  mission,
  onBack,
  renderTabBar,
}: {
  onAnalyze: (src: string, meta?: PhotoMeta | null) => void;
  onBatch: (items: { src: string; meta: PhotoMeta | null }[]) => void;
  mission: MissionId;
  onBack: () => void;
  // Parent-supplied bottom tab bar. We only ask it to render on the "chooser"
  // states (intake / samples) — never while the live camera or photo preview
  // is open — so the nav doesn't cover the shutter or the retake/analyze bar.
  renderTabBar: (visible: boolean) => React.ReactNode;
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
  // Phase 2 — "take another": shots captured before analyzing, each becomes its own card.
  const [shots, setShots] = useState<{ src: string; meta: PhotoMeta | null }[]>([]);
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

  // Phase 2: a captured/selected photo now waits on the preview overlay so the
  // reporter can Retake, "+ Add another" (batch), or Analyze — instead of the
  // first shot auto-advancing straight to analysis.

  const startCameraFlow = useCallback(async () => {
    const hasCamera =
      typeof navigator !== "undefined" &&
      !!navigator.mediaDevices &&
      typeof navigator.mediaDevices.getUserMedia === "function";
    if (!hasCamera) {
      // Browser with no camera API at all — fall back to sample picker.
      // (Laptops/iPads with a webcam now go through getUserMedia below.)
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

  // The tab bar shows only on the "chooser" states and never while a preview is
  // open — those are the moments this screen is a genuine home screen.
  const tabBarVisible = (mode === "intake" || mode === "samples") && !preview;

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

              {/* Prominent multi-scan entry — reuses the multi-select photo input
                  so it's impossible to miss that you can do several at once. */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[#C9871A] bg-[#FFF8E1] py-3 text-[13.5px] font-bold text-[#7A4E0B] transition active:scale-[0.99] hover:bg-[#FFF1C4]"
              >
                <span className="text-[18px]" aria-hidden>🐾</span>
                <span>Scan multiple animals at once</span>
              </button>

              {/* Privacy helper — same wording as landing-page modal */}
              <p className="mt-3 text-center text-[11px] leading-relaxed text-foreground/55">
                📱 Camera opens automatically on mobile &amp; tablet · 🔒 Stays on your device until you tap Send · Upload lets you pick several at once
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
                preview of how Voyce will alert the pack when we launch.
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
            <div className="flex flex-col items-center justify-center gap-2 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4">
              {shots.length > 0 && (
                <div className="text-[12px] font-semibold text-muted-foreground">
                  {shots.length + 1} photos ready — each becomes its own card
                </div>
              )}
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={() => setPreview(null)}
                  className="rounded-full border border-border bg-card px-5 py-2.5 text-sm font-medium"
                >
                  Retake
                </button>
                <button
                  onClick={() => {
                    if (!preview) return;
                    setShots((prev) => [...prev, { src: preview, meta: captureMetaRef.current }]);
                    setPreview(null);
                    setMode("intake");
                  }}
                  className="rounded-full border-2 border-[#C9871A] bg-white px-4 py-2.5 text-sm font-semibold text-[#8A5A0E]"
                >
                  + Add another
                </button>
                <button
                  onClick={() => {
                    if (!preview) return;
                    const all = [...shots, { src: preview, meta: captureMetaRef.current }];
                    setShots([]);
                    if (all.length === 1) {
                      onAnalyze(all[0].src, all[0].meta);
                    } else {
                      onBatch(all);
                    }
                  }}
                  className="rounded-full bg-gradient-to-b from-[oklch(0.90_0.16_85)] to-[oklch(0.78_0.15_70)] px-6 py-2.5 text-sm font-semibold text-[oklch(0.25_0.04_60)] shadow-md"
                >
                  {shots.length > 0 ? `Analyze all (${shots.length + 1}) →` : "Analyze →"}
                </button>
              </div>
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

      {/* Persistent bottom nav — only on the intake/samples chooser (not while
          the live camera or the photo preview is open). Rendered by the parent
          so all three tabs share one navigation handler. */}
      {renderTabBar(tabBarVisible)}

      {/* "Upload a Photo" file picker — gallery only, no camera. Accepts several
          files at once; each becomes its own rescue card (batch). */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={async (e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length === 0) return;
          if (files.length === 1) {
            // Single photo — keep the fast capture → analyze path.
            const f = files[0];
            captureMetaRef.current = await readPhotoMeta(f);
            const reader = new FileReader();
            reader.onload = () => setPreview(String(reader.result));
            reader.readAsDataURL(f);
            return;
          }
          // Multiple photos — each becomes its own rescue card (batch).
          const items = await Promise.all(
            files.map(async (f) => {
              const meta = await readPhotoMeta(f);
              const src = await new Promise<string>((resolve) => {
                const r = new FileReader();
                r.onload = () => resolve(String(r.result));
                r.readAsDataURL(f);
              });
              return { src, meta };
            }),
          );
          onBatch(items);
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
