import { useMemo, useRef, useState } from "react";
import type { Assessment } from "@/lib/analyze.functions";

// =============================================================
// SaveCardControls — turns the rescue card into a real, shareable social post.
// It renders a purpose-built "flyer" (a clean rescue poster: photo + status +
// facts + location + story + a HOW YOU CAN HELP call-to-action + Voyce branding),
// shows a scaled live preview, lets the reporter copy a ready-made caption, and
// SAVE it as an image (for Photos / sharing) or PDF (for printing/email). The
// rendering libraries load on demand from a CDN, so the app build is untouched.
// We snapshot the off-screen flyer so the saved file is a poster with none of
// the app's buttons in it.
// =============================================================

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

// The off-screen poster the image/PDF renderer snapshots, and the same markup
// shown (scaled) in the preview. Kept as a function returning JSX so both the
// hidden snapshot node and the visible preview use identical layout.
function FlyerBody({
  image, name, city, v, facts, story, obs,
}: {
  image: string;
  name: string;
  city?: string | null;
  v: FlyerVariant;
  facts: string;
  story: string;
  obs: string[];
  caseId?: string | null;
  reportedAt?: string;
}) {
  return (
    <>
      {/* Brand bar */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px", background: "#0B0B0C", padding: "14px 18px" }}>
        <div style={{ width: "26px", height: "26px", borderRadius: "7px", background: "#141414", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: "15px" }}>🐾</div>
        <div style={{ fontSize: "16px", fontWeight: 900, color: "#fff", letterSpacing: "-0.01em" }}>
          Voyce <span style={{ color: "#FFDF3B", fontStyle: "italic" }}>for</span> Paws
        </div>
      </div>

      {/* Photo + status badge */}
      <div style={{ position: "relative", width: "100%", aspectRatio: "4 / 3", background: "#000", overflow: "hidden" }}>
        <img src={image} alt={name} crossOrigin="anonymous" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
        <span style={{ position: "absolute", left: "14px", top: "14px", display: "inline-flex", alignItems: "center", gap: "6px", padding: "6px 12px", borderRadius: "999px", fontSize: "12px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.12em", color: "#fff", background: v.badgeGradient }}>
          <span>{v.badgeIcon}</span><span>{v.badgeText}</span>
        </span>
      </div>

      {/* Content */}
      <div style={{ padding: "18px 20px 20px" }}>
        <div style={{ fontSize: "22px", fontWeight: 900, lineHeight: 1.15, color: v.titleColor || "#1A1611" }}>{v.title}</div>
        {v.subhead && <div style={{ marginTop: "4px", fontSize: "13.5px", color: "#6B7280", fontWeight: 600 }}>{v.subhead}</div>}
        {facts && <div style={{ marginTop: "12px", fontSize: "13px", fontWeight: 700, color: "#3A2A07" }}>{facts}</div>}
        {city && <div style={{ marginTop: "8px", fontSize: "13px", color: "#1A1611" }}><span style={{ fontWeight: 800 }}>📍 </span>{city}</div>}
        {story && <p style={{ marginTop: "12px", fontSize: "13.5px", lineHeight: 1.5, color: "#374151" }}>{story}</p>}
        {obs.length > 0 && (
          <div style={{ marginTop: "12px", display: "flex", flexWrap: "wrap", gap: "6px" }}>
            {obs.map((o, i) => (
              <span key={i} style={{ fontSize: "11.5px", fontWeight: 700, color: "#3A2A07", background: "#FFF6D6", border: "1px solid #F3E5B6", borderRadius: "999px", padding: "4px 10px" }}>{o}</span>
            ))}
          </div>
        )}

        {/* HOW YOU CAN HELP call-to-action */}
        <div style={{ marginTop: "16px", background: "#FFF6E5", border: "1.5px solid #F0C88A", borderRadius: "12px", padding: "12px 14px" }}>
          <div style={{ fontSize: "11px", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.12em", color: "#8A5A0E" }}>💛 How you can help</div>
          <div style={{ marginTop: "5px", fontSize: "13px", fontWeight: 600, color: "#5A3E12" }}>Foster · Adopt · Rescue · or Share this post</div>
          <div style={{ marginTop: "6px", fontSize: "14px", fontWeight: 900, color: "#0B0B0C" }}>voyceforpaws.org</div>
        </div>

        {/* Footer */}
        <div style={{ marginTop: "14px", borderTop: "1px solid #F0EBDD", paddingTop: "12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: "10.5px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#9CA3AF" }}>AI is advisory — not a diagnosis</div>
          <div style={{ fontSize: "10.5px", fontWeight: 700, color: "#C9871A" }}>🐾 Voyce for Paws</div>
        </div>
      </div>
    </>
  );
}

export function SaveCardControls({ image, data, name, city, v }: Props) {
  const flyerRef = useRef<HTMLDivElement>(null);
  const [saving, setSaving] = useState<null | "img" | "pdf">(null);
  const [note, setNote] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const facts = useMemo(
    () => [data.breed, data.size, data.color, data.age].filter((x) => x && String(x).trim()).join("  ·  "),
    [data],
  );
  const story = useMemo(() => (data.first_look || data.status_reason || "").trim(), [data]);
  const obs = useMemo(() => (Array.isArray(data.observations) ? data.observations.slice(0, 4) : []), [data]);

  // A ready-to-post caption — the words that go with the poster on social.
  const caption = useMemo(() => {
    const where = city ? ` in ${city}` : "";
    const factLine = facts ? `\n${facts}` : "";
    const tags = "#AdoptDontShop #FosterSaves #Rescue #Voyce";
    return `${v.badgeIcon} ${v.badgeText.toUpperCase()} — ${name} needs help${where}.${factLine}\n\n${story}\n\n💛 Foster · Adopt · Rescue · or share this post. Every share widens the circle.\nvoyceforpaws.org\n${tags}`;
  }, [v, name, city, facts, story]);

  const fileBase = useMemo(() => {
    const slug = (name || "animal").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const id = (data.caseId || "card").toLowerCase().replace(/[^a-z0-9]+/g, "-");
    return `voyce-${slug || "animal"}-${id}`;
  }, [name, data.caseId]);

  const renderPng = async (): Promise<string> => {
    const node = flyerRef.current;
    if (!node) throw new Error("Flyer not ready");
    const mod: any = await import(/* @vite-ignore */ "https://esm.sh/html-to-image@1.11.13");
    return await mod.toPng(node, { pixelRatio: 2, cacheBust: true, backgroundColor: "#ffffff", width: 480, height: node.offsetHeight });
  };

  const triggerDownload = (href: string, filename: string) => {
    const a = document.createElement("a");
    a.href = href; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
  };

  const copyCaption = async () => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(caption);
        setCopied(true); setTimeout(() => setCopied(false), 2000);
      }
    } catch { /* noop */ }
  };

  const saveImage = async () => {
    if (saving) return;
    setSaving("img"); setNote(null);
    try {
      const dataUrl = await renderPng();
      try {
        const blob = await (await fetch(dataUrl)).blob();
        const file = new File([blob], `${fileBase}.png`, { type: "image/png" });
        const nav: any = navigator;
        if (nav.canShare && nav.canShare({ files: [file] })) {
          await nav.share({ files: [file], title: name || "Voyce rescue card", text: caption });
          setSaving(null); return;
        }
      } catch { /* fall back to download */ }
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
    setSaving("pdf"); setNote(null);
    try {
      const dataUrl = await renderPng();
      const img = new Image();
      await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(new Error("decode failed")); img.src = dataUrl; });
      const jsPDFmod: any = await import(/* @vite-ignore */ "https://esm.sh/jspdf@2.5.2");
      const JsPDF = jsPDFmod.jsPDF || jsPDFmod.default;
      const PX_TO_MM = 25.4 / 96;
      const wMm = (img.width / 2) * PX_TO_MM;
      const hMm = (img.height / 2) * PX_TO_MM;
      const pdf = new JsPDF({ orientation: hMm >= wMm ? "portrait" : "landscape", unit: "mm", format: [wMm, hMm] });
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
    display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
    padding: "10px 0", borderRadius: "12px", fontSize: "12px", fontWeight: 800,
    cursor: saving ? "default" : "pointer", opacity: saving ? 0.7 : 1, transition: "transform .1s",
  };

  return (
    <div className="mt-3">
      {/* Scaled-down live preview of the exact poster that will be saved/shared.
          `zoom` (not transform) reflows layout so the container sizes to the
          scaled poster with no empty space below it. */}
      <div style={{ width: "100%", overflow: "hidden", borderRadius: "14px", border: "1px solid #EDE5D8" }}>
        <div style={{ zoom: 0.6, width: 480, background: "#fff", fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif", color: "#1A1611" } as React.CSSProperties}>
          <FlyerBody image={image} name={name} city={city} v={v} facts={facts} story={story} obs={obs} />
        </div>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2">
        <button type="button" onClick={() => void copyCaption()} aria-label="Copy the caption"
          style={{ ...btn, background: "#F1EAD6", color: "#5A3E12", border: "1.5px solid #E3DAC4" }}>
          <span>📋</span><span>{copied ? "Copied ✓" : "Caption"}</span>
        </button>
        <button type="button" onClick={() => void saveImage()} disabled={saving !== null} aria-label="Save as image"
          style={{ ...btn, background: "#1A1611", color: "#FFDF3B", border: "1.5px solid #FFDF3B" }}>
          <span>🖼️</span><span>{saving === "img" ? "…" : "Image"}</span>
        </button>
        <button type="button" onClick={() => void savePdf()} disabled={saving !== null} aria-label="Download PDF"
          style={{ ...btn, background: "#FFDF3B", color: "#3A2A07", border: "1.5px solid #C9871A" }}>
          <span>📄</span><span>{saving === "pdf" ? "…" : "PDF"}</span>
        </button>
      </div>
      {note && <p className="mt-2 text-center text-[11px] font-semibold text-[#6B5832]" role="status">{note}</p>}

      {/* Off-screen flyer that the image/PDF renderer snapshots */}
      <div ref={flyerRef} aria-hidden="true"
        style={{ position: "fixed", left: "-100000px", top: 0, width: "480px", background: "#ffffff", fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif", color: "#1A1611" }}>
        <FlyerBody image={image} name={name} city={city} v={v} facts={facts} story={story} obs={obs} />
      </div>
    </div>
  );
}
