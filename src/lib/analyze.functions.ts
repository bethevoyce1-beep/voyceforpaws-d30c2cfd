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
  status: "Urgent" | "Monitoring" | "Stable" | "Healthy" | "Safe";
  status_reason: string;
  species: string;
  breed: string;
  age: string;
  weight: string;
  size: string;
  color: string;
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
  animal_present?: boolean; // false when the photo contains NO animal (food, people, scenery)
  non_animal_subject?:      // what the photo actually shows when animal_present is false
    | "person"
    | "food"
    | "vehicle"
    | "plant"
    | "object"
    | "scenery"
    | "other";
  setting_type: SettingType;
  surface: string;
  surrounding_objects: string[];
  lighting_conditions: string;
  weather?: string; // visibly-apparent weather for outdoor scenes; "Not visible" indoors/unclear
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
  observations?: string[];       // short standardized, hedged observation lines (behavior + visible physical signs)
  symptoms?: string[];           // clinical-phrased symptom list
  clinical_actions?: string[];   // suggested clinical next actions (exam, X-ray, fluids)
  differentials?: string[];      // differential possibilities
  reportedAt?: string;           // ISO timestamp set when the AI assessment completes
  caseId?: string;               // human-facing case reference, e.g. "VFP-0042"
  suggested_situation?: string;  // best-fit reporter-situation label read from the photo
  situation_confidence?: "high" | "medium" | "low"; // how sure Voyce is about it
  ai_confidence?: "high" | "medium" | "low"; // overall confidence in the visual read
  animals?: Assessment[];        // one complete assessment per animal when 2+ are present
  // Anti-scam Tier 2 (July 5, 2026): does this look like a fresh phone capture
  // or a stock/internet image? "likely_stock" caps situation_confidence at low.
  capture_authenticity?: "fresh_capture" | "uncertain" | "likely_stock";
  authenticity_reason?: string;  // one short clause explaining the read
};


