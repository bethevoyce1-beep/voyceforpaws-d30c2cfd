/**
 * Voyce for Paws brand header — mark + wordmark + Last Chance bell + AI
 * disclosure / Donate. Appears at the top of every screen for consistent brand
 * identity and an always-visible urgency signal.
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
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { listAcsAnimals, normalizeStatusKey, type AcsAnimal } from "@/lib/acs.functions";
import { getNotifications, markNotificationsRead, type AcsNotification } from "@/lib/notifications.functions";

export const BackNavContext = createContext<(() => void) | null>(null);
export const DonateContext = createContext<(() => void) | null>(null);

// "Last Chance" = being euthanized now or today (the act-now tiers). Matches the
// board's CRITICAL stat: office dogs are folded into At risk, so not counted.
const LAST_CHANCE_KEYS = ["euthanasia", "b6spt", "outside_crit", "immediate"];

// Relative time for the alerts feed, e.g. "2h ago".
function relTime(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const mins = Math.max(0, Math.round((Date.now() - t) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

function NotifyBell() {
  const [animals, setAnimals] = useState<AcsAnimal[]>([]);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [notes, setNotes] = useState<AcsNotification[]>([]);

  useEffect(() => {
    let alive = true;
    const readEmail = (): string | null => {
      try { return typeof window !== "undefined" ? window.localStorage.getItem("voyce_email") : null; }
      catch { return null; }
    };
    setEmail(readEmail());
    const load = () => {
      listAcsAnimals({ data: { shelterId: "san_antonio_acs" } })
        .then((d) => { if (alive) setAnimals(d.animals ?? []); })
        .catch(() => {});
      const em = readEmail();
      if (em) {
        getNotifications({ data: { email: em } })
          .then((rows) => { if (alive) setNotes(rows ?? []); })
          .catch(() => {});
      }
    };
    load();
    const id = window.setInterval(load, 120000);
    return () => { alive = false; window.clearInterval(id); };
  }, []);

  const lastChance = useMemo(
    () => animals.filter((a) => LAST_CHANCE_KEYS.includes(normalizeStatusKey(a.status_key))),
    [animals],
  );
  const unread = useMemo(() => notes.filter((n) => !n.read_at).length, [notes]);
  const badgeCount = email ? unread : lastChance.length;

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && email && unread > 0) {
      markNotificationsRead({ data: { email } }).catch(() => {});
      const now = new Date().toISOString();
      setNotes((prev) => prev.map((n) => (n.read_at ? n : { ...n, read_at: now })));
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-label={`Notifications: ${badgeCount}`}
        aria-expanded={open}
        className="relative flex h-9 w-9 items-center justify-center rounded-full text-[#0B0B0C] transition hover:bg-black/5 active:scale-95"
      >
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {badgeCount > 0 && (
          <span
            className="absolute -right-0.5 -top-0.5 grid min-w-[16px] place-content-center rounded-full px-1 text-[9.5px] font-bold leading-[16px] text-white motion-safe:animate-pulse"
            style={{ background: "#DC2626" }}
            aria-hidden
          >
            {badgeCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden />
          <div className="absolute right-0 top-11 z-50 max-h-[70vh] w-[300px] overflow-y-auto rounded-2xl border border-[#EAE6DE] bg-white p-2 shadow-2xl">
            {email && (
              <>
                <div className="px-2 py-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="font-serif text-[14px] font-bold text-[#1A1611]">Your alerts</span>
                    {unread > 0 && (
                      <span className="ml-auto rounded-full px-1.5 text-[10px] font-bold leading-[16px] text-white" style={{ background: "#DC2626" }}>
                        {unread} new
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                    Updates on dogs you follow.
                  </p>
                </div>
                {notes.length === 0 ? (
                  <div className="px-2 py-3 text-center text-[12px] text-muted-foreground">
                    No alerts yet — follow a dog to get notified. 🔔
                  </div>
                ) : (
                  <div className="space-y-1">
                    {notes.map((n) => (
                      <a
                        key={n.id}
                        href={n.url ?? undefined}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block rounded-xl px-2 py-1.5 transition hover:bg-[#FAF8F5]"
                      >
                        <div className="flex items-baseline gap-1.5">
                          {!n.read_at && (
                            <span className="mt-1 inline-block h-1.5 w-1.5 flex-none rounded-full" style={{ background: "#DC2626" }} aria-hidden />
                          )}
                          <span className="font-serif text-[13px] font-semibold text-[#1A1611]">{n.title}</span>
                          <span className="ml-auto flex-none text-[10px] text-muted-foreground">{relTime(n.created_at)}</span>
                        </div>
                        {n.body && <div className="truncate text-[11px] text-muted-foreground">{n.body}</div>}
                      </a>
                    ))}
                  </div>
                )}
                <div className="my-1.5 border-t border-[#EEEAE1]" />
              </>
            )}

            <div className="px-2 py-1.5">
              <div className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-full motion-safe:animate-pulse" style={{ background: "#DC2626" }} aria-hidden />
                <span className="font-serif text-[14px] font-bold text-[#7F1D1D]">Last Chance</span>
                <span className="ml-auto text-[11px] font-semibold text-muted-foreground">{lastChance.length}</span>
              </div>
              <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                Being euthanized now or today — act immediately.
              </p>
            </div>
            {lastChance.length === 0 ? (
              <div className="px-2 py-3 text-center text-[12px] text-muted-foreground">
                No dogs in Last Chance right now. 💛
              </div>
            ) : (
              <div className="space-y-1">
                {lastChance.map((a) => (
                  <a
                    key={a.id}
                    href={a.pet_search_url ?? undefined}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block rounded-xl px-2 py-1.5 transition hover:bg-[#FAF8F5]"
                  >
                    <div className="flex items-baseline gap-1.5">
                      <span className="font-serif text-[13.5px] font-semibold text-[#1A1611]">{a.name}</span>
                      {a.kennel && (
                        <span className="text-[10px] text-muted-foreground">· {a.kennel}</span>
                      )}
                    </div>
                    <div className="truncate text-[11px] text-muted-foreground">
                      {[a.breed, a.age, a.sex].filter(Boolean).join(" · ")}
                    </div>
                    {a.public_status && (
                      <div className="mt-0.5 text-[10.5px] font-semibold text-[#B4610F]">
                        {a.public_status}
                      </div>
                    )}
                  </a>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

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
      <div className="flex items-center gap-1.5">
        <NotifyBell />
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
      </div>
    </header>
  );
}
