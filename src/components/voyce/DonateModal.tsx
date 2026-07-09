/**
 * Donate modal — surfaced from the Donate button in the brand header.
 *
 * Voyce is pre-launch, so we keep this honest: there's no payment link yet.
 * Instead we invite the reader to join the Voyce Pack so they hear the moment
 * donations open. Tapping "Join the Pack" hands off to the JoinNetworkModal
 * (via onJoin); "Not yet" / ✕ closes.
 */

const GOLD = "#FFDF3B";

export function DonateModal({
  open,
  onClose,
  onJoin,
}: {
  open: boolean;
  onClose: () => void;
  /** Open the JoinNetworkModal instead. */
  onJoin: () => void;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 z-10 rounded-full bg-black/5 px-2.5 py-1 text-sm text-foreground/70 hover:bg-black/10"
        >
          ✕
        </button>

        <div className="px-6 pb-6 pt-9 text-center">
          <div className="text-4xl" aria-hidden>
            💛
          </div>
          <h2 className="mt-3 font-serif text-[22px] font-bold leading-tight tracking-tight text-[#0B0B0C]">
            Donations open when we launch
          </h2>
          <p className="mx-auto mt-2 max-w-sm text-[13.5px] leading-relaxed text-foreground/75">
            We're not live yet. Join the Voyce Pack and you'll be first to know
            the moment donations open — and every rescue we power along the way.
          </p>

          <div className="mt-6 flex flex-col gap-2.5">
            <button
              type="button"
              onClick={onJoin}
              className="w-full rounded-2xl px-5 py-3 text-[14px] font-bold text-[#3A2A07] shadow transition hover:brightness-105 active:scale-[0.99]"
              style={{ background: `linear-gradient(135deg, ${GOLD} 0%, #C9871A 100%)` }}
            >
              🐾 Join the Pack
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-2xl border border-border bg-white px-5 py-2.5 text-[13.5px] font-medium text-foreground transition hover:bg-[#FAF8F5]"
            >
              Not yet
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
