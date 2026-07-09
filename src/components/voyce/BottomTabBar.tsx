/**
 * Persistent bottom tab bar — the primary navigation on the app's two "home"
 * screens (the Report capture intake and the At-Risk shelter list).
 *
 * Three tabs, left→right: 📷 Report · 🏠 At-Risk · 🐾 Join the Pack.
 *   - Report  → returns to the capture intake (camera-first flow, unchanged).
 *   - At-Risk → opens the ShelterPicker (at-risk shelter list).
 *   - Join    → opens the JoinNetworkModal as an overlay (does NOT navigate);
 *               it has no persistent "active" state since it never becomes a
 *               screen of its own.
 *
 * The bar is only rendered on the home screens (see index.tsx for visibility
 * rules — hidden during any active report flow and while the live camera /
 * photo preview is open). Safe-area aware via env(safe-area-inset-bottom).
 */

// Brand palette (matches the rest of the app).
const GOLD = "#FFDF3B";
const GOLD_DEEP = "#C9871A";
const INK = "#1A1611";

export type BottomTab = "report" | "atrisk" | "join";

type TabDef = {
  id: BottomTab;
  icon: string;
  label: string;
};

const TABS: TabDef[] = [
  { id: "report", icon: "📷", label: "Report" },
  { id: "atrisk", icon: "🏠", label: "At-Risk" },
  { id: "join", icon: "🐾", label: "Join the Pack" },
];

export function BottomTabBar({
  active,
  onSelect,
}: {
  /** Which home tab is currently showing. `join` never stays active. */
  active: "report" | "atrisk";
  onSelect: (tab: BottomTab) => void;
}) {
  return (
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
              onClick={() => onSelect(t.id)}
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
  );
}
