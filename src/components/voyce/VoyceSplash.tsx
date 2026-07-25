import { useEffect, useState } from "react";

// =============================================================
// VoyceSplash — the animated intro "splash logo" from the landing page, played
// once per session when the app opens: a gold circle draws around the white paw
// on a dark radiant field, with the wordmark + "Every minute matters." Tap to
// skip; it also auto-dismisses. Never shown on a shared card (/r/...) so a link
// recipient sees the animal immediately.
// =============================================================

export function VoyceSplash() {
  const [show, setShow] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Don't interrupt a shared-card recipient.
    if (window.location.pathname.startsWith("/r/")) return;
    let seen = false;
    try { seen = window.sessionStorage.getItem("voyce_splash_seen") === "1"; } catch { /* ignore */ }
    if (seen) return;
    try { window.sessionStorage.setItem("voyce_splash_seen", "1"); } catch { /* ignore */ }
    setShow(true);
    const t1 = window.setTimeout(() => setLeaving(true), 2050);
    const t2 = window.setTimeout(() => setShow(false), 2650);
    return () => { window.clearTimeout(t1); window.clearTimeout(t2); };
  }, []);

  if (!show) return null;

  return (
    <div
      role="presentation"
      onClick={() => setShow(false)}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        display: "grid",
        placeItems: "center",
        background: "radial-gradient(circle at 50% 42%, #24272d 0%, #0B0B0C 70%)",
        opacity: leaving ? 0 : 1,
        transition: "opacity .55s ease",
      }}
    >
      <style>{`
        @keyframes vfpDraw { to { stroke-dashoffset: 0; } }
        @keyframes vfpPaw { 0% { opacity: 0; transform: scale(.62); } 100% { opacity: 1; transform: scale(1); } }
        @keyframes vfpDot { 0%,100% { transform: scale(1); opacity: .9; } 50% { transform: scale(1.25); opacity: 1; } }
        @keyframes vfpRise { 0% { opacity: 0; transform: translateY(8px); } 100% { opacity: 1; transform: translateY(0); } }
      `}</style>

      <div style={{ textAlign: "center", padding: "0 24px" }}>
        <div style={{ position: "relative", width: 200, height: 200, margin: "0 auto 26px" }}>
          <svg width="200" height="200" viewBox="0 0 220 220" style={{ position: "absolute", inset: 0 }}>
            <circle
              cx="110" cy="110" r="95" fill="none" stroke="#FFD24A" strokeWidth="3" strokeLinecap="round"
              strokeDasharray="596.9" strokeDashoffset="596.9" transform="rotate(-39 110 110)"
              style={{ animation: "vfpDraw 1.4s ease forwards .15s" }}
            />
          </svg>
          <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", animation: "vfpPaw .85s ease forwards" }}>
            <svg viewBox="0 0 100 100" width="94" height="94" fill="#fff">
              <path d="M50,91 C33,91 24,80 24,68 C24,56 33,49 50,49 C67,49 76,56 76,68 C76,80 67,91 50,91 Z" />
              <ellipse cx="21" cy="40" rx="9.5" ry="13" />
              <ellipse cx="39" cy="27" rx="9.5" ry="13" />
              <ellipse cx="57" cy="27" rx="9.5" ry="13" />
              <ellipse cx="73" cy="40" rx="9.5" ry="13" />
            </svg>
          </div>
          <span style={{ position: "absolute", top: 26, right: 44, width: 14, height: 14, borderRadius: "50%", background: "#FFDE2E", boxShadow: "0 0 12px rgba(255,216,77,.9)", animation: "vfpDot 1.6s ease-in-out infinite" }} />
        </div>

        <div style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 30, fontWeight: 800, color: "#fff", letterSpacing: "-0.01em", animation: "vfpRise .6s ease forwards .5s", opacity: 0 }}>
          Voyce <em style={{ color: "#FFD24A", fontStyle: "italic" }}>for</em> Paws
        </div>
        <div style={{ marginTop: 8, fontSize: 11.5, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(255,255,255,.6)", animation: "vfpRise .6s ease forwards .68s", opacity: 0 }}>
          An Animal Rescue Community Network
        </div>
        <div style={{ marginTop: 12, fontSize: 13.5, fontWeight: 600, color: "#FFD24A", animation: "vfpRise .6s ease forwards .86s", opacity: 0 }}>
          Every minute matters.
        </div>
      </div>
    </div>
  );
}
