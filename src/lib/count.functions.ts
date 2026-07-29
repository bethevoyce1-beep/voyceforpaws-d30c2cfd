import { createServerFn } from "@tanstack/react-start";

// =============================================================
// countAnimals — a narrow, deterministic "how many animals?" self-check.
// A focused single-question call is far more reliable at catching a SECOND
// animal the main analysis collapsed (dark, in shadow, turned away, or
// overlapping the first) than the big all-in-one read. The card calls this
// after a single-animal report and, if the count comes back 2+, prompts a
// one-tap "add the other animal" fix. Best-effort: returns { count: 1 } on any
// failure so it can NEVER block, slow, or break a real rescue report.
// =============================================================

export const countAnimals = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => {
    const o = (input ?? {}) as { imageDataUrl?: string };
    const u =
      typeof o.imageDataUrl === "string" && o.imageDataUrl.startsWith("data:image/")
        ? o.imageDataUrl
        : "";
    return { imageDataUrl: u };
  })
  .handler(async ({ data }): Promise<{ count: number }> => {
    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey || !data.imageDataUrl) return { count: 1 };
    const m = data.imageDataUrl.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
    if (!m) return { count: 1 };
    try {
      const body = JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              { text: "How many distinct REAL animals are in this photo? Look hard for a SECOND animal that is dark, in shadow, turned away, partially cropped, or overlapping/touching another animal. Do NOT count toys, cushions, reflections, or people. Reply with ONLY this JSON: {\"count\": <integer>}." },
              { inlineData: { mimeType: m[1], data: m[2] } },
            ],
          },
        ],
        generationConfig: { responseMimeType: "application/json", temperature: 0 },
      });
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${encodeURIComponent(geminiKey)}`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body },
      );
      if (!res.ok) return { count: 1 };
      const j = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
      const t = j.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
      const p = JSON.parse(t.replace(/^```json\s*|\s*```$/g, "").trim()) as { count?: number };
      const n = Number(p?.count);
      return { count: Number.isFinite(n) && n >= 1 ? Math.min(Math.round(n), 6) : 1 };
    } catch {
      return { count: 1 };
    }
  });