const SYSTEM = `You are Voyce, an AI that looks at a photo of an animal and produces an advisory rescue report. You are NOT a veterinarian. Output strict JSON only, matching the schema.

LANGUAGE & SAFETY RULES — NON-NEGOTIABLE, THESE OVERRIDE EVERYTHING BELOW. Voyce shares OBSERVATIONS and SUGGESTIONS only — never a diagnosis, medical conclusion, or treatment order. (1) Never state a medical condition as established fact; use hedged, observational language ("appears", "possible", "may", "seems", "consider"). (2) Never give treatment instructions, medication or drug names, dosages, fluid volumes, injection routes, or medical schedules of any kind. (3) Never instruct anyone to perform a medical or surgical procedure. (4) Frame every clinical-sounding item as something to raise with, and confirm with, a licensed veterinarian. (5) When there is any doubt, recommend seeing a licensed veterinarian. Voyce describes what is visible and suggests seeking professional care — it does not practice veterinary medicine.

NO-ANIMAL CHECK — DO THIS FIRST. Voyce is only for animals. If the image contains NO animal at all — only people, food, plates, drinks, objects, buildings, or scenery — set "animal_present": false and "species": "none", and set "non_animal_subject" to the single best label for what the photo actually shows: "person" (any human, even partially visible), "food", "vehicle", "plant", "object", "scenery", or "other". Do NOT invent an animal, a status, or a health reading. A human in the frame is NOT an animal; only report an actual animal (dog, cat, bird, wildlife, etc.). If a real animal is present, set "animal_present": true and continue normally. IMPORTANT — LOW LIGHT IS OK: darkness, night, dim light, shadows, blur, grain, or partial/close framing are NEVER reasons to report no animal. If an animal is plausibly present even in a dark or unclear photo, set "animal_present": true, give your best-effort read, and note the limited visibility in environment_text. Only set "animal_present": false when you can clearly see the photo contains people, food, objects, or scenery and NO animal at all.

BREED — COMMIT TO YOUR CLOSEST GUESS. Always give your single closest visual breed read, using "mix" when unsure: "Labrador mix", "German Shepherd mix", "domestic shorthair tabby", "Chihuahua mix". Use visible cues — coat, ears, muzzle, size, build. NEVER answer just "unknown" or "mixed / unknown" when any breed traits are visible; reserve bare "unknown" for cases where the animal is barely visible. This applies at every detail level, including quick reads.

SIZE, COLOR & CONFIDENCE. Always fill "size" with the animal's overall body size from visible build and proportions — one of "Small", "Medium", "Large", or "Extra large". Always fill "color" with the main visible coat color(s) in plain words — e.g. "Black", "Black & white", "Golden", "Tabby brown". Never leave size or color blank when the animal is visible. Set "ai_confidence" to your overall confidence in this visual read — "high", "medium", or "low" — based on image clarity, how much of the animal is visible, and how certain the identification is; use "low" for blurry, partial, or ambiguous photos. ai_confidence is a qualitative level, NEVER a percentage.

Be cinematic and specific about what you actually see in the image (surfaces, lighting, posture, objects). NEVER contradict yourself: if status is "Healthy" or "Monitoring", next_steps must not say "seek medical attention" or treat it as urgent. If you see a collar, indoor scene, bedding, or grooming, set is_likely_pet=true and prefer status "Monitoring". If no real symptoms, noticed must be [].

WILDLIFE VS PET — CRITICAL. Wild species (ducks, geese, swans, pigeons, gulls, herons, crows, hawks, owls, squirrels, raccoons, deer, foxes, turtles, and similar) observed in a natural or public setting (lake, river, pond, shoreline, park, woods, field, sky) are WILD ANIMALS: set is_likely_pet=false, choose the setting_type that matches the actual scene (e.g. "Wild/Undeveloped" or "Public Space (Park/Plaza)"), and NEVER claim "Home (Indoor)" or describe them as a pet at home. Only call such a species a pet with clear domestic evidence (cage, coop, leash, indoor room). status_reason for healthy wildlife should read like "Wild animal in its natural habitat — no action needed."

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

WEATHER. For OUTDOOR scenes, set "weather" to the short weather that is visibly apparent — "Clear / sunny", "Overcast", "Rain", "Snow", "Fog", or "Night". If the scene is indoors or the weather cannot be told from the photo, set "weather" to "Not visible". Never guess beyond what the image shows.

HEALTH SIGNS — CRITICAL, AND ALWAYS AS OBSERVATIONS. For animals showing possible signs of illness (not just injury), surface ALL observable indicators as things you can SEE, hedged: lethargy, discharge (eyes/nose/mouth), coughing, apparent vomiting, visible diarrhea, skin/coat condition, apparent body condition, breathing patterns, posture, apparent weight, possible hydration signs. Don't say only 'injured' if the animal also appears sick. Be honest about what you see — apparent sickness and injury can co-exist on one card. Describe, never diagnose.

For every report, populate the health_signs object with booleans for sick/injured/lethargic/dehydrated based on what is visibly present, plus a short primary_sign label (e.g. "Limping", "Coughing", "Lethargic", "Eye discharge"). For a clearly healthy pet, all four booleans are false and primary_sign is omitted.

Set visible_condition to "Healthy", "Concerning", or "Critical" based on the visible state alone — never on speculation.

symptoms[]: every visible sign as a short, plain, OBSERVATIONAL line — describe what appears visible, hedged, never a diagnosis (e.g. "Possible discharge around the eye", "Appears to favor the right hind leg", "Appears underweight"). Do NOT use definitive clinical or diagnostic wording.
clinical_actions[]: gentle SUGGESTIONS to raise with a licensed veterinarian — never doses, medication names, fluid volumes, or medical orders (e.g. "Ask a vet to take a closer look at the right hind leg", "A vet may want to check for infection", "Have a vet assess hydration and overall condition"). 3-5 items max. Always assume a licensed professional makes the medical decisions.
differentials[]: 2-4 POSSIBILITIES a veterinarian may want to consider — plainly worded and clearly NOT a diagnosis (e.g. "Possible respiratory infection", "Possible soft-tissue injury or fracture", "Possible dehydration"). A licensed vet must confirm. Omit or empty array if nothing concerning is visible.

OBSERVATIONS LIST. Also populate "observations" with 3-6 SHORT, standardized, hedged one-liners (about 3-6 words each) that a person can scan at a glance — covering the animal's apparent behavior/affect and any visible physical signs. Use the observational voice, never a diagnosis. Good examples: "Appears alert and responsive", "Appears calm", "Appears frightened", "Possible visible wound", "Possible limp observed", "Appears thin", "No visible injury detected". If nothing concerning is visible, include "No visible injury detected". Do NOT include environment lines here — the app adds the environment separately.

SITUATION READ. Pick the single best-fit "suggested_situation" for what the photo shows, choosing ONLY from this exact list: "Injured or hit by a car", "Sick or in distress", "Lost pet", "Found pet", "Abandoned puppies or kittens", "Stray, needs care", "Needs spay or vaccine", "At-risk shelter". Set "situation_confidence" to "high" ONLY when the photo clearly supports it (e.g. visible injury for "Injured or hit by a car", grooming/collar for "Lost pet", multiple neonates for "Abandoned puppies or kittens"); otherwise use "medium" or "low". When unsure, prefer "low" — never guess "high".

AUTHENTICITY CHECK — ANTI-SCAM. Judge whether this image is plausibly a FRESH PHONE CAPTURE versus a stock photo, screenshot, or image saved from the internet. Set "capture_authenticity" to: "fresh_capture" (looks like a real, casual phone photo — natural framing, ordinary lighting, real-world clutter), "likely_stock" (professional studio lighting, watermarks, posed composition, visible UI elements from a screenshot, borders, or obvious re-photograph of a screen), or "uncertain". Give a one-clause "authenticity_reason". Be conservative: most real reports ARE fresh captures — only flag "likely_stock" when clear signals are present. Never mention this check in user-facing text fields.

MULTIPLE ANIMALS. If TWO OR MORE distinct animals are clearly present in the frame, ALSO return an "animals" array with ONE complete object per animal (each using this full schema: its own title, species, breed, age, weight, status, first_look, health_signs, symptoms, next_steps, and so on). Assess each animal INDEPENDENTLY — they may differ in species, age, condition, and urgency. Order them most-urgent first. The top-level fields describe the single most urgent (or most prominent) animal. If only ONE animal is present, OMIT the "animals" field entirely.`;


