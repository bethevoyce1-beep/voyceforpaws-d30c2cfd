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

export function getUrgencyLevel(
  data: Pick<Assessment, "status"> | null,
  mission?: MissionId,
): UrgencyLevel {
  if (!data) return "LOW";
  const s = data.status;
  // At-risk shelter + Urgent = euthanasia-today scenario.
  if (mission === "at-risk-shelter" && s === "Urgent") return "CRITICAL";
  if (s === "Urgent") return "HIGH";
  if (s === "Stable") return "MODERATE";
  if (mission === "prevention" && s !== "Healthy") return "MODERATE";
  // Healthy / Monitoring
  return "LOW";
}

export function getUrgency(
  data: Pick<Assessment, "status"> | null,
  mission?: MissionId,
): UrgencyDisplay {
  const level = getUrgencyLevel(data, mission);
  return { level, label: level, ...STYLES[level] };
}
