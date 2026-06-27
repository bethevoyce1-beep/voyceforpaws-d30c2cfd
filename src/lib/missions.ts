export type MissionId =
  | "injured"
  | "at-risk-shelter"
  | "lost-found"
  | "prevention"
  | "wildlife";

export type RolePill = { icon: string; label: string };

export type Mission = {
  id: MissionId;
  icon: string;
  label: string;
  sub: string;
  accent: string;
  accentSoft: string;
  rolePills: RolePill[];
  ribbonLabel: string;
  ribbonGradient: string;
  ribbonText: string;
  titleColor: string;
  ringBg: string;
  capturePillLabel: string;
  alertButtonLabel: string;
};

export const MISSIONS: Record<MissionId, Mission> = {
  injured: {
    id: "injured",
    icon: "🩹",
    label: "Injured / Sick",
    sub: "Hit by car, visible wound, sick stray",
    accent: "#FF6B35",
    accentSoft: "#FFE7DC",
    rolePills: [
      { icon: "🏠", label: "Foster" },
      { icon: "🐾", label: "Rescue" },
      { icon: "💛", label: "Adopt" },
      { icon: "🤝", label: "Pledge" },
      { icon: "🚚", label: "Transport" },
    ],
    ribbonLabel: "🚨 URGENT: INJURED",
    ribbonGradient: "linear-gradient(135deg, #FF6B35 0%, #C9381A 100%)",
    ribbonText: "#FFF6F2",
    titleColor: "#A8431F",
    ringBg: "#FFE7DC",
    capturePillLabel: "Injured / Sick",
    alertButtonLabel: "🔔 Send Urgent Alert",
  },
  "at-risk-shelter": {
    id: "at-risk-shelter",
    icon: "🏠",
    label: "At-Risk Shelter",
    sub: "Facing euthanasia, needs foster or rescue pull",
    accent: "#D14848",
    accentSoft: "#F8E2E2",
    rolePills: [
      { icon: "🏠", label: "Foster Today" },
      { icon: "🐾", label: "Pull Today" },
      { icon: "🤝", label: "Pledge for Pull" },
      { icon: "🚚", label: "Transport" },
      { icon: "📤", label: "Share" },
    ],
    ribbonLabel: "⚠️ URGENT: AT RISK",
    ribbonGradient: "linear-gradient(135deg, #B83232 0%, #7E1F1F 100%)",
    ribbonText: "#FFF1EE",
    titleColor: "#7E1F1F",
    ringBg: "#F8E2E2",
    capturePillLabel: "At-Risk Shelter",
    alertButtonLabel: "🔔 Rally Foster Network",
  },
  "lost-found": {
    id: "lost-found",
    icon: "🔍",
    label: "Lost / Found",
    sub: "Reunite a stray with their family",
    accent: "#C9871A",
    accentSoft: "#FCEFC9",
    rolePills: [
      { icon: "👀", label: "I've Seen Them" },
      { icon: "📞", label: "Contact Owner" },
      { icon: "🛟", label: "Safe Hold" },
      { icon: "💛", label: "Adopt if Unclaimed" },
      { icon: "🤝", label: "Pledge for Care" },
    ],
    ribbonLabel: "🔍 FOUND",
    ribbonGradient: "linear-gradient(135deg, #FFD24A 0%, #C9871A 100%)",
    ribbonText: "#3A2A07",
    titleColor: "#8A5A0E",
    ringBg: "#FCEFC9",
    capturePillLabel: "Lost / Found",
    alertButtonLabel: "🔔 Alert Nearby Network",
  },
  prevention: {
    id: "prevention",
    icon: "🤱",
    label: "Prevention / Care",
    sub: "Healthy stray needs spay/neuter, vaccines, TNR",
    accent: "#1F9D57",
    accentSoft: "#E7F5EC",
    rolePills: [
      { icon: "🏠", label: "Foster" },
      { icon: "✂️", label: "TNR" },
      { icon: "💉", label: "Vaccinate" },
      { icon: "🩺", label: "Sterilize" },
      { icon: "🙋", label: "Volunteer" },
      { icon: "🤝", label: "Pledge" },
    ],
    ribbonLabel: "💛 CARE NEEDED",
    ribbonGradient: "linear-gradient(135deg, #B8E3C6 0%, #1F9D57 100%)",
    ribbonText: "#0F3A22",
    titleColor: "#1F6B3D",
    ringBg: "#E7F5EC",
    capturePillLabel: "Prevention / Care",
    alertButtonLabel: "🔔 Coordinate Care",
  },
  wildlife: {
    id: "wildlife",
    icon: "🦝",
    label: "Wildlife",
    sub: "Routes to licensed rehabbers — never handle yourself",
    accent: "#9DB7FF",
    accentSoft: "#E4ECFF",
    rolePills: [
      { icon: "🩺", label: "Rehabber" },
      { icon: "📞", label: "Animal Control" },
      { icon: "🤝", label: "Pledge for Rehab" },
      { icon: "🧭", label: "Navigate" },
    ],
    ribbonLabel: "🦝 WILDLIFE",
    ribbonGradient: "linear-gradient(135deg, #BFDDF0 0%, #4A8FB8 100%)",
    ribbonText: "#0F2A3A",
    titleColor: "#2C5C7C",
    ringBg: "#E4F0F8",
    capturePillLabel: "Wildlife",
    alertButtonLabel: "🔔 Route to Rehabber",
  },
};

export const MISSION_LIST: Mission[] = [
  MISSIONS.injured,
  MISSIONS["at-risk-shelter"],
  MISSIONS["lost-found"],
  MISSIONS.prevention,
  MISSIONS.wildlife,
];