const SCHEMA_HINT = `{
  "animal_present": true,
  "non_animal_subject": "person | food | vehicle | plant | object | scenery | other (ONLY when animal_present is false; omit otherwise)",
  "animals": "OPTIONAL array of complete per-animal objects (same shape) — include ONLY when 2+ animals are present; omit for a single animal",
  "title": "short cinematic title, e.g. 'Tabby resting on a sunlit couch'",
  "status": "Urgent | Monitoring | Stable | Healthy | Safe",
  "status_reason": "one short clause, e.g. 'Likely a pet at home'",
  "suggested_situation": "best-fit label from: Injured or hit by a car | Sick or in distress | Lost pet | Found pet | Abandoned puppies or kittens | Stray, needs care | Needs spay or vaccine | At-risk shelter",
  "situation_confidence": "high | medium | low (high only when the photo clearly supports it)",
  "ai_confidence": "high | medium | low — overall confidence in this visual read",
  "capture_authenticity": "fresh_capture | uncertain | likely_stock",
  "authenticity_reason": "one short clause, e.g. 'casual framing and natural lighting' or 'studio backdrop with watermark'",
  "species": "dog | cat | bird | other | none (if no animal)",
  "breed": "closest visual guess with 'mix' when unsure, e.g. 'Labrador mix' or 'domestic shorthair tabby' — avoid bare 'unknown'",
  "age": "puppy/kitten | young | adult | senior | unknown",
  "weight": "estimate range, e.g. '4-5 kg'",
  "size": "overall body size from visible build: Small | Medium | Large | Extra large",
  "color": "main visible coat color(s), e.g. 'Black', 'Black & white', 'Golden', 'Tabby brown'",
  "first_look": "2-3 warm sentences, Voyce's First Look",
  "behavior": "cinematic detail about posture, breath, alertness",
  "location_scene": "cinematic detail about surfaces, lighting, objects nearby",
  "noticed": ["only real visible signs, plainly worded; [] if none"],
  "observations": ["3-6 SHORT standardized observation lines (<=6 words), hedged & observational — apparent behavior/affect and any visible physical signs; include 'No visible injury detected' when nothing concerning; never a diagnosis; do NOT include environment lines"],
  "next_steps": ["3-4 short suggested actions appropriate to status"],
  "vet_notes": {
    "bcs": "plain observation of apparent weight, e.g. 'Appears an ideal weight' or 'Appears underweight' — not a clinical score",
    "posture": "plain observation of how the animal is holding itself",
    "hydration": "plain observation, hedged (e.g. 'Appears well hydrated' or 'May be dehydrated — a vet should confirm')",
    "clinical": "1-2 sentence plain-language summary of what is visible — not a diagnosis"
  },
  "is_likely_pet": true,
  "setting_type": "Home (Indoor) | Backyard/Domestic Outdoor | Street/Sidewalk | Commercial Area | Industrial/Warehouse | Vehicle-Adjacent (Road/Parking) | Public Space (Park/Plaza) | Wild/Undeveloped | Shelter/Kennel",
  "surface": "SPECIFIC, e.g. 'Grey leather couch with cream throw' or 'Cracked asphalt shoulder' or 'Concrete shelter floor with rubber mat'",
  "surrounding_objects": ["specific textured items actually visible — e.g. 'cream throw blanket','fern in clay pot','hardwood floor','water bowl'"],
  "lighting_conditions": "specific source + time, e.g. 'Soft late-afternoon light from south-facing window'",
  "weather": "SHORT visibly-apparent weather for OUTDOOR scenes: 'Clear / sunny' | 'Overcast' | 'Rain' | 'Snow' | 'Fog' | 'Night'. Use 'Not visible' if indoors or not determinable from the photo",
  "safety_flags": ["honest hazards visible in photo; ['None — calm domestic environment'] if none"],
  "environment_text": "60-80 words. Cinematic, sensory, specific. See system prompt for examples.",
  "health_signs": { "sick": false, "injured": false, "lethargic": false, "dehydrated": false, "primary_sign": "short label or omit" },
  "visible_condition": "Healthy | Concerning | Critical",
  "symptoms": ["plain observational signs, hedged ('possible', 'appears'); [] if none"],
  "clinical_actions": ["gentle suggestions to discuss with a licensed vet — no doses, drug names, or medical orders; 3-5 items"],
  "differentials": ["2-4 plain possibilities for a vet to consider, clearly not a diagnosis; [] if nothing concerning visible"]
}`;


