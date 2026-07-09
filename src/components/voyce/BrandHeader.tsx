/**
 * Voyce for Paws brand header — mark + wordmark + AI disclosure + Donate.
 * Appears at the top of every screen for consistent brand identity.
 *
 * A screen can surface a back button by wrapping itself in
 * <BackNavContext.Provider value={goBack}> — the header then shows a ← arrow.
 *
 * Likewise, wrapping in <DonateContext.Provider value={openDonate}> surfaces a
 * gold "Donate" pill top-right. When no handler is provided the header falls
 * back to the "AI is advisory" disclosure line. This keeps the Donate action
 * available on every screen that renders its own BrandHeader (mission picker,
 * shelter picker, capture) without threading a prop through each one.
 */
import { createContext, useContext } from "react";

export const BackNavContext = createContext<(() => void) | null>(null);
export const DonateContext = createContext<(() => void) | null>(null);

export function BrandHeader() {
  const onBack = useContext(BackNavContext);
  const onDonate = useContext(DonateContext);
  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-[#EAE6DE] bg-white/95 px-4 py-3 backdrop-blur-md">
      <div className="flex items-center gap-2.5">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label="Go back"
            className="-ml-1 mr-0.5 flex h-8 w-8 items-center justify-center rounded-full text-[#0B0B0C] transition hover:bg-black/5 active:scale-95"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
        )}
        <span className="voyce-brand-mark" aria-hidden>
          <svg width="17" height="17" viewBox="0 0 100 100" fill="currentColor">
            <path d="M50,91 C33,91 24,80 24,68 C24,56 33,49 50,49 C67,49 76,56 76,68 C76,80 67,91 50,91 Z" />
            <ellipse cx="21" cy="40" rx="9.5" ry="13" />
            <ellipse cx="39" cy="27" rx="9.5" ry="13" />
            <ellipse cx="57" cy="27" rx="9.5" ry="13" />
            <ellipse cx="73" cy="40" rx="9.5" ry="13" />
          </svg>
        </span>
        <span className="voyce-wordmark font-serif" style={{ fontSize: 17, fontWeight: 700, color: "#0B0B0C", letterSpacing: "-0.01em" }}>
          Voyce <em>for</em> Paws
        </span>
      </div>
      {onDonate ? (
        <button
          type="button"
          onClick={onDonate}
          className="flex items-center gap-1 rounded-full px-3.5 py-1.5 text-[12.5px] font-bold text-[#3A2A07] shadow-sm transition hover:brightness-105 active:scale-95"
          style={{ background: "linear-gradient(135deg, #FFDF3B 0%, #C9871A 100%)" }}
        >
          <span aria-hidden>💛</span>
          <span>Donate</span>
        </button>
      ) : (
        <div className="text-[11px] font-medium text-muted-foreground">
          AI is advisory — not a diagnosis
        </div>
      )}
    </header>
  );
}
