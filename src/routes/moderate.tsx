import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  adminModerationQueue,
  adminSetPartnerStatus,
  adminSetFollowupModeration,
  type ModerationQueue,
} from "@/lib/partners.functions";

export const Route = createFileRoute("/moderate")({
  head: () => ({
    meta: [
      { title: "Moderation — Voyce for Paws" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ModeratePage,
});

const GOLD = "#FFDF3B";
const PAPER = "#FAF8F5";
const INK = "#1A1611";

const OUTCOME_LABEL: Record<string, string> = {
  pulled: "Pulled by rescue",
  in_foster: "In foster",
  adopted: "Adopted",
  reclaimed: "Reclaimed by owner",
  transferred: "Transferred",
  passed: "Passed away",
  returned: "Returned",
  unknown: "Update",
};

function ModeratePage() {
  const [secret, setSecret] = useState("");
  const [queue, setQueue] = useState<ModerationQueue | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = async (s: string) => {
    setBusy(true);
    setErr(null);
    try {
      const q = await adminModerationQueue({ data: { secret: s } });
      setQueue(q);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't load the queue.");
      setQueue(null);
    } finally {
      setBusy(false);
    }
  };

  const setPartner = async (partnerId: string, status: string) => {
    try {
      await adminSetPartnerStatus({ data: { secret, partnerId, status } });
      await load(secret);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Action failed.");
    }
  };

  const setFollowup = async (followupId: string, moderation: string) => {
    try {
      await adminSetFollowupModeration({ data: { secret, followupId, moderation } });
      await load(secret);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Action failed.");
    }
  };

  const pendingPartners = (queue?.partners ?? []).filter((p) => p.status === "pending");
  const otherPartners = (queue?.partners ?? []).filter((p) => p.status !== "pending");

  const field =
    "w-full rounded-lg border border-[#E3DAC4] bg-white px-3 py-2 text-[14px] outline-none focus:border-[#C9871A]";
  const btn = "rounded-full px-3 py-1 text-[12px] font-bold transition active:scale-95";

  return (
    <div style={{ minHeight: "100dvh", background: PAPER }}>
      <main className="mx-auto w-full max-w-[560px] px-5 py-8" style={{ color: INK }}>
        <Link to="/" className="text-[12px] font-medium uppercase tracking-[0.14em] text-[#8A5A0E]">
          ← Back to Voyce
        </Link>
        <h1 className="mt-3 font-serif text-[24px] font-bold leading-tight">Moderation</h1>
        <p className="mt-1 text-[13.5px] leading-relaxed text-muted-foreground">
          Approve trusted partners and review their follow-up updates before they appear publicly.
        </p>

        {!queue && (
          <div className="mt-6 space-y-2">
            <input
              type="password"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && load(secret)}
              placeholder="Admin passphrase"
              className={field}
            />
            <button
              onClick={() => void load(secret)}
              disabled={busy || !secret}
              className="w-full rounded-lg py-2.5 text-[13px] font-bold disabled:opacity-50"
              style={{ background: GOLD, color: "#3A2A07" }}
            >
              {busy ? "Loading…" : "Open queue"}
            </button>
            {err && <p className="text-[12px] font-semibold text-destructive">{err}</p>}
          </div>
        )}

        {queue && (
          <div className="mt-6 space-y-6">
            {err && <p className="text-[12px] font-semibold text-destructive">{err}</p>}

            <section>
              <h2 className="mb-2 font-serif text-[16px] font-bold">
                Partner requests
                <span className="ml-2 text-[12px] font-semibold text-muted-foreground">{pendingPartners.length} pending</span>
              </h2>
              {pendingPartners.length === 0 && (
                <p className="text-[13px] text-muted-foreground">No pending requests.</p>
              )}
              <div className="space-y-2">
                {pendingPartners.map((p) => (
                  <div key={p.id} className="rounded-xl border border-border bg-white p-3">
                    <div className="text-[14px] font-semibold">{p.org_name || "(no org name)"}</div>
                    <div className="text-[12.5px] text-muted-foreground">
                      {p.contact_name ? `${p.contact_name} · ` : ""}{p.email}
                    </div>
                    <div className="mt-2 flex gap-2">
                      <button onClick={() => void setPartner(p.id, "approved")} className={btn} style={{ background: "#D1FAE5", color: "#065F46" }}>
                        Approve
                      </button>
                      <button onClick={() => void setPartner(p.id, "blocked")} className={btn} style={{ background: "#FEE2E2", color: "#991B1B" }}>
                        Decline
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h2 className="mb-2 font-serif text-[16px] font-bold">
                Updates to review
                <span className="ml-2 text-[12px] font-semibold text-muted-foreground">{queue.followups.length} pending</span>
              </h2>
              {queue.followups.length === 0 && (
                <p className="text-[13px] text-muted-foreground">Nothing waiting for review.</p>
              )}
              <div className="space-y-2">
                {queue.followups.map((f) => (
                  <div key={f.id} className="rounded-xl border border-border bg-white p-3">
                    <div className="text-[14px] font-semibold">
                      {f.animal_name} <span className="text-[11px] font-normal text-muted-foreground">· {f.animal_id}</span>
                    </div>
                    <div className="text-[13px]" style={{ color: "#3A2A07" }}>
                      {OUTCOME_LABEL[f.outcome] ?? f.outcome} · {f.occurred_on}
                    </div>
                    <div className="text-[12px] text-muted-foreground">
                      by {f.partner_name || f.posted_by_name || f.posted_by_email || "partner"}
                    </div>
                    {f.note && <p className="mt-1 text-[12.5px] text-[#374151]">{f.note}</p>}
                    <div className="mt-2 flex gap-2">
                      <button onClick={() => void setFollowup(f.id, "approved")} className={btn} style={{ background: "#D1FAE5", color: "#065F46" }}>
                        Approve · publish
                      </button>
                      <button onClick={() => void setFollowup(f.id, "rejected")} className={btn} style={{ background: "#FEE2E2", color: "#991B1B" }}>
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {otherPartners.length > 0 && (
              <section>
                <h2 className="mb-2 font-serif text-[16px] font-bold">All partners</h2>
                <div className="space-y-1.5">
                  {otherPartners.map((p) => (
                    <div key={p.id} className="flex items-center justify-between rounded-lg border border-border bg-white px-3 py-2 text-[12.5px]">
                      <span>
                        {p.org_name || p.email}
                        <span className="ml-2 text-[11px] text-muted-foreground">{p.status}</span>
                      </span>
                      <div className="flex gap-1.5">
                        {p.status !== "approved" && (
                          <button onClick={() => void setPartner(p.id, "approved")} className={btn} style={{ background: "#D1FAE5", color: "#065F46" }}>
                            Approve
                          </button>
                        )}
                        {p.status !== "blocked" && (
                          <button onClick={() => void setPartner(p.id, "blocked")} className={btn} style={{ background: "#F3F4F6", color: "#374151" }}>
                            Block
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <button onClick={() => void load(secret)} className="text-[12px] font-semibold text-[#8A5A0E] underline">
              Refresh queue
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
