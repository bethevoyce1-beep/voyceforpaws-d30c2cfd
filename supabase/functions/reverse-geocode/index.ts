// Reverse-geocode { lat, lon } -> a street label with a precision signal.
//
// Tries Google Geocoding first, REUSING the existing `GOOGLE_MAPS_KEY` secret
// (the same key `shelter-lookup` uses for places.googleapis.com). If the key is
// missing, or Google declines (e.g. the Geocoding API isn't enabled yet ->
// status REQUEST_DENIED, or OVER_QUERY_LIMIT / ZERO_RESULTS), it falls back to
// OpenStreetMap Nominatim and explains why in `note`. It NEVER throws to the
// client — the app always gets a usable label.
//
// Deploy separately:  supabase functions deploy reverse-geocode
// (The project's Geocoding API may need enabling for rooftop precision; until
//  then this transparently serves Nominatim results.)

// CORS — same permissive block the other public edge functions use.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Result = {
  label: string;
  house_number: string | null;
  road: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  postal: string | null;
  // ROOFTOP | RANGE_INTERPOLATED | GEOMETRIC_CENTER | APPROXIMATE (Google)
  // or "approximate" (Nominatim fallback).
  precision: string;
  source: string; // "google" | "nominatim"
  note?: string;
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// deno-lint-ignore no-explicit-any
function pickGoogle(comp: any[], type: string): string | null {
  const c = comp.find((x) => Array.isArray(x.types) && x.types.includes(type));
  return c ? (c.short_name || c.long_name || null) : null;
}

function assemble(
  road: string | null,
  neighborhood: string | null,
  city: string | null,
  house_number: string | null,
  rooftop: boolean,
  fallback: string,
): string {
  const street = [rooftop ? house_number : null, road]
    .filter(Boolean)
    .join(" ")
    .trim();
  const place = street || road || neighborhood || null;
  const parts = [
    place,
    neighborhood && neighborhood !== place ? neighborhood : null,
    city,
  ].filter((p): p is string => Boolean(p));
  const seen = new Set<string>();
  const uniq = parts.filter((p) => (seen.has(p) ? false : (seen.add(p), true)));
  return uniq.length ? uniq.slice(0, 3).join(", ") : fallback;
}

async function fromNominatim(
  lat: number,
  lon: number,
  note?: string,
): Promise<Result> {
  const empty: Result = {
    label: "Your area",
    house_number: null,
    road: null,
    neighborhood: null,
    city: null,
    state: null,
    postal: null,
    precision: "approximate",
    source: "nominatim",
    note,
  };
  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&addressdetails=1&zoom=18&lat=${lat}&lon=${lon}`,
      {
        headers: {
          Accept: "application/json",
          "User-Agent": "voyce-for-paws/1.0 (reverse-geocode edge function)",
        },
      },
    );
    if (!r.ok) return { ...empty, note: note ?? `Nominatim HTTP ${r.status}` };
    const j = await r.json();
    const a = (j.address ?? {}) as Record<string, string>;
    const house_number = a.house_number ?? null;
    const road = a.road ?? a.pedestrian ?? null;
    const neighborhood =
      a.neighbourhood ?? a.suburb ?? a.quarter ?? a.city_district ?? null;
    const city =
      a.city ?? a.town ?? a.village ?? a.municipality ?? a.county ?? null;
    const state = a.state ?? null;
    const postal = a.postcode ?? null;
    // Nominatim is never rooftop-trustworthy for a house number (zoom=18 snaps
    // to the nearest known number), so we deliberately drop it: street + area.
    let label = assemble(road, neighborhood, city, house_number, false, "");
    if (!label && typeof j.display_name === "string") {
      label = j.display_name.split(",").slice(0, 2).join(",").trim();
    }
    return {
      label: label || "Your area",
      house_number,
      road,
      neighborhood,
      city,
      state,
      postal,
      precision: "approximate",
      source: "nominatim",
      note,
    };
  } catch (e) {
    return { ...empty, note: note ?? `Nominatim error: ${String(e)}` };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  try {
    const body = await req.json().catch(() => ({}));
    const latN = Number((body as { lat?: unknown }).lat);
    const lonN = Number((body as { lon?: unknown }).lon);
    if (!Number.isFinite(latN) || !Number.isFinite(lonN)) {
      return json({ error: "lat and lon are required numbers" }, 400);
    }

    const key = Deno.env.get("GOOGLE_MAPS_KEY") ?? "";
    if (!key) {
      return json(
        await fromNominatim(
          latN,
          lonN,
          "GOOGLE_MAPS_KEY not set — served OpenStreetMap Nominatim.",
        ),
      );
    }

    try {
      const url =
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latN},${lonN}&key=${encodeURIComponent(key)}`;
      const gr = await fetch(url);
      const gj = await gr.json();
      const status = String(gj.status ?? "UNKNOWN");
      if (status === "OK" && Array.isArray(gj.results) && gj.results.length) {
        const top = gj.results[0];
        const comp = top.address_components ?? [];
        const house_number = pickGoogle(comp, "street_number");
        const road = pickGoogle(comp, "route");
        const neighborhood =
          pickGoogle(comp, "neighborhood") ??
          pickGoogle(comp, "sublocality") ??
          pickGoogle(comp, "sublocality_level_1");
        const city =
          pickGoogle(comp, "locality") ??
          pickGoogle(comp, "postal_town") ??
          pickGoogle(comp, "administrative_area_level_2");
        const state = pickGoogle(comp, "administrative_area_level_1");
        const postal = pickGoogle(comp, "postal_code");
        const precision = String(top.geometry?.location_type ?? "APPROXIMATE");
        // Include the house number ONLY when Google is rooftop-accurate, so we
        // never print a precise-looking wrong number.
        const label = assemble(
          road,
          neighborhood,
          city,
          house_number,
          precision === "ROOFTOP",
          String(top.formatted_address ?? "Your area"),
        );
        return json({
          label,
          house_number,
          road,
          neighborhood,
          city,
          state,
          postal,
          precision,
          source: "google",
        } as Result);
      }
      // Google declined — fall back to Nominatim and say exactly why.
      const why =
        `Google Geocoding status=${status}` +
        (gj.error_message ? ` (${gj.error_message})` : "") +
        " — served OpenStreetMap Nominatim fallback.";
      return json(await fromNominatim(latN, lonN, why));
    } catch (e) {
      return json(
        await fromNominatim(
          latN,
          lonN,
          `Google Geocoding request failed: ${String(e)} — served Nominatim fallback.`,
        ),
      );
    }
  } catch (e) {
    // Absolute last resort — never throw to the client.
    return json({
      label: "Your area",
      house_number: null,
      road: null,
      neighborhood: null,
      city: null,
      state: null,
      postal: null,
      precision: "approximate",
      source: "nominatim",
      note: `Unexpected error: ${String(e)}`,
    });
  }
});
