import { createServerFn } from "@tanstack/react-start";

// ============================================================
// Phase 2 admin (moderation) server functions.
//
// These run with the service role and are gated by the ADMIN_FOLLOWUP_SECRET
// passphrase — the same gate as Phase 1 admin posting. Partners themselves do
// NOT use these; partners sign in and submit through the browser (RLS lets an
// approved partner insert a `pending` follow-up under their own name). These
// endpoints are only for YOU to review and approve partners + their updates.
// ============================================================

export type PendingPartner = {
  id: string;
  email: string;
  org_name: string | null;
  contact_name: string | null;
  status: string;
  created_at: string;
};

export type PendingFollowup = {
  id: string;
  animal_id: string;
  animal_name: string;
  outcome: string;
  partner_name: string | null;
  posted_by_name: string | null;
  posted_by_email: string | null;
  note: string | null;
  photo_url: string | null;
  occurred_on: string;
  created_at: string;
};

export type ModerationQueue = {
  partners: PendingPartner[];
  followups: PendingFollowup[];
};

// Constant-time string comparison — avoids leaking the secret's length/prefix
// via response-timing differences during a brute-force attempt.
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Gate admin endpoints on the shared passphrase. Hardened: constant-time
// compare, a single GENERIC error (never reveals whether the passphrase was
// wrong vs. unset), and a randomized delay on failure to throttle brute force.
async function assertSecret(secret: string) {
  const expected = process.env.ADMIN_FOLLOWUP_SECRET;
  if (!expected || !secret || !safeEqual(secret, expected)) {
    // Slow down guessing; jitter so the delay itself isn't a reliable signal.
    await new Promise((r) => setTimeout(r, 700 + Math.floor(Math.random() * 500)));
    throw new Error("Not authorized.");
  }
}

export const adminModerationQueue = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => {
    const o = (input ?? {}) as { secret?: string };
    return { secret: typeof o.secret === "string" ? o.secret : "" };
  })
  .handler(async ({ data }): Promise<ModerationQueue> => {
    await assertSecret(data.secret);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: pRows, error: pErr } = await supabaseAdmin
      .from("acs_partners")
      .select("id, email, org_name, contact_name, status, created_at")
      .order("created_at", { ascending: false });
    if (pErr) throw new Error(pErr.message);

    const { data: fRows, error: fErr } = await supabaseAdmin
      .from("acs_followups")
      .select(
        "id, animal_id, outcome, partner_name, posted_by_name, posted_by_email, note, photo_url, occurred_on, created_at",
      )
      .eq("moderation", "pending")
      .order("created_at", { ascending: true });
    if (fErr) throw new Error(fErr.message);

    // Attach the animal name for each pending follow-up.
    const ids = Array.from(new Set((fRows ?? []).map((r) => String((r as Record<string, unknown>).animal_id))));
    const nameById = new Map<string, string>();
    if (ids.length > 0) {
      const { data: aRows } = await supabaseAdmin
        .from("acs_animals")
        .select("id, name")
        .in("id", ids);
      for (const a of aRows ?? []) {
        const row = a as Record<string, unknown>;
        nameById.set(String(row.id), (row.name as string | null) ?? "Unnamed");
      }
    }

    const partners: PendingPartner[] = (pRows ?? []).map((r) => {
      const row = r as Record<string, unknown>;
      return {
        id: String(row.id),
        email: (row.email as string | null) ?? "",
        org_name: (row.org_name as string | null) ?? null,
        contact_name: (row.contact_name as string | null) ?? null,
        status: (row.status as string | null) ?? "pending",
        created_at: String(row.created_at),
      };
    });

    const followups: PendingFollowup[] = (fRows ?? []).map((r) => {
      const row = r as Record<string, unknown>;
      const aid = String(row.animal_id);
      return {
        id: String(row.id),
        animal_id: aid,
        animal_name: nameById.get(aid) ?? aid,
        outcome: (row.outcome as string | null) ?? "unknown",
        partner_name: (row.partner_name as string | null) ?? null,
        posted_by_name: (row.posted_by_name as string | null) ?? null,
        posted_by_email: (row.posted_by_email as string | null) ?? null,
        note: (row.note as string | null) ?? null,
        photo_url: (row.photo_url as string | null) ?? null,
        occurred_on: String(row.occurred_on),
        created_at: String(row.created_at),
      };
    });

    return { partners, followups };
  });

export const adminSetPartnerStatus = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => {
    const o = (input ?? {}) as { secret?: string; partnerId?: string; status?: string };
    const status = (o.status ?? "").trim();
    if (!o.partnerId || typeof o.partnerId !== "string") throw new Error("partnerId required");
    if (status !== "approved" && status !== "blocked" && status !== "pending") {
      throw new Error("Invalid status");
    }
    return {
      secret: typeof o.secret === "string" ? o.secret : "",
      partnerId: o.partnerId,
      status,
    };
  })
  .handler(async ({ data }): Promise<{ ok: true }> => {
    await assertSecret(data.secret);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: Record<string, unknown> = { status: data.status };
    patch.approved_at = data.status === "approved" ? new Date().toISOString() : null;
    const { error } = await supabaseAdmin
      .from("acs_partners")
      .update(patch)
      .eq("id", data.partnerId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminSetFollowupModeration = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => {
    const o = (input ?? {}) as { secret?: string; followupId?: string; moderation?: string };
    const moderation = (o.moderation ?? "").trim();
    if (!o.followupId || typeof o.followupId !== "string") throw new Error("followupId required");
    if (moderation !== "approved" && moderation !== "rejected") {
      throw new Error("Invalid moderation state");
    }
    return {
      secret: typeof o.secret === "string" ? o.secret : "",
      followupId: o.followupId,
      moderation,
    };
  })
  .handler(async ({ data }): Promise<{ ok: true }> => {
    await assertSecret(data.secret);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("acs_followups")
      .update({ moderation: data.moderation })
      .eq("id", data.followupId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
