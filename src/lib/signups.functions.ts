import { createServerFn } from "@tanstack/react-start";

export type NetworkRole = "rescuer" | "foster" | "vet" | "shelter" | "animal_lover" | "volunteer" | "wildlife_rehabilitator";

// Alert preferences captured at join time. Delivery (in-app / SMS) is wired
// separately; here we just store what each member wants.
export type AlertChannel = "in_app" | "text";
export type AlertUrgency = "last_chance" | "critical" | "atrisk";

export type SignupInput = {
  name?: string;
  email: string;
  zip: string;
  phone?: string;
  city?: string;
  roles: NetworkRole[];
  betaTester?: boolean;
  turnstileToken: string;
  // Alert preferences
  alertChannels?: AlertChannel[];
  alertBreeds?: string[];
  alertUrgency?: AlertUrgency;
  alertStates?: string[];
  alertPerDay?: number;
  smsConsent?: boolean;
};

const ALLOWED_ROLES: NetworkRole[] = ["rescuer", "foster", "vet", "shelter", "animal_lover", "volunteer", "wildlife_rehabilitator"];
const ALLOWED_CHANNELS: AlertChannel[] = ["in_app", "text"];
const ALLOWED_URGENCY: AlertUrgency[] = ["last_chance", "critical", "atrisk"];

// The MailerLite group new members are added to ("Voyce Pack — App Signups").
// Not a secret — just an identifier.
const MAILERLITE_GROUP_ID = "193253154197865708";

function isEmail(s: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

// SECURITY: network_signups no longer accepts inserts from the public
// (anon) key. Signups are written ONLY here, on the server, after the
// Turnstile human check passes, using the service-role admin client.
// Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in the host env.

// Best-effort mirror into MailerLite so the newsletter list grows.
// Turns on automatically once MAILERLITE_API_KEY is set in the host env;
// skips silently otherwise, and NEVER fails the signup.
async function syncToMailerLite(sub: {
  email: string;
  name?: string;
  city?: string;
}) {
  const key = process.env.MAILERLITE_API_KEY;
  if (!key) return;
  try {
    await fetch("https://connect.mailerlite.com/api/subscribers", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        email: sub.email,
        fields: {
          ...(sub.name ? { name: sub.name } : {}),
          ...(sub.city ? { city: sub.city } : {}),
        },
        groups: [MAILERLITE_GROUP_ID],
      }),
    });
  } catch (e) {
    console.warn("[voyce] MailerLite sync failed (continuing):", e);
  }
}

export const submitNetworkSignup = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => {
    const o = (input ?? {}) as Partial<SignupInput>;
    const name = o.name ? String(o.name).trim().slice(0, 120) : undefined;
    const email = String(o.email ?? "").trim().toLowerCase();
    const zip = String(o.zip ?? "").trim();
    const phone = o.phone ? String(o.phone).trim().slice(0, 40) : undefined;
    const city = o.city ? String(o.city).trim().slice(0, 80) : undefined;
    const roles = Array.isArray(o.roles)
      ? (o.roles.filter((r): r is NetworkRole =>
          ALLOWED_ROLES.includes(r as NetworkRole),
        ))
      : [];
    const betaTester = o.betaTester === true;
    const turnstileToken = String(o.turnstileToken ?? "");

    // Alert preferences — sanitize everything.
    const alertChannels = Array.isArray(o.alertChannels)
      ? o.alertChannels.filter((c): c is AlertChannel =>
          ALLOWED_CHANNELS.includes(c as AlertChannel),
        )
      : [];
    const alertUrgency: AlertUrgency = ALLOWED_URGENCY.includes(
      o.alertUrgency as AlertUrgency,
    )
      ? (o.alertUrgency as AlertUrgency)
      : "critical";
    const alertBreeds = Array.isArray(o.alertBreeds)
      ? o.alertBreeds
          .map((b) => String(b).trim().slice(0, 40))
          .filter(Boolean)
          .slice(0, 25)
      : [];
    const alertStates = Array.isArray(o.alertStates)
      ? o.alertStates
          .map((s) => String(s).trim().toUpperCase().slice(0, 2))
          .filter((s) => /^[A-Z]{2}$/.test(s))
          .slice(0, 50)
      : [];
    const alertPerDayRaw = Number(o.alertPerDay);
    const alertPerDay = Number.isFinite(alertPerDayRaw)
      ? Math.min(24, Math.max(0, Math.round(alertPerDayRaw)))
      : 0;
    const smsConsent = o.smsConsent === true;

    if (!isEmail(email) || email.length > 255) throw new Error("Invalid email");
    if (!zip || zip.length > 16) throw new Error("Invalid ZIP");
    // Roles are optional — supporters can join with no role selected.
    if (!turnstileToken || turnstileToken.length > 4096) {
      throw new Error("Missing verification");
    }

    return {
      name,
      email,
      zip,
      phone,
      city,
      roles,
      betaTester,
      turnstileToken,
      alertChannels,
      alertBreeds,
      alertUrgency,
      alertStates,
      alertPerDay,
      smsConsent,
    };
  })
  .handler(async ({ data }) => {
    // Verify Turnstile server-side. FAIL CLOSED: if the secret is missing,
    // refuse the signup rather than silently skipping the human check.
    const secret = process.env.TURNSTILE_SECRET_KEY;
    if (!secret) {
      console.error("[voyce] TURNSTILE_SECRET_KEY is not set — refusing signup");
      throw new Error("Signups are temporarily unavailable. Please try again later.");
    }
    const form = new URLSearchParams();
    form.set("secret", secret);
    form.set("response", data.turnstileToken);
    const res = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      { method: "POST", body: form },
    );
    const json = (await res.json()) as { success?: boolean };
    if (!json?.success) throw new Error("Verification failed");

    // Only keep SMS as a channel if the member actually consented to texts.
    const channels = data.smsConsent
      ? data.alertChannels
      : data.alertChannels.filter((c) => c !== "text");

    // Server-only admin client (loaded inside the handler so the service-role
    // key never ships to the browser bundle).
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("network_signups").insert({
      name: data.name ?? null,
      email: data.email,
      zip: data.zip || null,
      phone: data.phone ?? null,
      city: data.city ?? null,
      roles: data.roles,
      beta_tester: data.betaTester ?? false,
      source: "shareable_card",
      alert_channels: channels.length ? channels : ["in_app"],
      alert_breeds: data.alertBreeds,
      alert_urgency: data.alertUrgency,
      alert_states: data.alertStates,
      alert_per_day: data.alertPerDay,
      sms_consent: data.smsConsent,
    });
    if (error) {
      console.error("[voyce] signup insert failed:", error.message);
      throw new Error("Could not complete signup. Please try again.");
    }

    // Mirror to MailerLite (best-effort; never blocks the signup).
    await syncToMailerLite({ email: data.email, name: data.name, city: data.city });

    return { ok: true };
  });
