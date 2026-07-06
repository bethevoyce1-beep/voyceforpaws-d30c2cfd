import injuredPhoto from "@/assets/mission-injured.jpg";
import shelterPhoto from "@/assets/mission-shelter.jpg";
import lostFoundPhoto from "@/assets/mission-lostfound.jpg";
import preventionPhoto from "@/assets/mission-prevention.jpg";
import wildlifePhoto from "@/assets/mission-wildlife.jpg";

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
  photo: string;
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

  // Intake screen (shown after mission picked, before camera opens)
  intakeTitle: string;        // e.g. "Injured or Stray Animal"
  intakeDescription: string;  // 2-3 sentences explaining what Voyce does for this mission

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
    photo: injuredPhoto,
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
    // Pre-launch copy (July 5, 2026): the camera-first front door invites
    // TESTING with any animal photo — matches the landing-page modal —
    // instead of urgent-rescue framing.
    intakeTitle: "Try Voyce on your own pet — or any other animal",
    intakeDescription:
      "Upload any animal photo — yours, a stray you've seen, anything. Voyce's AI builds a full rescue profile in seconds so you can see exactly how it'll work when we launch. We're not live yet — this is a preview. See how the network responds.",
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
    nearbyHelpers: "Closest rescuers, fosters & animal lovers get it first — the alert keeps rippling until this animal is helped.",
  },
  "at-risk-shelter": {
    id: "at-risk-shelter",
    icon: "⏳",
    label: "At-Risk Shelter",
    sub: "Facing euthanasia, needs foster or rescue pull",
    photo: shelterPhoto,
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
    intakeTitle: "At-Risk Shelter Animal",
    intakeDescription:
      "Facing the shelter's capacity deadline. Pick an animal from the live ACS list — Voyce builds a full share card with countdown, shelter contacts, and direct ACS links. The whole network is alerted: rescuers, fosters, adopters, pledgers, transporters — every role that can save this life.",
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
      "Closest first, then rippling outward — rescuers, fosters, adopters, pledgers, transporters & animal lovers. The alert keeps rippling until this animal is helped.",
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
    photo: lostFoundPhoto,
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
    ribbonGradient: "linear-gradient(135deg, #FFDF3B 0%, #C9871A 100%)",
    ribbonText: "#3A2A07",
    titleColor: "#8A5A0E",
    ringBg: "#FCEFC9",
    capturePillLabel: "Lost / Found",
    alertButtonLabel: "🔔 Alert Neighbors",
    intakeTitle: "Lost or Found Pet",
    intakeDescription:
      "Reuniting strays with their families — fast. One photo and Voyce AI checks for collar, tags, and signs of an owned pet, then alerts the neighborhood network: lost-pet groups, neighbors, and local shelters. The closest helpers see it first.",
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
      gradient: "linear-gradient(135deg, #FFDF3B 0%, #C9871A 100%)",
      textColor: "#3A2A07",
    },
    nearbyHelpers: "Closest neighbors, lost-pet groups & shelters get it first — the alert keeps rippling until this animal is helped.",
  },
  prevention: {
    id: "prevention",
    icon: "🤱",
    label: "Prevention / Care",
    sub: "Healthy stray needs spay/neuter, vaccines, TNR",
    photo: preventionPhoto,
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
    intakeTitle: "Community Care · Prevention",
    intakeDescription:
      "Healthy stray or community cat? One photo and Voyce routes to TNR volunteers, low-cost spay/neuter clinics, and vaccine partners in the area. Care now prevents the next litter — lives saved long-term, not just today.",
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
    nearbyHelpers: "Closest TNR volunteers, clinics & rescue partners get it first — the alert keeps rippling until this animal is helped.",
  },
  wildlife: {
    id: "wildlife",
    icon: "🦝",
    label: "Wildlife",
    sub: "Deer, bird, raccoon or any wildlife in need of rehab",
    photo: wildlifePhoto,
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
    intakeTitle: "Injured Wildlife",
    intakeDescription:
      "Deer, bird, raccoon, or any wildlife in need? One photo and Voyce routes only to licensed wildlife rehabilitators and animal control — never untrained handlers. Keep distance. Trained help is on the way.",
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
    nearbyHelpers: "Closest licensed rehabbers & animal control get it first — the alert keeps rippling until this animal is in expert hands.",
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
// NOTE (July 5, 2026 fix): titleSub/calmCallout previously lived here as fixed
// strings, so EVERY healthy animal — including wild ducks on a lake — was
// labeled "owned pet at home". Copy is now scene-aware via calmScene() below.
export const MONITORING_LAYOUT = {
  ribbonLabel: "✓ MONITORING · NO ACTION NEEDED",
  ribbonGradient: "linear-gradient(135deg, #4ADE80 0%, #1F9D57 100%)",
  ribbonText: "#0F3A22",
  titleColor: "#1F6B3D",
  ringBg: "#E7F5EC",
};

// ---------------------------------------------------------------------------
// Scene-aware copy for the calm/monitoring layout.
// The heading, subtitle, callout, and responder note must describe where the
// animal ACTUALLY is (from the AI's setting read), never a hardcoded "at home".
// ---------------------------------------------------------------------------

export type CalmScene = {
  /** Big-title suffix, e.g. "RESTING AT HOME", "ON THE WATER", "IN THE PARK" */
  place: string;
  /** Italic subtitle under the big title */
  titleSub: string;
  /** Calm callout box body */
  callout: string;
  /** Emoji for the responder-briefing Setting line */
  settingEmoji: string;
  /** Responder-briefing note */
  responderNote: string;
};

/** Wild species that must never be described as a pet at home. */
const WILD_SPECIES =
  /\b(duck|geese|goose|swan|waterfowl|mallard|pigeon|dove|seagull|gull|heron|crane|crow|raven|hawk|owl|squirrel|raccoon|opossum|possum|deer|coyote|fox|rabbit|hare|turtle|frog|snake|lizard|bat)\b/i;

/** Water scene cues in the AI's environment read. */
const WATER_SCENE =
  /\b(lake|river|pond|harbor|harbour|bay|creek|stream|canal|shoreline|waterfront|body of water|swimming|floating on)\b/i;

export function isWildSpecies(a: {
  species?: string;
  breed?: string;
  title?: string;
}): boolean {
  const text = `${a.species ?? ""} ${a.breed ?? ""} ${a.title ?? ""}`;
  return WILD_SPECIES.test(text);
}

/**
 * Most specific safe word for the animal, for headings (July 5, 2026 fix).
 * The AI often returns breed like "duck / unknown" — the old code discarded
 * the WHOLE breed when it contained "unknown", so ducks were headlined as
 * "BIRD". Keep the meaningful first segment; fall back to species.
 */
export function animalWord(a: { species?: string; breed?: string }): string {
  const first = (a.breed ?? "")
    .split(/[/,·—]|\bor\b/)[0]
    .trim();
  if (first && !/^(unknown|mixed|none|n\/a|unclear)$/i.test(first)) return first;
  return (a.species ?? "animal").trim() || "animal";
}

export function calmScene(a: {
  setting_type?: string;
  is_likely_pet?: boolean;
  species?: string;
  breed?: string;
  title?: string;
  environment_text?: string;
  surface?: string;
  location_scene?: string;
}): CalmScene {
  const env = `${a.environment_text ?? ""} ${a.surface ?? ""} ${a.location_scene ?? ""}`;
  const wild = isWildSpecies(a) && !a.is_likely_pet;
  const onWater = WATER_SCENE.test(env);

  // Wild animal in a natural or public setting — the happiest non-rescue there is.
  if (wild) {
    if (onWater) {
      return {
        place: "ON THE WATER",
        titleSub: "Wild waterfowl in their natural habitat",
        callout:
          "These look like wild waterfowl doing just fine. Enjoy from a distance — no action needed.",
        settingEmoji: "🌊",
        responderNote:
          "No responder action needed — wild waterfowl in their natural habitat.",
      };
    }
    return {
      place: "IN THE WILD",
      titleSub: "A wild animal in its natural habitat",
      callout:
        "This looks like a healthy wild animal where it belongs. Observe from a distance — no action needed.",
      settingEmoji: "🌿",
      responderNote:
        "No responder action needed — healthy wild animal in its natural habitat.",
    };
  }

  switch (a.setting_type) {
    case "Home (Indoor)":
      return {
        place: "RESTING AT HOME",
        titleSub: "Looks like an owned pet at home",
        callout: "Heads up — likely a pet at home. If yours, no action needed.",
        settingEmoji: "🏠",
        responderNote:
          "No responder action needed — this looks like a domestic pet.",
      };
    case "Backyard/Domestic Outdoor":
      return {
        place: "AT HOME OUTDOORS",
        titleSub: "Looks like a pet in its own yard",
        callout:
          "Heads up — likely a pet in its own yard. If yours, no action needed.",
        settingEmoji: "🏡",
        responderNote:
          "No responder action needed — this looks like a pet on its home turf.",
      };
    case "Public Space (Park/Plaza)":
      return {
        place: onWater ? "ON THE WATER" : "AT THE PARK",
        titleSub: "Healthy and at ease in a public space",
        callout:
          "This animal looks healthy and undisturbed. Keep an eye out, but no action is needed right now.",
        settingEmoji: onWater ? "🌊" : "🌳",
        responderNote:
          "No responder action needed — animal appears healthy in a public space.",
      };
    case "Wild/Undeveloped":
      return {
        place: "IN THE WILD",
        titleSub: "Healthy in a natural setting",
        callout:
          "This animal looks healthy in a natural setting. Observe from a distance — no action needed.",
        settingEmoji: "🌿",
        responderNote:
          "No responder action needed — healthy animal in a natural setting.",
      };
    case "Street/Sidewalk":
      return {
        place: "ON THE STREET",
        titleSub: "No visible injury or distress",
        callout:
          "Looks okay right now — no visible injury or distress. Keep an eye out and report any changes.",
        settingEmoji: "🚶",
        responderNote:
          "No immediate responder action — animal appears healthy. Monitor for changes.",
      };
    case "Vehicle-Adjacent (Road/Parking)":
      return {
        place: "NEAR THE ROAD",
        titleSub: "No visible injury — location worth watching",
        callout:
          "No visible injury, but the location is worth watching. Report changes right away.",
        settingEmoji: "🚗",
        responderNote:
          "No injury visible — location near traffic is the main thing to watch.",
      };
    case "Commercial Area":
    case "Industrial/Warehouse":
      return {
        place: "ON SITE",
        titleSub: "No visible injury or distress",
        callout:
          "Looks healthy where it is. Keep an eye out and report any changes.",
        settingEmoji: "🏢",
        responderNote:
          "No immediate responder action — animal appears healthy. Monitor for changes.",
      };
    case "Shelter/Kennel":
      return {
        place: "AT THE SHELTER",
        titleSub: "Healthy and in shelter care",
        callout: "This animal is in shelter care and looks healthy.",
        settingEmoji: "🏥",
        responderNote: "Animal is in shelter care — no field response needed.",
      };
    default:
      // Unknown setting — stay honest and generic, never claim "at home".
      return {
        place: "NO ACTION NEEDED",
        titleSub: "No visible injury or distress",
        callout:
          "This animal looks healthy — no visible injury or distress. No action needed right now.",
        settingEmoji: "📍",
        responderNote:
          "No responder action needed — animal appears healthy.",
      };
  }
}
