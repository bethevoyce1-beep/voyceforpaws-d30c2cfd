import { useMemo, useRef, useState } from "react";
import type { Assessment } from "@/lib/analyze.functions";

// =============================================================
// SaveCardControls — lets a reporter SAVE the rescue card they just made,
// either as an image (great for phones — saves to Photos / shares) or as a
// PDF (great for printing or emailing). The rendering libraries are pulled in
// on demand from a CDN the first time someone taps Save, so the app's build
// and dependencies stay completely untouched.
//
// We snapshot a purpose-built, off-screen "flyer" (not the live on-screen card)
// so the saved file is a clean, self-contained poster: photo + status + the key
// facts + Voyce branding — with none of the app's buttons or editors in it.
// =============================================================

// Only the variant fields the flyer actually needs — kept structural so the
// caller can pass its existing `variant` object straight through.
type FlyerVariant = {
  badgeIcon: string;
  badgeText: string;
  badgeGradient: string;
  title: string;
  titleColor: string;
  subhead: string;
};

type Props = {
  image: string;
  data: Assessment;
  name: string;
  city?: string | null;
  v: FlyerVariant;
};

function fmtDate(iso?: string): string {
  if (!iso) return new Date().toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return iso;
  }
}

export function SaveCardControls({ image, data, name, city, v }: Props) {
  const flyerRef = useRef<HTMLDivElement>(null);
  const [saving, setSaving] = useState<null | "img" | "pdf">(null);
  const [note, setNote] = useState<string | null>(null);

  const facts = useMemo(
    () => [data.breed, data.size, data.color, data.age].filter((x) => x && String(x).trim()).join("  ·  "),
    [data],
  );
  const story = useMemo(
    () => (data.first_look || data.status_reason || "").trim(),
    [data],
  );
  const obs = useMemo(
    () => (Array.isArray(data.observations) ? data.observations.slice(0, 4) : []),
    [data],
  );

  const fileBase = useMemo(() => {
    const slug = (name || "animal").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const id = (data.caseId || "card").toLowerCase().replace(/[^a-z0-9]+/g, "-");
    return `voyce-${slug || "animal"}-${id}`;
  }, [name, data.caseId]);

  // Render the off-screen flyer to a PNG data URL. Loads html-to-image on demand.
  const renderPng = async (): Promise<string> => {
    const node = flyerRef.current;
    if (!node) throw new Error("Flyer not ready");
    const mod: any = await import(/* @vite-ignore */ "https://esm.sh/html-to-image@1.11.13");
    return await mod.toPng(node, {
      pixelRatio: 2,
      cacheBust: true,
      backgroundColor: "#ffffff",
      width: 480,
      height: node.offsetHeight,
    });
  };

  const triggerDownload = (href: string, filename: string) => {
    const a = document.createElement("a");
    a.href = href;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const saveImage = async () => {
    if (saving) return;
    setSaving("img");
    setNote(null);
    try {
      const dataUrl = await renderPng();
      // On phones, offer the native share sheet with the image file attached —
      // that's what lets people save straight to Photos or send it on.
      try {
        const blob = await (await fetch(dataUrl)).blob();
        const file = new File([blob], `${fileBase}.png`, { type: "image/png" });
        const nav: any = navigator;
        if (nav.canShare && nav.canShare({ files: [file] })) {
          await nav.share({ files: [file], title: name || "Voyce rescue card" });
          setSaving(null);
          return;
        }
      } catch {
        // share unavailable or dismissed — fall back to a direct download
      }
      triggerDownload(dataUrl, `${fileBase}.png`);
      setNote("Saved as an image ✓");
    } catch (e) {
      console.warn("[voyce] save image failed:", e);
      setNote("Couldn't save the image just now — please try again.");
    } finally {
      setSaving(null);
    }
  };

  const savePdf = async () => {
    if (saving) return;
    setSaving("pdf");
    setNote(null);
    try {
      const dataUrl = await renderPng();
      const img = new Image();
      await new Promise<void>((res, rej) => {
        img.onload = () => res();
        img.onerror = () => rej(new Error("image decode failed"));
        img.src = dataUrl;
      });
      const jsPDFmod: any = await import(/* @vite-ignore */ "https://esm.sh/jspdf@2.5.2");
      const JsPDF = jsPDFmod.jsPDF || jsPDFmod.default;
      // Convert the rendered pixels (at 2x) to millimetres for a nicely sized page.
      const PX_TO_MM = 25.4 / 96;
      const wMm = (img.width / 2) * PX_TO_MM;
      const hMm = (img.height / 2) * PX_TO_MM;
      const pdf = new JsPDF({
        orientation: hMm >= wMm ? "portrait" : "landscape",
        unit: "mm",
        format: [wMm, hMm],
      });
      pdf.addImage(dataUrl, "PNG", 0, 0, wMm, hMm);
      pdf.save(`${fileBase}.pdf`);
      setNote("PDF downloaded ✓");
    } catch (e) {
      console.warn("[voyce] save pdf failed:", e);
      setNote("Couldn't make the PDF just now — please try again.");
    } finally {
      setSaving(null);
    }
  };

  const btn: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    padding: "10px 0",
    borderRadius: "12px",
    fontSize: "12px",
    fontWeight: 800,
    cursor: saving ? "default" : "pointer",
    opacity: saving ? 0.7 : 1,
    transition: "transform .1s",
  };

  return (
    <div className="mt-4">
      <p className="text-center text-[12px] font-bold uppercase tracking-[0.14em] text-[#9CA3AF]">
        Save {name}&rsquo;s card
      </p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => void saveImage()}
          disabled={saving !== null}
          aria-label="Save card as an image"
          style={{ ...btn, background: "#1A1611", color: "#FFDF3B", border: "1.5px solid #FFDF3B" }}
        >
          <span>🖼️</span>
          <span>{saving === "img" ? "Saving…" : "Save image"}</span>
        </button>
        <button
          type="button"
          onClick={() => void savePdf()}
          disabled={saving !== null}
          aria-label="Download card as a PDF"
          style={{ ...btn, background: "#FFDF3B", color: "#3A2A07", border: "1.5px solid #C9871A" }}
        >
          <span>📄</span>
          <span>{saving === "pdf" ? "Preparing…" : "Download PDF"}</span>
        </button>
      </div>
      {note && (
        <p className="mt-2 text-center text-[11px] font-semibold text-[#6B5832]" role="status">
          {note}
        </p>
      )}

      {/* ============ OFF-SCREEN FLYER (the thing we snapshot) ============ */}
      {/* Positioned far off-screen with a fixed 480px width so it renders at a
          consistent size without affecting the visible layout. Inline styles
          keep it self-contained for the image/PDF renderer. */}
      <div
        ref={flyerRef}
        aria-hidden="true"
        style={{
          position: "fixed",
          left: "-100000px",
          top: 0,
          width: "480px",
          background: "#ffffff",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
          color: "#1A1611",
        }}
      >
        {/* Brand bar */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", background: "#0B0B0C", padding: "14px 18px" }}>
          <div
            style={{
              width: "26px",
              height: "26px",
              borderRadius: "7px",
              background: "#141414",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              fontSize: "15px",
            }}
          >
            🐾
          </div>
          <div style={{ fontSize: "16px", fontWeight: 900, color: "#fff", letterSpacing: "-0.01em" }}>
            Voyce <span style={{ color: "#FFDF3B", fontStyle: "italic" }}>for</span> Paws
          </div>
        </div>

        {/* Photo with status badge */}
        <div style={{ position: "relative", width: "100%", aspectRatio: "4 / 3", background: "#000", overflow: "hidden" }}>
          <img
            src={image}
            alt={name}
            crossOrigin="anonymous"
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
          />
          <span
            style={{
              position: "absolute",
              left: "14px",
              top: "14px",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "6px 12px",
              borderRadius: "999px",
              fontSize: "12px",
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              color: "#fff",
              background: v.badgeGradient,
            }}
          >
            <span>{v.badgeIcon}</span>
            <span>{v.badgeText}</span>
          </span>
        </div>

        {/* Content */}
        <div style={{ padding: "18px 20px 20px" }}>
          <div style={{ fontSize: "22px", fontWeight: 900, lineHeight: 1.15, color: v.titleColor || "#1A1611" }}>
            {v.title}
          </div>
          {v.subhead && (
            <div style={{ marginTop: "4px", fontSize: "13.5px", color: "#6B7280", fontWeight: 600 }}>{v.subhead}</div>
          )}

          {facts && (
            <div style={{ marginTop: "12px", fontSize: "13px", fontWeight: 700, color: "#3A2A07" }}>{facts}</div>
          )}

          {city && (
            <div style={{ marginTop: "8px", fontSize: "13px", color: "#1A1611" }}>
              <span style={{ fontWeight: 800 }}>📍 </span>
              {city}
            </div>
          )}

          {story && (
            <p style={{ marginTop: "12px", fontSize: "13.5px", lineHeight: 1.5, color: "#374151" }}>{story}</p>
          )}

          {obs.length > 0 && (
            <div style={{ marginTop: "12px", display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {obs.map((o, i) => (
                <span
                  key={i}
                  style={{
                    fontSize: "11.5px",
                    fontWeight: 700,
                    color: "#3A2A07",
                    background: "#FFF6D6",
                    border: "1px solid #F3E5B6",
                    borderRadius: "999px",
                    padding: "4px 10px",
                  }}
                >
                  {o}
                </span>
              ))}
            </div>
          )}

          {/* Footer */}
          <div style={{ marginTop: "16px", borderTop: "1px solid #F0EBDD", paddingTop: "12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: "10.5px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#9CA3AF" }}>
              AI is advisory — not a diagnosis
            </div>
            <div style={{ fontSize: "10.5px", fontWeight: 700, color: "#C9871A" }}>voyceforpaws.org</div>
          </div>
          <div style={{ marginTop: "6px", fontSize: "10.5px", color: "#9CA3AF" }}>
            {data.caseId ? `${data.caseId} · ` : ""}
            {fmtDate(data.reportedAt)}
          </div>
        </div>
      </div>
    </div>
  );
}
