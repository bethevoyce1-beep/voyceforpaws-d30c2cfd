import { createServerFn } from "@tanstack/react-start";

export type SettingType =
  | "Home (Indoor)"
  | "Backyard/Domestic Outdoor"
  | "Street/Sidewalk"
  | "Commercial Area"
  | "Industrial/Warehouse"
  | "Vehicle-Adjacent (Road/Parking)"
  | "Public Space (Park/Plaza)"
  | "Wild/Undeveloped"
  | "Shelter/Kennel";

export type Assessment = {
  title: string;
  status: "Urgent" | "Monitoring" | "Stable" | "Healthy";
  status_reason: string;
  species: string;
  breed: string;
  age: string;
  weight: string;
  first_look: string;
  behavior: string;
  location_scene: string;
  noticed: string[];
  next_steps: string[];
  vet_notes: {
    bcs: string;
    posture: string;
    hydration: string;
    clinical: string;
  };
  is_likely_pet: boolean;
  setting_type: SettingType;
  surface: string;
  surrounding_objects: string[];
  lighting_conditions: string;
  safety_flags: string[];
  environment_text: string;
};

const SYSTEM = `You are Voyce, an AI that looks at a photo of an animal and produces an advisory rescue report. You are NOT a veterinarian. Output strict JSON only, matching the schema. Be cinematic and specific about what you actually see in the image (surfaces, lighting, posture, objects). NEVER contradict yourself: if status is "Healthy" or "Monitoring", next_steps must not say "seek medical attention" or treat it as urgent. If you see a collar, indoor scene, bedding, or grooming, set is_likely_pet=true and prefer status "Monitoring". If no real symptoms, noticed must be [].

Paint the scene in detail — surfaces (couch, floor, pavement, kennel), surrounding objects (furniture, cars, fences, trash), lighting/time (daylight, fluorescent, dusk, rainy), and SAFETY-RELEVANT details a rescuer needs to know before approaching. If indoor pet at home with no hazards, say so explicitly. If outdoor with traffic risk, flag it. If commercial/industrial setting, note the hazards. Honesty over alarm.

safety_flags MUST only describe hazards actually visible in the image — never speculate. For a calm indoor pet, return safety_flags: ["None — calm domestic environment"]. Never include urgency flags that contradict setting_type (e.g. no "Active road traffic" inside a living room). Use "Voyce's First Look" framing — never the words "Health Assessment".`;

const SCHEMA_HINT = `{
  "title": "short cinematic title, e.g. 'Tabby resting on a sunlit couch'",
  "status": "Urgent | Monitoring | Stable | Healthy",
  "status_reason": "one short clause, e.g. 'Likely a pet at home'",
  "species": "dog | cat | bird | other",
  "breed": "best guess or 'mixed / unknown'",
  "age": "puppy/kitten | young | adult | senior | unknown",
  "weight": "estimate range, e.g. '4-5 kg'",
  "first_look": "2-3 warm sentences, Voyce's First Look",
  "behavior": "cinematic detail about posture, breath, alertness",
  "location_scene": "cinematic detail about surfaces, lighting, objects nearby",
  "noticed": ["only real visible symptoms; [] if none"],
  "next_steps": ["3-4 short suggested actions appropriate to status"],
  "vet_notes": {
    "bcs": "e.g. 'BCS 5/9 — ideal'",
    "posture": "clinical phrasing",
    "hydration": "observation",
    "clinical": "1-2 sentence clinical summary"
  },
  "is_likely_pet": true,
  "setting_type": "Home (Indoor) | Backyard/Domestic Outdoor | Street/Sidewalk | Commercial Area | Industrial/Warehouse | Vehicle-Adjacent (Road/Parking) | Public Space (Park/Plaza) | Wild/Undeveloped | Shelter/Kennel",
  "surface": "short string, e.g. 'Leather couch' or 'Pavement' or 'Concrete shelter floor'",
  "surrounding_objects": ["short strings — only what is actually visible"],
  "lighting_conditions": "short string, e.g. 'Natural daylight from large window' or 'Streetlight + dark surroundings'",
  "safety_flags": ["honest hazards visible in photo; ['None — calm domestic environment'] if none"]
}`;

const INDOOR_SETTINGS: SettingType[] = ["Home (Indoor)", "Shelter/Kennel"];

