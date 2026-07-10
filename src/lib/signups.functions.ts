import { createServerFn } from "@tanstack/react-start";

export type NetworkRole = "rescuer" | "foster" | "vet" | "shelter" | "animal_lover" | "volunteer" | "wildlife_rehabilitator";

export type SignupInput = {
  name?: string;
  email: string;
  zip: string;
  phone?: string;
  city?: string;
  roles: NetworkRole[];
  betaTester?: boolean;
  turnstileToken: string;
};

const ALLOWED_ROLES: NetworkRole[] = ["rescuer", "foster", "vet", "shelter", "animal_lover", "volunteer", "wildlife_rehabilitator"];

function isEmail(s: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
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

    if (!isEmail(email) || email.length > 255) throw new Error("Invalid email");
    if (!zip || zip.length > 16) throw new Error("Invalid ZIP");
    // Roles are optional — supporters can join with no role selected.
    if (!turnstileToken) throw new Error("Missing verification");

    return { name, email, zip, phone, city, roles, betaTester, turnstileToken };
  })
  .handler(async ({ data }) => {
    // Verify Turnstile server-side
    const secret = process.env.TURNSTILE_SECRET_KEY;
    if (secret) {
      const form = new URLSearchParams();
      form.set("secret", secret);
      form.set("response", data.turnstileToken);
      const res = await fetch(
        "https://challenges.cloudflare.com/turnstile/v0/siteverify",
        { method: "POST", body: form },
      );
      const json = (await res.json()) as { success?: boolean };
      if (!json?.success) throw new Error("Verification failed");
    }

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
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
