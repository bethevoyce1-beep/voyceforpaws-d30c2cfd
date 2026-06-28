/**
 * Voyce for Paws brand header — mark + wordmark + AI disclosure.
 * Appears at the top of every screen for consistent brand identity.
 */
export function BrandHeader() {
  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-[#EAE6DE] bg-white/95 px-4 py-3 backdrop-blur-md">
      <div className="flex items-center gap-2.5">
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
      <div className="text-[11px] font-medium text-muted-foreground">
        AI advisory · not a diagnosis
      </div>
    </header>
  );
}
