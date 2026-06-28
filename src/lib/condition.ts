import type { Assessment } from "@/lib/analyze.functions";

export type ConditionInfo = {
  sick: boolean;
  injured: boolean;
  lethargic: boolean;
  dehydrated: boolean;
  /** Short label for the profile chip, e.g. "Limping" or "Coughing". */
  primarySign?: string;
  /** Ribbon label override for the `injured` mission. */
  ribbonOverride?: string;
  /** Title word substituted in `bigTitle`, e.g. "SICK", "INJURED", "LETHARGIC". */
  titleWord?: string;
  /** Visible-condition pill text. */
  visibleCondition: "Healthy" | "Concerning" | "Critical";
};

const DEFAULT_PRIMARY: Record<string, string> = {
  injured: "Visible injury",
  sick: "Possible illness",
  lethargic: "Lethargic",
  dehydrated: "Dehydrated",
};

export function getCondition(a: Assessment): ConditionInfo {
  const hs = a.health_signs ?? {
    sick: false,
    injured: false,
    lethargic: false,
    dehydrated: false,
  };
  const sick = !!hs.sick;
  const injured = !!hs.injured;
  const lethargic = !!hs.lethargic;
  const dehydrated = !!hs.dehydrated;

  let ribbonOverride: string | undefined;
  let titleWord: string | undefined;

  if (sick && injured) {
    ribbonOverride = "🚨 URGENT: SICK + INJURED";
    titleWord = "SICK + INJURED";
  } else if (sick) {
    ribbonOverride = "🚨 URGENT: SICK";
    titleWord = "SICK";
  } else if (injured) {
    ribbonOverride = "🚨 URGENT: INJURED";
    titleWord = "INJURED";
  } else if (dehydrated) {
    ribbonOverride = "⚠️ NEEDS CHECK: DEHYDRATED";
    titleWord = "DEHYDRATED";
  } else if (lethargic) {
    ribbonOverride = "⚠️ NEEDS CHECK";
    titleWord = "LETHARGIC";
  }

  const primarySign =
    hs.primary_sign ||
    (injured ? DEFAULT_PRIMARY.injured
      : sick ? DEFAULT_PRIMARY.sick
      : lethargic ? DEFAULT_PRIMARY.lethargic
      : dehydrated ? DEFAULT_PRIMARY.dehydrated
      : undefined);

  const visibleCondition: ConditionInfo["visibleCondition"] =
    a.visible_condition ??
    (a.status === "Urgent"
      ? "Critical"
      : sick || injured || lethargic || dehydrated
        ? "Concerning"
        : "Healthy");

  return {
    sick,
    injured,
    lethargic,
    dehydrated,
    primarySign,
    ribbonOverride,
    titleWord,
    visibleCondition,
  };
}

export const CONDITION_COLORS: Record<ConditionInfo["visibleCondition"], { bg: string; text: string; dot: string }> = {
  Healthy: { bg: "#E7F5EC", text: "#1F6B3D", dot: "#1F9D57" },
  Concerning: { bg: "#FFEEE4", text: "#A8431F", dot: "#FF6B35" },
  Critical: { bg: "#FCE4E4", text: "#7E1F1F", dot: "#D14848" },
};