const INDOOR_SETTINGS: SettingType[] = ["Home (Indoor)", "Shelter/Kennel"];

export function validateAssessment(
  a: Assessment,
  opts: { witnessedEmergency?: boolean } = {},
): Assessment {
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

  // New profile fields — never let a missing value render as broken UI.
  if (typeof a.size !== "string") a.size = "";
  if (typeof a.color !== "string") a.color = "";
  if (typeof a.weather !== "string") a.weather = "";
  if (a.ai_confidence !== "high" && a.ai_confidence !== "medium" && a.ai_confidence !== "low") {
    a.ai_confidence = undefined;
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

  // Short standardized observation lines for the "AI Observations" block.
  // Backfill from what the AI already surfaced so older/edge reports still show
  // something consistent; never leave it empty.
  if (!Array.isArray(a.observations)) a.observations = [];
  if (a.observations.length === 0) {
    const base =
      a.symptoms && a.symptoms.length > 0
        ? a.symptoms.slice(0, 5)
        : a.noticed && a.noticed.length > 0
          ? a.noticed.slice(0, 5)
          : [];
    a.observations = base.length > 0 ? base : ["No visible injury detected"];
  }

  // Consistency safeguard — enforces an "as-is" read. If the AI detected NO
  // injury/sickness signs and listed NO concerning observations, the animal is
  // not an emergency — no matter which category the reporter picked or where the
  // animal is. Downgrade an over-called "Urgent"/"Stable" to "Monitoring". This
  // ONLY fires when the AI itself found nothing wrong, so it can never hide a
  // real emergency: any wound, blood, limp, swelling, or sickness keeps Urgent.
  // Only a clear INJURY or SICKNESS keeps "Urgent". "Lethargic" / "dehydrated"
  // alone are too easily mis-read for a calmly resting or sleeping healthy pet,
  // so on their own they must not force an emergency reading.
  const hasHealthSign = a.health_signs.injured || a.health_signs.sick;
  // A witnessed emergency (hit by car, trapped, abuse) is a legitimate reason to
  // stay elevated even with no visible injury — the reporter saw it happen, and
  // the photo can't show internal harm or ongoing danger. Only the pure photo
  // "as-is" case (no visible signs AND nothing witnessed) gets downgraded.
  if (
    (a.status === "Urgent" || a.status === "Stable") &&
    !hasHealthSign &&
    !opts.witnessedEmergency
  ) {
    a.status = "Monitoring";
    a.visible_condition = "Healthy";
    a.noticed = [];
    if (!a.status_reason || /urgent|injur|distress|rescue/i.test(a.status_reason)) {
      a.status_reason =
        "No visible injury or sickness in the photo — not an emergency.";
    }
  }

  // Wildlife guard (July 5, 2026 fix — live duck test): classic wild species
  // must never be labeled a pet or claim a home setting. A duck swimming on a
  // lake once rendered "HEALTHY BIRD · RESTING AT HOME" with Setting: Home
  // (Indoor). If the species/breed/title reads as wildlife AND the scene shows
  // no domestic cues, force is_likely_pet=false and fix an indoor mislabel.
  const wildSpecies =
    /\b(duck|geese|goose|swan|waterfowl|mallard|pigeon|dove|seagull|gull|heron|crane|crow|raven|hawk|owl|squirrel|raccoon|opossum|possum|deer|coyote|fox|hare|turtle|frog|snake|lizard|bat)\b/i;
  const wildText = `${a.species ?? ""} ${a.breed ?? ""} ${a.title ?? ""}`;
  const envText = `${a.environment_text ?? ""} ${a.surface ?? ""} ${a.location_scene ?? ""}`;
  const domesticCues =
    /\b(collar|leash|cage|aviary|coop|kennel|bed(ding)?|couch|sofa|carpet|rug|living room|kitchen|indoors?)\b/i.test(
      envText,
    );
  if (wildSpecies.test(wildText) && !domesticCues) {
    a.is_likely_pet = false;
    if (a.setting_type === "Home (Indoor)") {
      a.setting_type = /\b(lake|river|pond|harbor|harbour|bay|creek|stream|canal|shoreline|waterfront|body of water|forest|woods|meadow|field)\b/i.test(
        envText,
      )
        ? "Wild/Undeveloped"
        : "Public Space (Park/Plaza)";
    }
    if (/pet at home|owned pet/i.test(a.status_reason ?? "")) {
      a.status_reason = "Wild animal in its natural habitat — no action needed.";
    }
  }

  // Anti-scam Tier 2 (July 5, 2026): a photo the AI reads as likely stock /
  // saved-from-internet can never carry a confident situation read. The report
  // still generates (false positives happen), but downstream ranking and the
  // details form treat it as low-confidence.
  if (a.capture_authenticity === "likely_stock") {
    a.situation_confidence = "low";
  }

  // Outcome-specific status. An owned pet at home with no health concerns is
  // "Safe" (settled, no one needs to watch it) — distinct from "Monitoring",
  // which fits a healthy STRAY that could still use eyes on it.
  const noSigns =
    !a.health_signs.injured && !a.health_signs.sick &&
    !a.health_signs.lethargic && !a.health_signs.dehydrated;
  if (
    (a.status === "Monitoring" || a.status === "Healthy") &&
    noSigns &&
    a.is_likely_pet &&
    a.setting_type === "Home (Indoor)"
  ) {
    a.status = "Safe";
    a.visible_condition = "Healthy";
    if (!a.status_reason || /monitor|no visible/i.test(a.status_reason)) {
      a.status_reason = "Looks like an owned pet at home — safe, no action needed.";
    }
  }

  return a;
}



const MISSION_GUIDANCE: Record<string, string> = {
  injured:
    "MISSION: INJURED / SICK. Look closely for visible injuries (limb angle, wounds, lameness, lethargy, blood, swelling). Calibrate urgency honestly — do NOT default to Urgent. If there is NO visible wound, blood, swelling, limp, or sign of sickness, the animal is NOT urgent: a groomed, collared, or calmly resting pet with no injury must be status 'Monitoring' or 'Healthy', never 'Urgent'. Orient next_steps toward RESCUE only when a real problem is visible: stabilize, transport, and contact a vet.",
  "at-risk-shelter":
    "MISSION: AT-RISK SHELTER. Note kennel context (bars, concrete, ID tags), body condition for foster suitability, temperament cues. Orient next_steps toward FOSTER / PULL: foster commitment, rescue pull, transport coordination.",
  "lost-found":
    "MISSION: LOST / FOUND. Look for collar, tags, grooming, healthy body condition (signs of an owned pet). Orient next_steps toward REUNITE / SAFE HOLD: scan for chip, post to local lost-pet networks, safe temporary hold.",
  prevention:
    "MISSION: PREVENTION / CARE. Note body condition, nursing signs, reproductive status, ear-tip. Orient next_steps toward TNR / SPAY / VACCINE: trap-neuter-return, vaccination, community-cat care.",
  wildlife:
    "MISSION: WILDLIFE. Identify species precisely. next_steps must ONLY say 'Do not handle. Voyce will route to licensed rehabbers.' Do NOT invent phone numbers. In vet_notes.clinical, advise the reporter to contact a licensed wildlife rehabber or local animal control, e.g. 'Search your state's licensed wildlife rehabber directory, or call local animal control.'",
};

export const analyzeImage = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => {
    const o = input as {
      imageDataUrl?: string;
      mission?: string;
      // Anti-scam Tier 2 (July 5, 2026): ms since the app loaded (bot signal
      // when tiny) and a 64-bit perceptual hash of the photo (dedup). Both
      // optional — samples and older clients simply don't send them.
      elapsedMs?: number;
      photoHash?: string;
      context?: {
        animalType?: string;
        situation?: string;
        witnessed?: string[];
        notes?: string;
      };
    };
    if (!o?.imageDataUrl || !o.imageDataUrl.startsWith("data:image/")) {
      throw new Error("imageDataUrl required");
    }
    const mission = typeof o.mission === "string" ? o.mission : "injured";
    const c = o.context ?? {};
    const context = {
      animalType: typeof c.animalType === "string" ? c.animalType.slice(0, 60) : "",
      situation: typeof c.situation === "string" ? c.situation.slice(0, 80) : "",
      witnessed: Array.isArray(c.witnessed)
        ? c.witnessed
            .filter((w): w is string => typeof w === "string")
            .slice(0, 5)
            .map((w) => w.slice(0, 60))
        : [],
      notes: typeof c.notes === "string" ? c.notes.slice(0, 500) : "",
    };
    const elapsedMs =
      typeof o.elapsedMs === "number" && Number.isFinite(o.elapsedMs)
        ? o.elapsedMs
        : undefined;
    const photoHash =
      typeof o.photoHash === "string" && /^[0-9a-f]{16}$/.test(o.photoHash)
        ? o.photoHash
        : undefined;
    return { imageDataUrl: o.imageDataUrl, mission, context, elapsedMs, photoHash };
  })
  .handler(async ({ data }): Promise<Assessment> => {
    // ── Anti-scam Tier 2 (July 5, 2026) ──────────────────────────────────
    // Time-on-page minimum: a real reporter needs time to open the camera and
    // frame an animal. Reports fired in under 10 seconds are a bot signal.
    if (
      typeof data.elapsedMs === "number" &&
      data.elapsedMs >= 0 &&
      data.elapsedMs < 10_000
    ) {
      throw new Error(
        "That was quick! Please take a moment with the animal, then try again in a few seconds.",
      );
    }

    // Photo dedup: the client sends a perceptual hash (dHash) of the capture.
    // The same photo resubmitted within a rolling 30 days is rejected. Fails
    // OPEN — a database hiccup must never block a real rescue report.
    if (data.photoHash) {
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        // Matches younger than 10 minutes don't count — a reporter retaking
        // the same scene within one session must never be blocked. The target
        // is the same photo resubmitted hours or days later.
        const graceCutoff = new Date(Date.now() - 10 * 60 * 1000).toISOString();
        const { data: dupe } = await supabaseAdmin
          .from("photo_hashes")
          .select("id")
          .eq("hash", data.photoHash)
          .gte("created_at", since)
          .lte("created_at", graceCutoff)
          .limit(1)
          .maybeSingle();
        if (dupe) {
          throw new Error(
            "DUPLICATE_PHOTO|This exact photo was already reported recently. If the animal still needs help, please take a fresh photo at the scene.",
          );
        }
      } catch (e) {
        if (e instanceof Error && e.message.startsWith("DUPLICATE_PHOTO|")) throw e;
        console.warn("[voyce] photo dedup check failed (continuing):", e);
      }
    }

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

    // Context the reporter filled in on-scene. Treat as helpful hints — it can
    // steer breed/species and flag concerns — but the visual assessment still
    // governs (don't invent injuries that aren't visible in the photo).
    const ctx = data.context;
    const reporterLines: string[] = [];
    if (ctx.animalType) reporterLines.push(`Animal type the reporter selected: ${ctx.animalType}`);
    if (ctx.witnessed && ctx.witnessed.length)
      reporterLines.push(
        `REPORTER WITNESSED — the photo may NOT show this, but the person on scene saw it happen: ${ctx.witnessed.join("; ")}. This is real, serious context that the image cannot reveal (e.g. internal injury, ongoing danger). Reflect it in status_reason and next_steps, and do NOT lower urgency just because the harm isn't visible in the photo.`,
      );
    if (ctx.notes) reporterLines.push(`Reporter notes: ${ctx.notes}`);
    // The reporter's urgency/situation category is deliberately NOT sent to the AI.
    // The health assessment must reflect the animal AS-IS from the photo, never
    // swayed by which category the reporter tapped. Only concrete details (animal
    // type, free-text notes) are shared as hints.
    const reporterBlock =
      reporterLines.length > 0
        ? `\n\nCONTEXT FROM THE PERSON ON THE SCENE (helpful hints only — use to guide breed/species and what to look for, but judge health ONLY from what you actually see in the photo; never invent injuries or symptoms that aren't visible):\n${reporterLines.join("\n")}`
        : "";
    const userText = `Analyze this animal photo for mission "${data.mission}". Return ONLY the JSON object, no markdown.${reporterBlock}`;

    let content = "";

    if (geminiKey) {
      // Direct Google Gemini API (free tier). Both models handle multimodal
      // (text + image) with JSON output. If the primary model hits its free
      // daily quota (429), fall back to flash-lite, which has its OWN separate
      // free allowance — so a busy day on one model still goes through.
      const models = ["gemini-2.5-flash", "gemini-2.5-flash-lite"];
      const requestBody = JSON.stringify({
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
      });

      // Small sleep helper for retry backoff.
      const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

      let json:
        | { candidates?: { content?: { parts?: { text?: string }[] } }[] }
        | null = null;
      let sawRateLimit = false; // 429 — free/daily quota on a model
      let sawOverload = false; // 503/500/502/504 or network blip — transient

      // Try each model; within a model, retry a few times on TRANSIENT errors
      // (temporary overload / brief server blips) with exponential backoff.
      // Gemini's 503 "model is currently experiencing high demand" is almost
      // always cleared by a quick retry, so the user must NEVER see that raw
      // error. Only genuinely unrecoverable errors surface — and even then as a
      // clean, reassuring message, never the raw API JSON.
      outer: for (const model of models) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(geminiKey)}`;
        const MAX_ATTEMPTS = 3;
        for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
          let res: Response;
          try {
            res = await fetch(url, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: requestBody,
            });
          } catch (e) {
            // Network-level failure — treat as transient: retry, then fall through.
            console.warn(`[voyce] Gemini ${model} fetch failed (attempt ${attempt}):`, e);
            sawOverload = true;
            if (attempt < MAX_ATTEMPTS) {
              await sleep(400 * attempt);
              continue;
            }
            break; // exhausted this model — try the next one
          }
          if (res.ok) {
            json = (await res.json()) as typeof json;
            break outer;
          }
          const status = res.status;
          // Read the body once for server-side logging only; never surface it.
          const body = await res.text().catch(() => "");
          console.warn(`[voyce] Gemini ${model} ${status} (attempt ${attempt}): ${body.slice(0, 300)}`);

          if (status === 429) {
            // Rate/quota limit on this model — its sibling has a separate free
            // allowance, so stop retrying this one and move to the next model.
            sawRateLimit = true;
            break;
          }
          if (status === 500 || status === 502 || status === 503 || status === 504) {
            // Temporary overload / server blip — back off and retry same model.
            sawOverload = true;
            if (attempt < MAX_ATTEMPTS) {
              await sleep(500 * attempt);
              continue;
            }
            break; // exhausted this model — try the next one
          }
          // Any other error (400 bad request, 401/403 bad key) won't be fixed by
          // a retry. Log the detail server-side; show the user a clean message.
          throw new Error(
            "Voyce AI couldn't read this photo right now. Please try again in a moment — your photo and details are safe.",
          );
        }
      }

      if (!json) {
        // Every model and retry is exhausted. Reassure the reporter — never
        // expose the raw Gemini error.
        if (sawOverload) {
          throw new Error(
            "Voyce AI is experiencing high demand right now. Your photo and details are safe — please try again in a moment.",
          );
        }
        if (sawRateLimit) {
          throw new Error(
            "Voyce AI has reached today's free limit. Please try again in a little while — your photo and details are safe, nothing was lost.",
          );
        }
        throw new Error(
          "Voyce AI is temporarily unavailable. Your photo and details are safe — please try again in a moment.",
        );
      }
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

    // No-animal guard — Voyce is only for animals. If the AI reports no animal
    // (flag or its own wording), stop here with a clear, retryable message
    // instead of fabricating a "healthy pet" card for food/people/scenery.
    const _txt = [
      parsed.first_look,
      parsed.status_reason,
      parsed.vet_notes && parsed.vet_notes.clinical,
      parsed.location_scene,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    const _noAnimal =
      parsed.animal_present === false ||
      (typeof parsed.species === "string" && parsed.species.trim().toLowerCase() === "none") ||
      /no animal (is )?(present|detected|visible)|does not (contain|show|feature) (an |any )?animal|primarily (features|shows|depicts) (a )?(human|person|people|food|dining|meal)|no (visible )?animal (in|present)/.test(
        _txt,
      );
    if (_noAnimal) {
      // Name what the photo actually shows so the app can tell the reporter
      // exactly why it isn't a rescue case (a person, food, a vehicle, etc.).
      const ALLOWED_SUBJECTS = ["person","food","vehicle","plant","object","scenery"];
      let subject =
        typeof parsed.non_animal_subject === "string"
          ? parsed.non_animal_subject.trim().toLowerCase()
          : "";
      if (ALLOWED_SUBJECTS.indexOf(subject) === -1) {
        if (/\b(human|person|people|man|woman|child|selfie|face)\b/.test(_txt)) subject = "person";
        else if (/\b(food|meal|dining|plate|dish|drink|beverage|snack)\b/.test(_txt)) subject = "food";
        else if (/\b(car|truck|vehicle|motorcycle|bicycle|bus)\b/.test(_txt)) subject = "vehicle";
        else if (/\b(plant|flower|tree|garden|foliage)\b/.test(_txt)) subject = "plant";
        else if (/\b(building|street|landscape|scenery|room|sky|wall)\b/.test(_txt)) subject = "scenery";
        else subject = "other";
      }
      const SUBJECT_LINE = {
        person: "That looks like a person, not an animal.",
        food: "That looks like food, not an animal.",
        vehicle: "That looks like a vehicle, not an animal.",
        plant: "That looks like a plant, not an animal.",
        object: "That looks like an object, not an animal.",
        scenery: "That looks like a scene with no animal in it.",
        other: "We couldn't find an animal in that photo.",
      };
      const line = SUBJECT_LINE[subject] || SUBJECT_LINE.other;
      throw new Error(
        "NO_ANIMAL:" + subject + "|" + line +
          " Voyce is only for animals - if there's an animal in the frame, move closer or crop to it, then try again.",
      );
    }

    const witnessed = data.context.witnessed;
    const result = validateAssessment(parsed, {
      witnessedEmergency: witnessed.length > 0,
    });
    if (witnessed.length > 0) {
      // Surface the reporter-witnessed context on the card — the photo can't show it.
      const flag = `⚠️ Reporter witnessed (not visible in photo): ${witnessed.join(", ")}.`;
      if (
        Array.isArray(result.next_steps) &&
        !result.next_steps.some((s) => /witnessed/i.test(s))
      ) {
        result.next_steps = [flag, ...result.next_steps];
      }
    }
    const reportedAt = new Date().toISOString();
    // Multi-animal: validate each detected animal and give it the shared scene
    // context so every per-animal card has location + environment. Only 2+.
    let animals: Assessment[] | undefined;
    if (Array.isArray(parsed.animals) && parsed.animals.length > 1) {
      const scene = {
        location_scene: result.location_scene,
        environment_text: result.environment_text,
        setting_type: result.setting_type,
        surface: result.surface,
        surrounding_objects: result.surrounding_objects,
        lighting_conditions: result.lighting_conditions,
        safety_flags: result.safety_flags,
      };
      animals = parsed.animals.map((one) => {
        const merged = { ...scene, ...one, reportedAt } as Assessment;
        try {
          return {
            ...validateAssessment(merged, { witnessedEmergency: witnessed.length > 0 }),
            reportedAt,
          };
        } catch {
          return merged;
        }
      });
    }
    // Record the photo hash only AFTER a successful assessment, so a failed
    // attempt (network hiccup, no-animal photo) can always be retried.
    // Fail-open: a logging problem never blocks the report itself.
    if (data.photoHash) {
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        await supabaseAdmin
          .from("photo_hashes")
          .insert({ hash: data.photoHash, mission: data.mission });
      } catch (e) {
        console.warn("[voyce] photo hash store failed (continuing):", e);
      }
    }

    return {
      ...result,
      reportedAt,
      ...(animals ? { animals } : {}),
    };
  });
