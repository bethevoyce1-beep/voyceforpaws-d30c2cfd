import { createServerFn } from "@tanstack/react-start";

// =============================================================================
// extractPost — turn a pasted rescue post (Facebook / Craigslist / a shelter's
// urgent list / a text message) into structured fields for a rescue card.
// Text-first, with an OPTIONAL photo.
//
// It reuses the SAME model client + config as analyzeImage in
// analyze.functions.ts (Google Gemini direct on the free tier, with Lovable's
// OpenAI-shaped gateway as a fallback). The prompt is deliberately strict:
// extract ONLY facts explicitly present in the text. Anything not stated is
// null. It must NEVER invent injuries, breeds, contacts, or locations — a
// rescue card built on made-up facts is worse than an empty one.
//
// Returns strict JSON:
// {
//   animals: [{ species, count, breed, notes }],
//   urgency,                         // only if stated
//   case_meta: { origin, rescue, source_url, deadline, ask }
// }
// =============================================================================

export type ExtractedAnimal = {
  species: string | null;
  count: number | null;
  breed: string | null;
  notes: string | null;
};

export type ExtractedCaseMeta = {
  origin: {
    shelter_name: string | null;
    city: string | null;
    state: string | null;
    address: string | null;
  } | null;
  rescue: {
    name: string | null;
    url: string | null;
    email: string | null;
    facebook: string | null;
    phone: string | null;
  } | null;
  source_url: string | null;
  deadline: string | null;
  ask: string | null;
};

export type ExtractedPost = {
  animals: ExtractedAnimal[];
  urgency: string | null;
  case_meta: ExtractedCaseMeta;
};

const SYSTEM = `You are an information-extraction assistant for an animal-rescue app called Voyce for Paws. You are given the raw TEXT of a social-media or classifieds post about an animal (or animals) that needs help — and, optionally, a photo. Your job is to pull out ONLY the facts that are explicitly stated.

ABSOLUTE RULES (a rescue card built on invented facts is worse than an empty one):
- Extract ONLY facts that are literally present in the text. Do NOT guess, infer, summarize beyond what is written, or fill gaps.
- If a field is not clearly stated, set it to null. Prefer null over a guess, always.
- NEVER invent or "clean up" injuries, medical conditions, breeds, ages, names, phone numbers, emails, URLs, shelter names, rescues, cities, or addresses. If it is not in the text, it is null.
- Copy contact details, URLs, and names verbatim from the text. Do not normalize or complete a partial phone/URL.
- The photo (if given) may confirm species or count, but must NOT be used to invent medical facts or contacts.
- "urgency" is only whatever urgency the TEXT states (e.g. "euthanasia today", "urgent", "code red", a due-out date). If the text states no urgency, urgency is null. Do not assign your own urgency.
- Output STRICT JSON only, matching the schema. No markdown, no code fences, no commentary.`;

const SCHEMA_HINT = `{
  "animals": [
    {
      "species": string | null,   // e.g. "dog", "cat" — only if stated
      "count": number | null,     // how many of this animal, if stated
      "breed": string | null,     // only if the post states a breed
      "notes": string | null      // short verbatim-ish detail actually in the text (name, sex, age, temperament). null if none.
    }
  ],
  "urgency": string | null,        // only urgency the text states, else null
  "case_meta": {
    "origin": {                    // where the animal physically is, if stated
      "shelter_name": string | null,
      "city": string | null,
      "state": string | null,
      "address": string | null
    } | null,
    "rescue": {                    // coordinating rescue / contact, if stated
      "name": string | null,
      "url": string | null,
      "email": string | null,
      "facebook": string | null,
      "phone": string | null
    } | null,
    "source_url": string | null,   // link to the original post, if present in the text
    "deadline": string | null,     // e.g. "today", a date/time the text gives
    "ask": string | null           // what is being asked for, if stated: e.g. "foster", "adopt", "transport", "pledge"
  }
}`;

// Guarantee the exact shape regardless of what the model returns, so callers can
// rely on the fields existing. Never throws.
function normalize(raw: unknown): ExtractedPost {
  const o = (raw ?? {}) as Record<string, unknown>;
  const str = (v: unknown): string | null => {
    if (typeof v !== "string") return null;
    const t = v.trim();
    return t && !/^(null|n\/a|unknown|none)$/i.test(t) ? t : null;
  };
  const num = (v: unknown): number | null => {
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string") {
      const n = parseInt(v, 10);
      return Number.isFinite(n) ? n : null;
    }
    return null;
  };
  const animalsIn = Array.isArray(o.animals) ? (o.animals as unknown[]) : [];
  const animals: ExtractedAnimal[] = animalsIn.map((a) => {
    const x = (a ?? {}) as Record<string, unknown>;
    return {
      species: str(x.species),
      count: num(x.count),
      breed: str(x.breed),
      notes: str(x.notes),
    };
  });
  const cmIn = (o.case_meta ?? {}) as Record<string, unknown>;
  const originIn = (cmIn.origin ?? {}) as Record<string, unknown>;
  const rescueIn = (cmIn.rescue ?? {}) as Record<string, unknown>;
  const origin = {
    shelter_name: str(originIn.shelter_name),
    city: str(originIn.city),
    state: str(originIn.state),
    address: str(originIn.address),
  };
  const rescue = {
    name: str(rescueIn.name),
    url: str(rescueIn.url),
    email: str(rescueIn.email),
    facebook: str(rescueIn.facebook),
    phone: str(rescueIn.phone),
  };
  const originHasAny = Object.values(origin).some((v) => v != null);
  const rescueHasAny = Object.values(rescue).some((v) => v != null);
  return {
    animals,
    urgency: str(o.urgency),
    case_meta: {
      origin: originHasAny ? origin : null,
      rescue: rescueHasAny ? rescue : null,
      source_url: str(cmIn.source_url),
      deadline: str(cmIn.deadline),
      ask: str(cmIn.ask),
    },
  };
}

