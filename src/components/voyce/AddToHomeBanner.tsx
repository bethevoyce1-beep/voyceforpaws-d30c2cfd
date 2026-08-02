import { useEffect, useState } from "react";

// A slim, dismissible tip shown to first-time MOBILE visitors explaining how to
// add Voyce to their home screen (since it's a PWA, not an App Store app).
// - Only on phones/tablets, never in an already-installed (standalone) session.
// - Handles the IN-APP BROWSER case (Facebook / Messenger / Instagram): those
//   webviews don't offer "Add to Home Screen," so we tell people to open the
//   link in the real browser first — otherwise they tap Share, see no option,
//   and give up. This matters because most links get shared inside Facebook.
// - Remembers dismissal in localStorage so it doesn't nag.
export function AddToHomeBanner() {
  const [show, setShow] = useState(false);
  const [ios, setIos] = useState(false);
  const [inApp, setInApp] = useState(false);

  useEffect(() => {
    try {
      const ua = navigator.userAgent || "";
      const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
      const isIOS = /iPhone|iPad|iPod/i.test(ua);
      // Facebook, Messenger, Instagram, Line, WeChat, Twitter in-app webviews.
      const isInApp =
        /FBAN|FBAV|FB_IAB|FBIOS|Messenger|Instagram|Line\/|MicroMessenger|Twitter/i.test(ua);
      const standalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone === true;
      const dismissed = localStorage.getItem("voyce_a2hs_dismissed") === "1";
      setIos(isIOS);
      setInApp(isInApp);
      if (isMobile && !standalone && !dismissed) {
        const t = setTimeout(() => setShow(true), 1200);
        return () => clearTimeout(t);
      }
    } catch {
      // ignore
    }
  }, []);

  if (!show) return null;

  const dismiss = () => {
    try {
      localStorage.setItem("voyce_a2hs_dismissed", "1");
    } catch {
      // ignore
    }
    setShow(false);
  };

  // In Facebook/Messenger/Instagram the browser can't add apps, so step 1 is to
  // open the page in the real browser; only then does "Add to Home Screen" exist.
  const message = inApp
    ? ios
      ? "Tap the ••• menu (top right) → “Open in Safari,” then Share → “Add to Home Screen.”"
      : "Tap the ⋮ menu (top right) → “Open in Chrome,” then ⋮ → “Add to Home screen.”"
    : ios
      ? "Tap the Share button, then “Add to Home Screen.”"
      : "Open the ⋮ menu, then “Add to Home screen.”";

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-md px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div className="flex items-center gap-3 rounded-2xl border border-[#FFDF3B]/40 bg-[#1A1A1A] px-4 py-3 shadow-2xl">
        <span className="text-xl" aria-hidden>
          📲
        </span>
        <p className="flex-1 text-[12.5px] leading-snug text-white">
          <strong>{inApp ? "Get the Voyce app icon" : "Add Voyce to your home screen"}</strong>
          <br />
          {message}
        </p>
        <button
          onClick={dismiss}
          aria-label="Dismiss"
          className="rounded-full bg-white/10 px-2 py-1 text-sm text-white/70 transition hover:bg-white/20"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
