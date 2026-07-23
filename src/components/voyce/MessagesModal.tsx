/**
 * Messages — the app's inbox. Every alert the supporter has received (dog
 * status changes, shelters they follow, SOS) collects here permanently, each
 * stamped with a real date/time, so nothing is lost when a phone banner
 * disappears. Opened from the "Messages" bottom-tab as a full-screen overlay
 * (same pattern as Join / Donate — it doesn't disturb the screen machine).
 *
 * One-way today; the "Message us" button starts as email and is the natural
 * spot to upgrade to live two-way chat later.
 */
import { useEffect, useState } from "react";
import {
  getNotifications,
  markNotificationsRead,
  getAlertPrefs,
  setAlertPrefs,
  type AcsNotification,
} from "@/lib/notifications.functions";

const GOLD = "#FFDF3B";
const GOLD_DEEP = "#C9871A";
const CONTACT_EMAIL = "info@bethevoyce.org";

const ALERT_OPTIONS: { k: string; label: string }[] = [
  { k: "euthanasia", label: "⚫ In progress" },
  { k: "b6spt", label: "🚨 Immediate" },
  { k: "office_crit", label: "🚨 Office" },
  { k: "outside_crit", label: "🚨 Outside" },
  { k: "immediate", label: "🚨 Today" },
  { k: "scheduled", label: "📅 Date set" },
  { k: "atrisk", label: "🟠 At risk" },
];
const DEFAULT_ALERT_STATUSES = ["euthanasia", "b6spt", "office_crit", "outside_crit", "immediate", "scheduled"];

function fmtWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function MessagesModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [email, setEmail] = useState<string | null>(null);
  const [emailInput, setEmailInput] = useState("");
  const [notes, setNotes] = useState<AcsNotification[]>([]);
  const [prefs, setPrefs] = useState<string[] | null>(null);

  const loadFor = (em: string) => {
    getNotifications({ data: { email: em } }).then((rows) => setNotes(rows ?? [])).catch(() => {});
    getAlertPrefs({ data: { email: em } })
      .then((p) => setPrefs(p.alert_statuses.length ? p.alert_statuses : DEFAULT_ALERT_STATUSES))
      .catch(() => setPrefs(DEFAULT_ALERT_STATUSES));
  };

  useEffect(() => {
    if (!open) return;
    let em: string | null = null;
    try { em = window.localStorage.getItem("voyce_email"); } catch { em = null; }
    setEmail(em);
    if (em) {
      loadFor(em);
      markNotificationsRead({ data: { email: em } }).catch(() => {});
    }
  }, [open]);

  const saveEmail = () => {
    const em = emailInput.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) return;
    try { window.localStorage.setItem("voyce_email", em); } catch { /* noop */ }
    setEmail(em);
    loadFor(em);
  };

  const togglePref = (k: string) => {
    if (!email) return;
    setPrefs((prev) => {
      const cur = prev ?? DEFAULT_ALERT_STATUSES;
      const next = cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k];
      setAlertPrefs({ data: { email, statuses: next } }).catch(() => {});
      return next;
    });
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#FAF8F5]" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      <header
        className="sticky top-0 z-10 flex items-center justify-between border-b border-[#EAE6DE] bg-white/95 px-4 backdrop-blur-md"
        style={{ height: 56, paddingTop: "env(safe-area-inset-top)" }}
      >
        <span className="font-serif text-[18px] font-bold text-[#1A1611]">Messages</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close messages"
          className="flex h-9 w-9 items-center justify-center rounded-full text-[#0B0B0C] transition hover:bg-black/5 active:scale-95"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="mx-auto flex w-full max-w-md flex-col gap-4">
          <div className="rounded-2xl border border-[#EAE6DE] bg-white p-4">
            <div className="text-[14px] font-bold text-[#1A1611]">Need help or have a question?</div>
            <p className="mt-0.5 text-[12px] leading-snug text-[#6b5832]">
              Message the Voyce team and we&apos;ll get back to you. Live chat is coming soon.
            </p>
            <a
              href={`mailto:${CONTACT_EMAIL}?subject=Voyce%20for%20Paws%20—%20message`}
              className="mt-2.5 inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-bold text-[#3A2A07]"
              style={{ background: `linear-gradient(135deg, ${GOLD}, ${GOLD_DEEP})` }}
            >
              💬 Message us
            </a>
          </div>

          {!email && (
            <div className="rounded-2xl border border-[#EAE6DE] bg-white p-4">
              <div className="text-[14px] font-bold text-[#1A1611]">Your alerts</div>
              <p className="mt-0.5 text-[12px] leading-snug text-[#6b5832]">
                Enter your email to see every alert for the dogs and shelters you follow — kept here with the date.
              </p>
              <div className="mt-2 flex gap-1.5">
                <input
                  type="email"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") saveEmail(); }}
                  placeholder="you@email.com"
                  className="min-w-0 flex-1 rounded-lg border border-[#E2DED6] px-2.5 py-2 text-[13px] outline-none focus:border-[#C9871A]"
                />
                <button
                  type="button"
                  onClick={saveEmail}
                  className="flex-none rounded-lg px-3.5 py-2 text-[13px] font-bold text-[#3A2A07]"
                  style={{ background: `linear-gradient(135deg, ${GOLD}, ${GOLD_DEEP})` }}
                >
                  See
                </button>
              </div>
            </div>
          )}

          {email && prefs && (
            <div className="rounded-2xl border border-[#EAE6DE] bg-white p-4">
              <div className="text-[13px] font-bold text-[#1A1611]">🚨 Which alerts ping you?</div>
              <p className="mb-2 mt-0.5 text-[11.5px] leading-snug text-[#6b5832]">Tap to turn each board status on or off.</p>
              <div className="flex flex-wrap gap-1.5">
                {ALERT_OPTIONS.map((o) => {
                  const on = prefs.includes(o.k);
                  return (
                    <button
                      key={o.k}
                      type="button"
                      onClick={() => togglePref(o.k)}
                      aria-pressed={on}
                      className="rounded-full border px-2.5 py-1 text-[11.5px] font-semibold transition active:scale-95"
                      style={on
                        ? { background: "#B4610F", color: "#fff", borderColor: "transparent" }
                        : { background: "#fff", color: "#6B6455", borderColor: "#E2DED6" }}
                    >
                      {o.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {email && (
            <div>
              <div className="mb-1.5 px-1 text-[13px] font-bold text-[#1A1611]">Your alerts</div>
              {notes.length === 0 ? (
                <div className="rounded-2xl border border-[#EAE6DE] bg-white px-4 py-8 text-center text-[13px] text-[#6b5832]">
                  No alerts yet — follow a dog or shelter to get notified. 🔔
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {notes.map((n) => (
                    <a
                      key={n.id}
                      href={n.url ?? undefined}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block rounded-2xl border border-[#EAE6DE] bg-white px-4 py-3 transition hover:bg-[#FAF8F5]"
                    >
                      <div className="font-serif text-[14px] font-semibold text-[#1A1611]">{n.title}</div>
                      {n.body && <div className="mt-0.5 text-[12px] leading-snug text-[#6b5832]">{n.body}</div>}
                      <div className="mt-1 text-[11px] font-medium text-[#9a8f7a]">{fmtWhen(n.created_at)}</div>
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