export const extractPost = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => {
    const o = (input ?? {}) as { text?: string; imageDataUrl?: string };
    const text = typeof o.text === "string" ? o.text.trim().slice(0, 8000) : "";
    if (!text) throw new Error("text required");
    const imageDataUrl =
      typeof o.imageDataUrl === "string" && o.imageDataUrl.startsWith("data:image/")
        ? o.imageDataUrl
        : undefined;
    return { text, imageDataUrl };
  })
  .handler(async ({ data }): Promise<ExtractedPost> => {
    // Same key resolution as analyzeImage: Gemini direct (free tier), Lovable
    // gateway as fallback.
    const geminiKey = process.env.GEMINI_API_KEY;
    const lovableKey = process.env.LOVABLE_API_KEY;
    if (!geminiKey && !lovableKey) {
      throw new Error(
        "Missing AI key. Set GEMINI_API_KEY (recommended) or LOVABLE_API_KEY.",
      );
    }

    const systemInstruction = SYSTEM + "\n\nSchema:\n" + SCHEMA_HINT;
    const userText =
      "Extract the rescue facts from this post. Return ONLY the JSON object, no markdown.\n\nPOST TEXT:\n" +
      data.text;

    // Optional photo — parsed the same way analyzeImage does.
    let inline: { mimeType: string; base64: string } | null = null;
    if (data.imageDataUrl) {
      const m = data.imageDataUrl.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
      if (m) inline = { mimeType: m[1], base64: m[2] };
    }

    let content = "";

    if (geminiKey) {
      const models = ["gemini-2.5-flash", "gemini-2.5-flash-lite"];
      const parts: Record<string, unknown>[] = [{ text: userText }];
      if (inline) parts.push({ inlineData: { mimeType: inline.mimeType, data: inline.base64 } });
      const requestBody = JSON.stringify({
        systemInstruction: { parts: [{ text: systemInstruction }] },
        contents: [{ role: "user", parts }],
        generationConfig: { responseMimeType: "application/json", temperature: 0.1 },
      });
      const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

      let json:
        | { candidates?: { content?: { parts?: { text?: string }[] } }[] }
        | null = null;
      let sawRateLimit = false;
      let sawOverload = false;

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
            console.warn(`[voyce] extractPost ${model} fetch failed (attempt ${attempt}):`, e);
            sawOverload = true;
            if (attempt < MAX_ATTEMPTS) {
              await sleep(400 * attempt);
              continue;
            }
            break;
          }
          if (res.ok) {
            json = (await res.json()) as typeof json;
            break outer;
          }
          const status = res.status;
          const body = await res.text().catch(() => "");
          console.warn(`[voyce] extractPost ${model} ${status} (attempt ${attempt}): ${body.slice(0, 300)}`);
          if (status === 429) {
            sawRateLimit = true;
            break;
          }
          if (status === 500 || status === 502 || status === 503 || status === 504) {
            sawOverload = true;
            if (attempt < MAX_ATTEMPTS) {
              await sleep(500 * attempt);
              continue;
            }
            break;
          }
          throw new Error(
            "Voyce couldn't read that post right now. Please try again in a moment — nothing was lost.",
          );
        }
      }

      if (!json) {
        if (sawOverload) {
          throw new Error(
            "Voyce AI is experiencing high demand right now. Please try again in a moment — nothing was lost.",
          );
        }
        if (sawRateLimit) {
          throw new Error(
            "Voyce AI has reached today's free limit. Please try again in a little while — nothing was lost.",
          );
        }
        throw new Error(
          "Voyce AI is temporarily unavailable. Please try again in a moment — nothing was lost.",
        );
      }
      content = json.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    } else {
      // Legacy fallback: Lovable's OpenAI-shaped gateway.
      const contentParts: Record<string, unknown>[] = [{ type: "text", text: userText }];
      if (data.imageDataUrl) contentParts.push({ type: "image_url", image_url: { url: data.imageDataUrl } });
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
            { role: "user", content: contentParts },
          ],
          response_format: { type: "json_object" },
        }),
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Lovable gateway ${res.status}: ${body.slice(0, 300)}`);
      }
      const j = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      content = j.choices?.[0]?.message?.content ?? "";
    }

    let parsed: unknown;
    try {
      const cleaned = content.replace(/^```json\s*|\s*```$/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      throw new Error("Voyce couldn't read that post as structured facts. Please try again.");
    }
    return normalize(parsed);
  });
