/**
 * Persistent bottom tab bar — the primary navigation on the app's two "home"
 * screens (the Report capture intake and the At-Risk shelter list).
 *
 * Five tabs, left→right: 📷 Report · 🏠 At-Risk · 🖼 Saved · 💬 Messages · 🐾 Join.
 *   - Report   → returns to the capture intake (camera-first flow, unchanged).
 *   - At-Risk  → opens the ShelterPicker (at-risk shelter list).
 *   - Saved    → navigates to /saved (the Saved cards gallery of every card taken).
 *   - Messages → opens the Messages inbox overlay, managed HERE (does NOT call
 *                onSelect / navigate) so it works without any change to the
 *                parent screen machine. Shows an unread badge (red dot + count)
 *                sourced from the same notifications feed the inbox reads.
 *   - Join     → calls onSelect("join"); the parent opens the JoinNetworkModal.
 *
 * The bar is rendered on the home screens (see index.tsx for visibility rules —
 * hidden during any active report flow and while the live camera / photo
 * preview is open) AND on the Saved gallery route, so there's always a way out.
 * Safe-area aware via env(safe-area-inset-bottom).
 */
import { useEffect, useState } from "react";
import { MessagesModal } from "@/components/voyce/MessagesModal";
import { getNotifications } from "@/lib/notifications.functions";

// Brand palette (matches the rest of the app).
const GOLD = "#FFDF3B";
const GOLD_DEEP = "#C9871A";
const INK = "#1A1611";

export type BottomTab = "report" | "atrisk" | "saved" | "messages" | "join";

type TabDef = {
  id: BottomTab;
  icon: string;
  label: string;
};

const TABS: TabDef[] = [
  { id: "report", icon: "📷", label: "Report" },
  { id: "atrisk", icon: "🏠", label: "At-Risk" },
  { id: "saved", icon: "🖼", label: "Saved" },
  { id: "messages", icon: "💬", label: "Messages" },
  { id: "join", icon: "🐾", label: "Join" },
];

export function BottomTabBar({
  active,
  onSelect,
}: {
  /** Which tab is currently showing. `messages` / `join` never stay active. */
  active: BottomTab;
  onSelect: (tab: BottomTab) => void;
}) {
  // Messages is a self-contained overlay owned by the tab bar, so it works on
  // every screen that renders the bar without threading state through index.tsx.
  const [showMessages, setShowMessages] = useState(false);
  const [unread, setUnread] = useState(0);

  // Unread count for the Messages badge — the same feed the inbox shows. Opening
  // the inbox marks everything read, so we refresh when it closes to clear it.
  const refreshUnread = () => {
    let em: string | null = null;
    try { em = window.localStorage.getItem("voyce_email"); } catch { em = null; }
    if (!em) { setUnread(0); return; }
    getNotifications({ data: { email: em } })
      .then((rows) => setUnread((rows ?? []).filter((n) => !n.read_at).length))
      .catch(() => {});
  };

  useEffect(() => {
    refreshUnread();
    const id = window.setInterval(refreshUnread, 120000);
    return () => window.clearInterval(id);
  }, []);

  const handleClick = (id: BottomTab) => {
    if (id === "messages") {
      setShowMessages(true);
      return;
    }
    if (id === "saved") {
      // The Saved gallery is its own route — hard-navigate so it works from
      // either home screen without threading routing through index.tsx.
      if (typeof window !== "undefined") window.location.assign("/saved");
      return;
    }
    onSelect(id);
  };

  const closeMessages = () => {
    setShowMessages(false);
    // The inbox marked alerts read on open — clear the badge to match.
    window.setTimeout(refreshUnread, 300);
  };

  return (
    <>
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-[#EAE6DE] bg-white/95 backdrop-blur-md"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="mx-auto flex max-w-md items-stretch justify-around px-2">
          {TABS.map((t) => {
            const isActive = t.id === active;
            const badge = t.id === "messages" && unread > 0;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => handleClick(t.id)}
                aria-current={isActive ? "page" : undefined}
                aria-label={badge ? `${t.label}, ${unread} unread` : undefined}
                className="group relative flex flex-1 flex-col items-center justify-center gap-0.5 py-2.5 transition active:scale-95"
                style={{ color: isActive ? GOLD_DEEP : INK }}
              >
                {isActive && (
                  <span
                    aria-hidden
                    className="absolute inset-x-3 top-0 h-[3px] rounded-full"
                    style={{ background: GOLD }}
                  />
                )}
                <span className="relative text-[20px] leading-none" aria-hidden>
                  {t.icon}
                  {badge && (
                    <span
                      className="absolute -right-2.5 -top-1.5 grid min-w-[16px] place-content-center rounded-full px-1 text-[9.5px] font-bold leading-[16px] text-white motion-safe:animate-pulse"
                      style={{ background: "#DC2626" }}
                    >
                      {unread > 9 ? "9+" : unread}
                    </span>
                  )}
                </span>
                <span
                  className="text-[11px] leading-none"
                  style={{ fontWeight: isActive ? 700 : 500, opacity: isActive ? 1 : 0.72 }}
                >
                  {t.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
      <MessagesModal open={showMessages} onClose={closeMessages} />
    </>
  );
}
