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

  // Card layout (per-mission)
  titleSub: string;
  callout: {
    emoji: string;
    body: string;
    bg: string;
    border: string;
    text: string;
  };
  megaCta: {
    label: string;
    gradient: string;
    textColor: string;
  } | null;
  nearbyHelpers: string;
  showCountdown?: boolean;
  showTopWarning?: { title: string; body: string };
  extraDetails?: { label: string; value: string }[];
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
    ribbonGradient: "linear-gradient(135deg, #FF6B35 0%, #D14848 100%)",
    ribbonText: "#FFF6F2",
    titleColor: "#A8431F",
    ringBg: "#FFE7DC",
    capturePillLabel: "Injured / Sick",
    alertButtonLabel: "🔔 Send Urgent Alert",
    titleSub: "Needs medical attention",
    callout: {
      emoji: "❤",
      body: "High Urgency: Medical Help Needed · Fast response can save this animal.",
      bg: "#FFEEE4",
      border: "#FF6B35",
      text: "#A8431F",
    },
    megaCta: {
      label: "🔔 SEND URGENT ALERT",
      gradient: "linear-gradient(135deg, #FF6B35 0%, #D14848 100%)",
      textColor: "#FFFFFF",
    },
    nearbyHelpers: "Rescues, volunteers & fosters in this area are being alerted.",
  },
  "at-risk-shelter": {
    id: "at-risk-shelter",
    icon: "⏳",
    label: "At-Risk Shelter",
    sub: "Facing euthanasia, needs foster or rescue pull",
    accent: "#D14848",
    accentSoft: "#F8E2E2",
    rolePills: [
      { icon: "🐾", label: "Pull Today" },
      { icon: "🏠", label: "Foster Tonight" },
      { icon: "💛", label: "Adopt" },
      { icon: "🤝", label: "Pledge for Pull" },
      { icon: "🚚", label: "Transport" },
      { icon: "🩺", label: "Vet (intake)" },
      { icon: "📤", label: "Share" },
    ],
    ribbonLabel: "🚨 CRITICAL: AT RISK",
    ribbonGradient: "linear-gradient(135deg, #D14848 0%, #7E1F1F 100%)",
    ribbonText: "#FFF1EE",
    titleColor: "#7E1F1F",
    ringBg: "#F8E2E2",
    capturePillLabel: "At-Risk Shelter",
    alertButtonLabel: "🆘 Save This Dog",
    titleSub: "Needs foster or rescue pull TODAY",
    callout: {
      emoji: "🚨",
      body: "Without a foster or rescue commitment by the deadline, this animal will be euthanized. Every role in the network matters.",
      bg: "#FCE4E4",
      border: "#D14848",
      text: "#7E1F1F",
    },
    megaCta: {
      label: "🆘 SAVE THIS DOG",
      gradient: "linear-gradient(135deg, #D14848 0%, #7E1F1F 100%)",
      textColor: "#FFFFFF",
    },
    nearbyHelpers:
      "The whole network is being alerted — rescuers, fosters, adopters, pledgers, transporters, vets, and animal lovers in the area.",
    showCountdown: true,
    extraDetails: [
      { label: "Shelter", value: "Riverside County AC" },
      { label: "Kennel", value: "B-14" },
      { label: "Intake", value: "Jun 22, 2026" },
      { label: "Days at shelter", value: "6" },
    ],
  },
  "lost-found": {
    id: "lost-found",
    icon: "🔍",
    label: "Lost / Found",
    sub: "Reunite a stray with their family",
    accent: "#C9871A",
    accentSoft: "#FCEFC9",
    rolePills: [
      { icon: "👁", label: "I've seen them" },
      { icon: "📞", label: "Contact owner" },
      { icon: "🏠", label: "Safe hold" },
      { icon: "💛", label: "Adopt if unclaimed" },
      { icon: "🤝", label: "Pledge for care" },
    ],
    ribbonLabel: "🔍 LOST · FOUND ALIVE",
    ribbonGradient: "linear-gradient(135deg, #FFD24A 0%, #C9871A 100%)",
    ribbonText: "#3A2A07",
    titleColor: "#8A5A0E",
    ringBg: "#FCEFC9",
    capturePillLabel: "Lost / Found",
    alertButtonLabel: "🔔 Alert Neighbors",
    titleSub: "Helping reunite with family",
    callout: {
      emoji: "💛",
      body: "3 possible lost reports nearby — owners being notified.",
      bg: "#FCEFC9",
      border: "#C9871A",
      text: "#8A5A0E",
    },
    megaCta: {
      label: "🔔 ALERT NEIGHBORS",
      gradient: "linear-gradient(135deg, #FFD24A 0%, #C9871A 100%)",
      textColor: "#3A2A07",
    },
    nearbyHelpers: "Neighbors, lost-pet groups, and local shelters in this area are being alerted.",
  },
  prevention: {
    id: "prevention",
    icon: "🤱",
    label: "Prevention / Care",
    sub: "Healthy stray needs spay/neuter, vaccines, TNR",
    accent: "#1F9D57",
    accentSoft: "#E7F5EC",
    rolePills: [
      { icon: "🏠", label: "Foster pups" },
      { icon: "💛", label: "Adopt" },
      { icon: "✂", label: "TNR" },
      { icon: "💉", label: "Vaccinate" },
      { icon: "🔧", label: "Sterilize" },
      { icon: "🌳", label: "Volunteer" },
    ],
    ribbonLabel: "💛 CARE NEEDED",
    ribbonGradient: "linear-gradient(135deg, #4ADE80 0%, #1F9D57 100%)",
    ribbonText: "#0F3A22",
    titleColor: "#1F6B3D",
    ringBg: "#E7F5EC",
    capturePillLabel: "Prevention / Care",
    alertButtonLabel: "🌱 Arrange Care",
    titleSub: "Healthy — needs care to prevent next litter",
    callout: {
      emoji: "🌱",
      body: "Care now prevents the next litter. Spay + vaccines = lives saved long-term.",
      bg: "#E7F5EC",
      border: "#1F9D57",
      text: "#1F6B3D",
    },
    megaCta: {
      label: "🌱 ARRANGE CARE",
      gradient: "linear-gradient(135deg, #4ADE80 0%, #1F9D57 100%)",
      textColor: "#0F3A22",
    },
    nearbyHelpers: "TNR volunteers, clinics, and rescue partners in this area are being notified.",
  },
  wildlife: {
    id: "wildlife",
    icon: "🦝",
    label: "Wildlife",
    sub: "Routes to licensed rehabbers — never handle yourself",
    accent: "#4A8FB5",
    accentSoft: "#E4ECFF",
    rolePills: [
      { icon: "🧭", label: "Navigate" },
      { icon: "📞", label: "Call Rehabber" },
      { icon: "🏛", label: "Animal Control" },
      { icon: "🤝", label: "Pledge for rehab" },
      { icon: "📤", label: "Share" },
    ],
    ribbonLabel: "🦝 WILDLIFE",
    ribbonGradient: "linear-gradient(135deg, #9DB7FF 0%, #4A8FB5 100%)",
    ribbonText: "#0F2A3A",
    titleColor: "#2C5C7C",
    ringBg: "#E4F0F8",
    capturePillLabel: "Wildlife",
    alertButtonLabel: "📞 Call Licensed Rehabber",
    titleSub: "Routes only to licensed rehabilitators",
    callout: {
      emoji: "🌿",
      body: "Voyce is routing this to local licensed wildlife rehabilitators. Keep distance and wait for trained help.",
      bg: "#E4ECFF",
      border: "#4A8FB5",
      text: "#2C5C7C",
    },
    megaCta: {
      label: "📞 CALL LICENSED REHABBER",
      gradient: "linear-gradient(135deg, #9DB7FF 0%, #4A8FB5 100%)",
      textColor: "#FFFFFF",
    },
    nearbyHelpers: "Licensed wildlife rehabbers and animal control in this area are being routed this report.",
    showTopWarning: {
      title: "🚨 DO NOT HANDLE",
      body: "Wild animals can be dangerous to people AND to themselves if approached. Voyce routes only to licensed rehabbers.",
    },
  },
};

export const MISSION_LIST: Mission[] = [
  MISSIONS.injured,
  MISSIONS["at-risk-shelter"],
  MISSIONS["lost-found"],
  MISSIONS.prevention,
  MISSIONS.wildlife,
];

// Layout used as fallback when AI judges the animal is healthy/monitoring,
// regardless of the mission the user picked. Anti-cry-wolf moment.
export const MONITORING_LAYOUT = {
  ribbonLabel: "✓ MONITORING · NO ACTION NEEDED",
  ribbonGradient: "linear-gradient(135deg, #4ADE80 0%, #1F9D57 100%)",
  ribbonText: "#0F3A22",
  titleColor: "#1F6B3D",
  ringBg: "#E7F5EC",
  titleSub: "Looks like an owned pet at home",
  calmCallout: "Heads up — likely a pet at home. If yours, no action needed.",
};
