import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import pawLogo from "@/assets/voyce-paw.png";
import sampleDogEye from "@/assets/sample-dog-eye.jpg";
import sampleCatEar from "@/assets/sample-cat-ear.jpg";
import samplePaw from "@/assets/sample-paw.jpg";
import sampleCatNose from "@/assets/sample-cat-nose.jpg";
import sampleDogSkin from "@/assets/sample-dog-skin.jpg";
import sampleBird from "@/assets/sample-bird.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Voyce — Test with an animal" },
      {
        name: "description",
        content:
          "Snap or upload a photo of an animal. Voyce gives advisory AI insight — not a diagnosis.",
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

function isLikelyMobile() {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

function Home() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [mode, setMode] = useState<"loading" | "camera" | "samples" | "permission">("loading");
  const [error, setError] = useState<string | null>(null);
  const [captured, setCaptured] = useState<string | null>(null);

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
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
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
    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    setCaptured(dataUrl);
    // Downstream pipeline (Processing Pipeline / Result Screen) takes over from here.
    console.info("[voyce] captured image, bytes:", dataUrl.length);
  };

  const pickSample = (src: string) => {
    setCaptured(src);
    console.info("[voyce] selected sample:", src);
  };

  return (
    <div className="relative flex min-h-[100dvh] flex-col bg-background text-foreground">
      {/* Top bar */}
      <header className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-4 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="flex items-center gap-2 rounded-full bg-background/85 px-3 py-1.5 backdrop-blur-md shadow-sm">
          <img src={pawLogo} alt="Voyce" width={20} height={20} className="h-5 w-5" />
          <span className="text-sm font-semibold tracking-tight">Voyce</span>
        </div>
        <div className="rounded-full bg-background/85 px-3 py-1.5 text-[11px] font-medium text-muted-foreground backdrop-blur-md shadow-sm">
          AI is advisory · not a diagnosis
        </div>
      </header>

      {/* Main viewport */}
      <main className="relative flex flex-1 flex-col">
        {mode === "loading" && <LoadingState />}

        {mode === "camera" && (
          <div className="relative flex-1 bg-black">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="absolute inset-0 h-full w-full object-cover"
            />
            {/* Soft viewfinder frame */}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="aspect-square w-[78%] max-w-md rounded-3xl border-2 border-[oklch(0.88_0.16_85)]/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.25)]" />
            </div>
            {/* Shutter */}
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
          <PermissionState
            onRetry={() => window.location.reload()}
            onFallback={() => setMode("samples")}
          />
        )}

        {mode === "samples" && (
          <SamplePicker samples={SAMPLES} onPick={pickSample} error={error} />
        )}

        {captured && (
          <CapturedPreview src={captured} onRetake={() => setCaptured(null)} />
        )}
      </main>

      {/* Bottom CTA */}
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
          <button
            type="button"
            onClick={() => setMode("samples")}
            className="rounded-full bg-[oklch(0.88_0.16_85)] px-5 py-2.5 text-sm font-semibold text-[oklch(0.25_0.04_60)] shadow-md hover:brightness-105 active:scale-[0.98] transition"
          >
            🎲 Try with a sample
          </button>
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
          reader.onload = () => setCaptured(String(reader.result));
          reader.readAsDataURL(f);
        }}
      />
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-[oklch(0.88_0.16_85)] border-t-transparent" />
    </div>
  );
}

function PermissionState({ onRetry, onFallback }: { onRetry: () => void; onFallback: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
      <div className="max-w-sm">
        <h1 className="text-xl font-semibold tracking-tight">Camera access blocked</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Enable camera in your browser settings, or try a sample photo instead.
        </p>
        <div className="mt-5 flex flex-col gap-2">
          <button
            onClick={onRetry}
            className="rounded-full bg-[oklch(0.88_0.16_85)] px-5 py-2.5 text-sm font-semibold text-[oklch(0.25_0.04_60)] shadow-sm"
          >
            Try again
          </button>
          <button
            onClick={onFallback}
            className="rounded-full border border-border bg-card px-5 py-2.5 text-sm font-medium"
          >
            Use a sample photo
          </button>
        </div>
      </div>
    </div>
  );
}

function SamplePicker({
  samples,
  onPick,
  error,
}: {
  samples: typeof SAMPLES;
  onPick: (src: string) => void;
  error: string | null;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-5 pt-24 pb-32">
      <div className="w-full max-w-2xl">
        <h1 className="text-center text-2xl font-semibold tracking-tight">
          Pick a starter photo
        </h1>
        <p className="mt-1 text-center text-sm text-muted-foreground">
          Tap any image to run a sample through Voyce.
        </p>
        {error && (
          <p className="mt-3 text-center text-xs text-muted-foreground">{error}</p>
        )}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {samples.map((s) => (
            <button
              key={s.label}
              onClick={() => onPick(s.src)}
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
  );
}

function CapturedPreview({ src, onRetake }: { src: string; onRetake: () => void }) {
  return (
    <div className="absolute inset-0 z-30 flex flex-col bg-background">
      <div className="relative flex-1">
        <img src={src} alt="Captured" className="absolute inset-0 h-full w-full object-contain" />
      </div>
      <div className="flex items-center justify-center gap-3 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4">
        <button
          onClick={onRetake}
          className="rounded-full border border-border bg-card px-5 py-2.5 text-sm font-medium"
        >
          Retake
        </button>
        <button
          onClick={() => console.info("[voyce] continue to processing pipeline")}
          className="rounded-full bg-[oklch(0.88_0.16_85)] px-6 py-2.5 text-sm font-semibold text-[oklch(0.25_0.04_60)] shadow-md"
        >
          Analyze →
        </button>
      </div>
    </div>
  );
}
