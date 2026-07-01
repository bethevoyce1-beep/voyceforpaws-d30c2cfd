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
  // Health-sign fields (sick + injured can co-exist)
  health_signs?: {
    sick: boolean;
    injured: boolean;
    lethargic: boolean;
    dehydrated: boolean;
    primary_sign?: string; // short label e.g. "Limping", "Coughing", "Lethargic"
  };
  visible_condition?: "Healthy" | "Concerning" | "Critical";
  symptoms?: string[];           // clinical-phrased symptom list
  clinical_actions?: string[];   // suggested clinical next actions (exam, X-ray, fluids)
  differentials?: string[];      // differential possibilities
  reportedAt?: string;           // ISO timestamp set when the AI assessment completes
};


const SYSTEM = `You are Voyce, an AI that looks at a photo of an animal and produces an advisory rescue report. You are NOT a veterinarian. Output strict JSON only, matching the schema. Be cinematic and specific about what you actually see in the image (surfaces, lighting, posture, objects). NEVER contradict yourself: if status is "Healthy" or "Monitoring", next_steps must not say "seek medical attention" or treat it as urgent. If you see a collar, indoor scene, bedding, or grooming, set is_likely_pet=true and prefer status "Monitoring". If no real symptoms, noticed must be [].

Paint the scene in detail — surfaces (couch, floor, pavement, kennel), surrounding objects (furniture, cars, fences, trash), lighting/time (daylight, fluorescent, dusk, rainy), and SAFETY-RELEVANT details a rescuer needs to know before approaching. If indoor pet at home with no hazards, say so explicitly. If outdoor with traffic risk, flag it. If commercial/industrial setting, note the hazards. Honesty over alarm.

safety_flags MUST only describe hazards actually visible in the image — never speculate. For a calm indoor pet, return safety_flags: ["None — calm domestic environment"]. Never include urgency flags that contradict setting_type (e.g. no "Active road traffic" inside a living room). Use "Voyce's First Look" framing — never the words "Health Assessment".

ENVIRONMENT_TEXT — CRITICAL. Be cinematically SPECIFIC. Name exact items, surfaces, colors, textures, patterns, and time-of-day details. Imagine you're describing the scene to a rescuer who hasn't seen the photo so they can prep mentally. ~60-80 words.

GOOD examples (specific, do this):
  • "Indoor living room. Grey leather couch with a cream throw blanket bunched under the dog. Hardwood floor, fern in a clay pot visible to the right. Soft late-afternoon light from a south-facing window."
  • "Suburban backyard. Patchy grass with bare dirt spots, wooden fence (about 4ft) on the left, metal water bowl tipped over near a deck step. Overcast daylight."
  • "Barn interior. Wooden plank floor scattered with hay, metal feeding trough on the right wall, blue tarp folded in the corner. High windows letting in dusk light."
  • "Highway shoulder. Cracked asphalt with broken glass, yellow lane paint visible. Tall grass to the right, oil stain nearby. Bright midday sun."

BAD examples (NEVER do this):
  ❌ "Indoor home"  ❌ "Outdoor area"  ❌ "A street"  ❌ "Domestic environment"  ❌ "Pet accessories visible"

Specificity rules:
- Name actual furniture/objects ("leather couch", not "furniture").
- Name surface materials ("hardwood floor", "gravel driveway", "concrete shelter floor").
- Name patterns/colors if visible ("striped comforter", "grey throw", "red fence").
- Name lighting source + time of day ("south-facing window, late afternoon", "overhead fluorescent", "streetlight at dusk").
- Mention items the rescuer needs to know about ("broken glass", "unsecured gate", "trash bag", "children's toys").

If the photo is a tight close-up with no visible environment, environment_text must honestly say: "Only the animal is visible in this frame — limited environmental context."

surface MUST be specific too: "Grey leather couch with cream throw" — not "Couch". "Hardwood floor with rug" — not "Floor".
surrounding_objects MUST capture textures + items: e.g. ["cream throw blanket","fern in clay pot","hardwood floor","water bowl","remote control on couch arm"].

HEALTH SIGNS — CRITICAL. For animals showing signs of illness (not just injury), surface ALL observable health indicators: lethargy, discharge (eyes/nose/mouth), coughing, vomiting, diarrhea visible, skin/coat condition, body condition score, breathing patterns, posture, weight, hydration signs. Don't say only 'injured' if the animal is also clearly sick. Be honest about what you see — sick and injured can co-exist on one card.

For every report, populate the health_signs object with booleans for sick/injured/lethargic/dehydrated based on what is visibly present, plus a short primary_sign label (e.g. "Limping", "Coughing", "Lethargic", "Eye discharge"). For a clearly healthy pet, all four booleans are false and primary_sign is omitted.

Set visible_condition to "Healthy", "Concerning", or "Critical" based on the visible state alone — never on speculation.

symptoms[]: every visible health sign as a short clinical-phrased line (e.g. "Mucopurulent ocular discharge, OD", "Right hindlimb non-weight-bearing lameness", "BCS 3/9 — underweight").
clinical_actions[]: concrete clinician-oriented next steps (e.g. "Full physical exam", "Right hindlimb radiograph", "SC fluids 30 mL/kg", "FeLV/FIV snap test"). 3-5 items max.
differentials[]: 2-4 differential possibilities a vet would consider given what's visible (e.g. "URI (feline herpesvirus / calicivirus)", "Soft-tissue trauma vs fracture", "Dehydration secondary to GI loss"). Omit or empty array if nothing concerning is visible.`;


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
  "surface": "SPECIFIC, e.g. 'Grey leather couch with cream throw' or 'Cracked asphalt shoulder' or 'Concrete shelter floor with rubber mat'",
  "surrounding_objects": ["specific textured items actually visible — e.g. 'cream throw blanket','fern in clay pot','hardwood floor','water bowl'"],
  "lighting_conditions": "specific source + time, e.g. 'Soft late-afternoon light from south-facing window'",
  "safety_flags": ["honest hazards visible in photo; ['None — calm domestic environment'] if none"],
  "environment_text": "60-80 words. Cinematic, sensory, specific. See system prompt for examples.",
  "health_signs": { "sick": false, "injured": false, "lethargic": false, "dehydrated": false, "primary_sign": "short label or omit" },
  "visible_condition": "Healthy | Concerning | Critical",
  "symptoms": ["clinical-phrased visible signs; [] if none"],
  "clinical_actions": ["clinician-oriented suggested actions; 3-5 items"],
  "differentials": ["2-4 differential possibilities; [] if nothing concerning visible"]
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
  if (!a.environment_text || typeof a.environment_text !== "string") {
    a.environment_text = a.location_scene || "Only the animal is visible in this frame — limited environmental context.";
  }

  // Backfill health-sign fields from `noticed` keywords so downstream UI is honest.
  const noticedText = a.noticed.join(" ").toLowerCase();
  const detectedInjured = /\b(wound|laceration|abrasion|cut|bleed|blood|limp|lame|fracture|swelling|gash|broken)\b/.test(noticedText);
  const detectedSick = /\b(discharge|coughing|cough|sneez|vomit|diarrh|fever|mucus|nasal|conjunct|infection|crust|wheez|drool|ulcer)\b/.test(noticedText);
  const detectedLethargic = /\b(lethargic|lethargy|listless|weak|unresponsive|subdued)\b/.test(noticedText);
  const detectedDehydrated = /\b(dehydrat|sunken|skin tent|tacky gums)\b/.test(noticedText);

  if (!a.health_signs) {
    a.health_signs = {
      sick: detectedSick,
      injured: detectedInjured,
      lethargic: detectedLethargic,
      dehydrated: detectedDehydrated,
    };
  } else {
    a.health_signs.sick = a.health_signs.sick || detectedSick;
    a.health_signs.injured = a.health_signs.injured || detectedInjured;
    a.health_signs.lethargic = a.health_signs.lethargic || detectedLethargic;
    a.health_signs.dehydrated = a.health_signs.dehydrated || detectedDehydrated;
  }

  if (!a.visible_condition) {
    const anySign =
      a.health_signs.sick || a.health_signs.injured ||
      a.health_signs.lethargic || a.health_signs.dehydrated;
    a.visible_condition =
      a.status === "Urgent" ? "Critical" : anySign ? "Concerning" : "Healthy";
  }
  if (!Array.isArray(a.symptoms)) a.symptoms = a.noticed.slice();
  if (!Array.isArray(a.clinical_actions)) a.clinical_actions = a.next_steps.slice();
  if (!Array.isArray(a.differentials)) a.differentials = [];

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
    // June 30, 2026: Swapped from Lovable's AI gateway to Google Gemini directly.
    // Lovable's gateway required a paid Lovable subscription. Gemini has a free
    // tier (15 rpm / 1M tokens per day) that fits Voyce's pre-launch usage easily.
    // Falls back to LOVABLE_API_KEY if GEMINI_API_KEY is not set, so the app
    // still works during migration.
    const geminiKey = process.env.GEMINI_API_KEY;
    const lovableKey = process.env.LOVABLE_API_KEY;
    if (!geminiKey && !lovableKey) {
      throw new Error(
        "Missing AI key. Set GEMINI_API_KEY (recommended) or LOVABLE_API_KEY.",
      );
    }

    const missionLine =
      MISSION_GUIDANCE[data.mission] ?? MISSION_GUIDANCE.injured;

    // Gemini expects images as base64 without the data-URL prefix, and a mime type.
    const match = data.imageDataUrl.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
    if (!match) throw new Error("Invalid image data URL for Gemini");
    const mimeType = match[1];
    const base64Data = match[2];

    const systemInstruction = SYSTEM + "\n\n" + missionLine + "\n\nSchema:\n" + SCHEMA_HINT;
    const userText = `Analyze this animal photo for mission "${data.mission}". Return ONLY the JSON object, no markdown.`;

    let content = "";

    if (geminiKey) {
      // Direct Google Gemini API (free tier: 15 rpm, ~1M tokens/day).
      // gemini-2.5-flash handles multimodal (text + image) with JSON output.
      const model = "gemini-2.5-flash";
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(geminiKey)}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemInstruction }] },
          contents: [
            {
              role: "user",
              parts: [
                { text: userText },
                { inlineData: { mimeType, data: base64Data } },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.2,
          },
        }),
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Gemini ${res.status}: ${body.slice(0, 300)}`);
      }
      const json = (await res.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
      };
      content = json.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    } else {
      // Legacy path: Lovable's AI gateway (OpenAI-shaped API). Kept as fallback.
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Lovable-API-Key": lovableKey!,
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: systemInstruction },
            {
              role: "user",
              content: [
                { type: "text", text: userText },
                { type: "image_url", image_url: { url: data.imageDataUrl } },
              ],
            },
          ],
          response_format: { type: "json_object" },
        }),
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Lovable gateway ${res.status}: ${body.slice(0, 300)}`);
      }
      const json = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      content = json.choices?.[0]?.message?.content ?? "";
    }

    let parsed: Assessment;
    try {
      const cleaned = content.replace(/^```json\s*|\s*```$/g, "").trim();
      parsed = JSON.parse(cleaned) as Assessment;
    } catch {
      throw new Error("AI returned non-JSON content");
    }
    return {
      ...validateAssessment(parsed),
      reportedAt: new Date().toISOString(),
    };
  });

