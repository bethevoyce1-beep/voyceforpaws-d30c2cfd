/**
 * Persistent bottom tab bar — the primary navigation on the app's two "home"
 * screens (the Report capture intake and the At-Risk shelter list).
 *
 * Four tabs, left→right: 📷 Report · 🏠 At-Risk · 💬 Messages · 🐾 Join the Pack.
 *   - Report   → returns to the capture intake (camera-first flow, unchanged).
 *   - At-Risk  → opens the ShelterPicker (at-risk shelter list).
 *   - Messages → opens the Messages inbox overlay, managed HERE (does NOT call
 *                onSelect / navigate) so it works without any change to the
 *                parent screen machine — same self-contained idea as an overlay.
 *   - Join     → calls onSelect("join"); the parent opens the JoinNetworkModal.
 *
 * The bar is only rendered on the home screens (see index.tsx for visibility
 * rules — hidden during any active report flow and while the live camera /
 * photo preview is open). Safe-area aware via env(safe-area-inset-bottom).
 */
import { useState } from "react";
import { MessagesModal } from "@/components/voyce/MessagesModal";

// Brand palette (matches the rest of the app).
const GOLD = "#FFDF3B";
const GOLD_DEEP = "#C9871A";
const INK = "#1A1611";

export type BottomTab = "report" | "atrisk" | "messages" | "join";

type TabDef = {
  id: BottomTab;
  icon: string;
  label: string;
};

const TABS: TabDef[] = [
  { id: "report", icon: "📷", label: "Report" },
  { id: "atrisk", icon: "🏠", label: "At-Risk" },
  { id: "messages", icon: "💬", label: "Messages" },
  { id: "join", icon: "🐾", label: "Join the Pack" },
];

export function BottomTabBar({
  active,
  onSelect,
}: {
  /** Which home tab is currently showing. `messages` and `join` never stay active. */
  active: "report" | "atrisk";
  onSelect: (tab: BottomTab) => void;
}) {
  // Messages is a self-contained overlay owned by the tab bar, so it works on
  // every screen that renders the bar without threading state through index.tsx.
  const [showMessages, setShowMessages] = useState(false);

  const handleClick = (id: BottomTab) => {
    if (id === "messages") {
      setShowMessages(true);
      return;
    }
    onSelect(id);
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
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => handleClick(t.id)}
                aria-current={isActive ? "page" : undefined}
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
                <span className="text-[20px] leading-none" aria-hidden>
                  {t.icon}
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
      <MessagesModal open={showMessages} onClose={() => setShowMessages(false)} />
    </>
  );
}
