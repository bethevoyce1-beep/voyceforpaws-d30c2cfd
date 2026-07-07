import { useState } from "react";

/**
 * Persistent top banner shown on every screen that displays AI output.
 * Dismissible per-mount; reappears on each new AI output (because each
 * AI-output screen mounts its own instance).
 */
export function AIDisclosureBanner() {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;
  return (
    <div
      role="note"
      aria-label="AI disclosure"
      className="sticky top-0 z-30 w-full border-b border-[#E8DCC2] bg-[#FAF8F5]"
    >
      <div className="mx-auto flex max-w-2xl items-start gap-2 px-4 py-2 text-[12px] leading-snug text-[#5a4a2a]">
        <span aria-hidden className="select-none">⚠️</span>
        <span className="flex-1">
          <span className="font-semibold">AI is advisory — not a diagnosis.</span>{" "}
          May misidentify breed, age, or condition.
        </span>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss AI disclosure"
          className="-mr-1 -mt-0.5 rounded-full px-2 py-0.5 text-[14px] leading-none text-[#8A5A0E]/70 transition hover:bg-[#F1E7CE] hover:text-[#8A5A0E]"
        >
          ×
        </button>
      </div>
    </div>
  );
}
