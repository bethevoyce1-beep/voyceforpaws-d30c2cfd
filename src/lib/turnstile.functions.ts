import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader, getRequestIP } from "@tanstack/react-start/server";

type VerifyResult = {
  success: boolean;
  challenge_ts?: string;
  hostname?: string;
  action?: string;
  cdata?: string;
  "error-codes"?: string[];
};

/**
 * Verify a Cloudflare Turnstile token server-side.
 * Returns { ok: true } when verification passes; throws on failure so the
 * caller can refuse to submit the report.
 */
export const verifyTurnstile = createServerFn({ method: "POST" })
  .inputValidator((data: { token: string }) => {
    if (!data || typeof data.token !== "string" || data.token.length === 0) {
      throw new Error("Missing Turnstile token");
    }
    if (data.token.length > 4096) throw new Error("Token too long");
    return data;
  })
  .handler(async ({ data }) => {
    const secret = process.env.TURNSTILE_SECRET_KEY;
    if (!secret) {
      console.error("[turnstile] TURNSTILE_SECRET_KEY is not set");
      throw new Error("Captcha not configured");
    }

    const body = new URLSearchParams();
    body.set("secret", secret);
    body.set("response", data.token);
    try {
      const ip =
        getRequestHeader("cf-connecting-ip") ??
        getRequestIP({ xForwardedFor: true });
      if (ip) body.set("remoteip", ip);
    } catch {
      /* IP optional */
    }

    const res = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      { method: "POST", body },
    );
    const json = (await res.json()) as VerifyResult;

    if (!json.success) {
      const codes = (json["error-codes"] ?? []).join(",") || "unknown";
      console.warn("[turnstile] verification failed:", codes);
      throw new Error("Captcha verification failed");
    }

    return { ok: true as const, hostname: json.hostname, ts: json.challenge_ts };
  });