export function validateAssessment(a: Assessment): Assessment {
  const benign = a.status === "Healthy" || a.status === "Monitoring";
  const urgentLanguage = a.next_steps.some((s) =>
    /seek (urgent|immediate|emergency) (medical|veterinary)|medical attention|rush to vet|emergency/i.test(
      s,
    ),
  );
  if (benign && urgentLanguage) {
    throw new Error(
      `Assessment contradiction: status=${a.status} but next steps imply urgency.`,
    );
  }
  if (!a.title || !a.species || !Array.isArray(a.noticed) || !Array.isArray(a.next_steps)) {
    throw new Error("Assessment missing required fields.");
  }
  if (!a.setting_type || !a.surface || !Array.isArray(a.safety_flags)) {
    throw new Error("Assessment missing setting/safety fields.");
  }
  // Conflict: indoor home setting + traffic hazard claim.
  if (a.setting_type === "Home (Indoor)") {
    const trafficClaim = a.safety_flags.some((f) => /traffic|road|vehicle|street/i.test(f));
    if (trafficClaim) {
      throw new Error("Safety flag conflict: traffic hazard claimed inside a home.");
    }
  }
  // Conflict: calm indoor pet but urgent status.
  if (
    a.status === "Urgent" &&
    INDOOR_SETTINGS.includes(a.setting_type) &&
    a.safety_flags.length === 1 &&
    /^none/i.test(a.safety_flags[0])
  ) {
    // allow — medical urgency can exist indoors. no throw.
  }
  return a;
}


const MISSION_GUIDANCE: Record<string, string> = {
  injured:
    "MISSION: INJURED / SICK. Look closely for visible injuries (limb angle, wounds, lameness, lethargy, blood, swelling). Calibrate urgency honestly. Orient next_steps toward RESCUE: stabilize, transport, vet contact.",
  "at-risk-shelter":
    "MISSION: AT-RISK SHELTER. Note kennel context (bars, concrete, ID tags), body condition for foster suitability, temperament cues. Orient next_steps toward FOSTER / PULL: foster commitment, rescue pull, transport coordination.",
  "lost-found":
    "MISSION: LOST / FOUND. Look for collar, tags, grooming, healthy body condition (signs of an owned pet). Orient next_steps toward REUNITE / SAFE HOLD: scan for chip, post to local lost-pet networks, safe temporary hold.",
  prevention:
    "MISSION: PREVENTION / CARE. Note body condition, nursing signs, reproductive status, ear-tip. Orient next_steps toward TNR / SPAY / VACCINE: trap-neuter-return, vaccination, community-cat care.",
  wildlife:
    "MISSION: WILDLIFE. Identify species precisely. next_steps must ONLY say 'Do not handle. Voyce will route to licensed rehabbers.' Put any rehabber phone numbers or animal-control numbers (if you can infer plausible local ones, otherwise generic placeholders like 'Local wildlife rehabber: search state rehabber directory') in vet_notes.clinical.",
};

export const analyzeImage = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => {
    const o = input as { imageDataUrl?: string; mission?: string };
    if (!o?.imageDataUrl || !o.imageDataUrl.startsWith("data:image/")) {
      throw new Error("imageDataUrl required");
    }
    const mission = typeof o.mission === "string" ? o.mission : "injured";
    return { imageDataUrl: o.imageDataUrl, mission };
  })
  .handler(async ({ data }): Promise<Assessment> => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    const missionLine =
      MISSION_GUIDANCE[data.mission] ?? MISSION_GUIDANCE.injured;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": key,
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: SYSTEM + "\n\n" + missionLine + "\n\nSchema:\n" + SCHEMA_HINT,
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Analyze this animal photo for mission "${data.mission}". Return ONLY the JSON object, no markdown.`,
              },
              { type: "image_url", image_url: { url: data.imageDataUrl } },
            ],
          },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`AI gateway ${res.status}: ${body.slice(0, 300)}`);
    }

    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = json.choices?.[0]?.message?.content ?? "";
    let parsed: Assessment;
    try {
      const cleaned = content.replace(/^```json\s*|\s*```$/g, "").trim();
      parsed = JSON.parse(cleaned) as Assessment;
    } catch {
      throw new Error("AI returned non-JSON content");
    }
    return validateAssessment(parsed);
  });

