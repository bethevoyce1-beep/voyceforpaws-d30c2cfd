import type { Assessment } from "@/lib/analyze.functions";
import type { MissionId } from "@/lib/missions";

export type UrgencyLevel = "LOW" | "MODERATE" | "HIGH" | "CRITICAL";

export type UrgencyDisplay = {
  level: UrgencyLevel;
  label: string;
  emoji: string;
  /** Deep semantic color used for text */
  deep: string;
  /** Base semantic color */
  base: string;
  /** 12% opacity background derived from base */
  soft: string;
};

const STYLES: Record<UrgencyLevel, Omit<UrgencyDisplay, "level" | "label">> = {
  LOW: { emoji: "🟢", base: "#1F9D57", deep: "#155F35", soft: "rgba(31,157,87,0.12)" },
  MODERATE: { emoji: "🟡", base: "#C9871A", deep: "#8A5A0E", soft: "rgba(201,135,26,0.12)" },
  HIGH: { emoji: "🟠", base: "#FF6B35", deep: "#A8431F", soft: "rgba(255,107,53,0.12)" },
  CRITICAL: { emoji: "🔴", base: "#D14848", deep: "#7E1F1F", soft: "rgba(209,72,72,0.12)" },
};

// Urgency now tracks what Voyce actually SEES (visible_condition + health
// signs), not the mission label or a bare "Stable" status. A calm animal with
// no visible concern reads LOW — even on the prevention/lost-found missions and
// even when the AI labels it "Stable." Only a real visible concern raises it.
export function getUrgencyLevel(
  data: Pick<Assessment, "status" | "visible_condition" | "health_signs"> | null,
  mission?: MissionId,
): UrgencyLevel {
  if (!data) return "LOW";
  const s = data.status;
  const vc = data.visible_condition;

  // Act-now cases first.
  if (mission === "at-risk-shelter" && s === "Urgent") return "CRITICAL";
  if (vc === "Critical") return "CRITICAL";
  if (s === "Urgent") return "HIGH";

  // A visible concern (sick / injured / lethargic / dehydrated) is Moderate.
  const hs = data.health_signs;
  const concern =
    vc === "Concerning" ||
    !!(hs && (hs.sick || hs.injured || hs.lethargic || hs.dehydrated));
  if (concern) return "MODERATE";

  // Healthy / Safe / Stable / Monitoring with nothing visibly wrong → Low.
  return "LOW";
}

export function getUrgency(
  data: Pick<Assessment, "status" | "visible_condition" | "health_signs"> | null,
  mission?: MissionId,
): UrgencyDisplay {
  const level = getUrgencyLevel(data, mission);
  return { level, label: level, ...STYLES[level] };
}
