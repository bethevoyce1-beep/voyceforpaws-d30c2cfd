import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { partnerSupabase } from "@/integrations/supabase/client.partner";

export const Route = createFileRoute("/partner")({
  head: () => ({
    meta: [
      { title: "Partner portal — Voyce for Paws" },
      { name: "description", content: "Trusted rescue and foster partners sign in to post follow-up updates on animals they've taken." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PartnerPortal,
});

const GOLD = "#FFDF3B";
const PAPER = "#FAF8F5";
const INK = "#1A1611";

type PartnerRow = { id: string; status: string; org_name: string | null; contact_name: string | null };
type Animal = { id: string; name: string; breed: string | null; kennel: string | null };
type MyFollowup = { id: string; animal_id: string; outcome: string; occurred_on: string; moderation: string; note: string | null };

const OUTCOMES: { v: string; label: string }[] = [
  { v: "pulled", label: "Pulled by rescue" },
  { v: "in_foster", label: "In foster" },
  { v: "adopted", label: "Adopted" },
  { v: "reclaimed", label: "Reclaimed by owner" },
  { v: "transferred", label: "Transferred" },
  { v: "passed", label: "Passed away" },
  { v: "returned", label: "Returned" },
  { v: "unknown", label: "Other update" },
];

const MOD_LABEL: Record<string, string> = {
  pending: "Pending review",
  approved: "Published",
  rejected: "Not published",
};

const field =
  "w-full rounded-lg border border-[#E3DAC4] bg-white px-3 py-2 text-[14px] outline-none focus:border-[#C9871A]";

function PartnerPortal() {
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [partner, setPartner] = useState<PartnerRow | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const refreshPartner = async (uid: string) => {
    const { data } = await partnerSupabase
      .from("acs_partners")
      .select("id, status, org_name, contact_name")
      .eq("user_id", uid)
      .maybeSingle();
    setPartner((data as PartnerRow) ?? null);
  };

  useEffect(() => {
    let alive = true;
    partnerSupabase.auth.getSession().then(async ({ data }) => {
      const session = data.session;
      if (!alive) return;
      if (session?.user) {
        setEmail(session.user.email ?? null);
        await refreshPartner(session.user.id);
      }
      setReady(true);
    });
    const { data: sub } = partnerSupabase.auth.onAuthStateChange((_evt, session) => {
      if (!alive) return;
      if (session?.user) {
        setEmail(session.user.email ?? null);
        void refreshPartner(session.user.id);
      } else {
        setEmail(null);
        setPartner(null);
      }
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await partnerSupabase.auth.signOut();
    setEmail(null);
    setPartner(null);
    setMsg(null);
  };

  return (
    <div style={{ minHeight: "100dvh", background: PAPER }}>
      <main className="mx-auto w-full max-w-[460px] px-5 py-8" style={{ color: INK }}>
        <Link to="/" className="text-[12px] font-medium uppercase tracking-[0.14em] text-[#8A5A0E]">
          ← Back to Voyce
        </Link>
        <h1 className="mt-3 font-serif text-[24px] font-bold leading-tight">Partner portal</h1>
        <p className="mt-1 text-[13.5px] leading-relaxed text-muted-foreground">
          For trusted rescue and foster partners to post follow-up updates on animals you've taken. Updates are
          reviewed by Voyce before they appear publicly.
        </p>

        {!ready && <p className="mt-6 text-[13px] text-muted-foreground">Loading…</p>}

        {ready && !email && <SignIn onMsg={setMsg} msg={msg} />}

        {ready && email && !partner && (
          <RequestAccess email={email} onDone={(p) => setPartner(p)} onSignOut={signOut} />
        )}

        {ready && email && partner && partner.status === "pending" && (
          <StatusCard
            email={email}
            onSignOut={signOut}
            tone="wait"
            title="Request received"
            body="Your request to become a trusted partner is pending Voyce's approval. You'll be able to post updates once approved."
          />
        )}

        {ready && email && partner && partner.status === "blocked" && (
          <StatusCard
            email={email}
            onSignOut={signOut}
            tone="stop"
            title="Access paused"
            body="Your partner access is currently paused. Please reach out to Voyce if you think this is a mistake."
          />
        )}

        {ready && email && partner && partner.status === "approved" && (
          <ApprovedPartner email={email} partner={partner} onSignOut={signOut} />
        )}
      </main>
    </div>
  );
}

function SignIn({ onMsg, msg }: { onMsg: (m: string | null) => void; msg: string | null }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const send = async () => {
    const e = email.trim();
    if (!e || busy) return;
    setBusy(true);
    onMsg(null);
    try {
      const redirect =
        typeof window !== "undefined" ? `${window.location.origin}/partner` : undefined;
      const { error } = await partnerSupabase.auth.signInWithOtp({
        email: e,
        options: { emailRedirectTo: redirect },
      });
      if (error) throw error;
      setSent(true);
    } catch (err) {
      onMsg(err instanceof Error ? err.message : "Couldn't send the sign-in link.");
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <div className="mt-6 rounded-xl border border-[#F0E4C6] bg-[#FFFDF7] p-4">
        <p className="text-[15px] font-bold text-[#3A2A07]">Check your email</p>
        <p className="mt-1 text-[13.5px] leading-relaxed text-muted-foreground">
          We sent a one-tap sign-in link to <span className="font-semibold">{email}</span>. Open it on this
          device to continue.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-2">
      <label htmlFor="pemail" className="text-[13px] font-semibold text-[#6B5832]">
        Sign in with your email
      </label>
      <input
        id="pemail"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && send()}
        placeholder="you@rescue.org"
        className={field}
      />
      <button
        onClick={() => void send()}
        disabled={busy || !email.trim()}
        className="w-full rounded-lg py-2.5 text-[13px] font-bold disabled:opacity-50"
        style={{ background: GOLD, color: "#3A2A07" }}
      >
        {busy ? "Sending…" : "Email me a sign-in link"}
      </button>
      {msg && <p className="text-[12px] font-semibold text-destructive">{msg}</p>}
      <p className="text-[12px] leading-relaxed text-muted-foreground">
        No password needed — we email you a secure one-tap link.
      </p>
    </div>
  );
}

function RequestAccess({
  email,
  onDone,
  onSignOut,
}: {
  email: string;
  onDone: (p: PartnerRow) => void;
  onSignOut: () => void;
}) {
  const [org, setOrg] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      const { data: sess } = await partnerSupabase.auth.getSession();
      const uid = sess.session?.user.id;
      if (!uid) throw new Error("Session expired — please sign in again.");
      const { data, error } = await partnerSupabase
        .from("acs_partners")
        .insert({ user_id: uid, email, org_name: org.trim() || null, contact_name: name.trim() || null, status: "pending" })
        .select("id, status, org_name, contact_name")
        .single();
      if (error) throw error;
      onDone(data as PartnerRow);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't submit your request.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-6 space-y-2">
      <p className="text-[13.5px] text-muted-foreground">
        Signed in as <span className="font-semibold text-[#3A2A07]">{email}</span>.{" "}
        <button onClick={onSignOut} className="underline">Sign out</button>
      </p>
      <p className="mt-2 text-[15px] font-bold text-[#3A2A07]">Request partner access</p>
      <input value={org} onChange={(e) => setOrg(e.target.value)} placeholder="Rescue / foster org name" className={field} />
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" className={field} />
      <button
        onClick={() => void submit()}
        disabled={busy}
        className="w-full rounded-lg py-2.5 text-[13px] font-bold disabled:opacity-50"
        style={{ background: GOLD, color: "#3A2A07" }}
      >
        {busy ? "Submitting…" : "Request access"}
      </button>
      {err && <p className="text-[12px] font-semibold text-destructive">{err}</p>}
    </div>
  );
}

function StatusCard({
  email,
  onSignOut,
  tone,
  title,
  body,
}: {
  email: string;
  onSignOut: () => void;
  tone: "wait" | "stop";
  title: string;
  body: string;
}) {
  const bg = tone === "stop" ? "#FEF2F2" : "#FFFDF7";
  const border = tone === "stop" ? "#FECACA" : "#F0E4C6";
  return (
    <div className="mt-6">
      <div className="rounded-xl border p-4" style={{ background: bg, borderColor: border }}>
        <p className="text-[15px] font-bold text-[#3A2A07]">{title}</p>
        <p className="mt-1 text-[13.5px] leading-relaxed text-muted-foreground">{body}</p>
      </div>
      <p className="mt-3 text-[12.5px] text-muted-foreground">
        Signed in as {email}. <button onClick={onSignOut} className="underline">Sign out</button>
      </p>
    </div>
  );
}

function ApprovedPartner({
  email,
  partner,
  onSignOut,
}: {
  email: string;
  partner: PartnerRow;
  onSignOut: () => void;
}) {
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [q, setQ] = useState("");
  const [animalId, setAnimalId] = useState("");
  const [outcome, setOutcome] = useState("in_foster");
  const [occurredOn, setOccurredOn] = useState("");
  const [note, setNote] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [mine, setMine] = useState<MyFollowup[]>([]);

  const loadMine = async () => {
    const { data } = await partnerSupabase
      .from("acs_followups")
      .select("id, animal_id, outcome, occurred_on, moderation, note")
      .eq("partner_id", partner.id)
      .order("created_at", { ascending: false });
    setMine((data as MyFollowup[]) ?? []);
  };

  useEffect(() => {
    partnerSupabase
      .from("acs_animals")
      .select("id, name, breed, kennel")
      .order("name", { ascending: true })
      .then(({ data }) => setAnimals((data as Animal[]) ?? []));
    void loadMine();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    const base = s
      ? animals.filter((a) =>
          [a.name, a.id, a.breed, a.kennel].filter(Boolean).some((v) => String(v).toLowerCase().includes(s)),
        )
      : animals;
    return base.slice(0, 50);
  }, [animals, q]);

  const submit = async () => {
    if (busy) return;
    if (!animalId) {
      setMsg("Pick an animal first.");
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const row: Record<string, unknown> = {
        animal_id: animalId,
        outcome,
        partner_id: partner.id,
        partner_name: partner.org_name,
        posted_by_name: partner.contact_name,
        posted_by_email: email,
        note: note.trim() || null,
        photo_url: photoUrl.trim().startsWith("http") ? photoUrl.trim() : null,
        moderation: "pending",
      };
      if (occurredOn) row.occurred_on = occurredOn;
      const { error } = await partnerSupabase.from("acs_followups").insert(row);
      if (error) throw error;
      setMsg("Submitted for review ✓ — it'll appear publicly once Voyce approves it.");
      setNote("");
      setPhotoUrl("");
      void loadMine();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Couldn't submit the update.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-6 space-y-3">
      <p className="text-[12.5px] text-muted-foreground">
        Signed in as <span className="font-semibold text-[#3A2A07]">{partner.org_name || email}</span> ·{" "}
        <button onClick={onSignOut} className="underline">Sign out</button>
      </p>

      <div className="rounded-xl border border-[#F0E4C6] bg-[#FFFDF7] p-4 space-y-2">
        <p className="text-[15px] font-bold text-[#3A2A07]">Post a follow-up</p>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search an animal by name, ID, breed, kennel" className={field} />
        <select value={animalId} onChange={(e) => setAnimalId(e.target.value)} className={field}>
          <option value="">— pick an animal —</option>
          {filtered.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} {a.breed ? `(${a.breed})` : ""} · {a.id}
            </option>
          ))}
        </select>
        <select value={outcome} onChange={(e) => setOutcome(e.target.value)} className={field}>
          {OUTCOMES.map((o) => (
            <option key={o.v} value={o.v}>{o.label}</option>
          ))}
        </select>
        <input type="date" value={occurredOn} onChange={(e) => setOccurredOn(e.target.value)} className={field} />
        <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" rows={2} className={field} />
        <input value={photoUrl} onChange={(e) => setPhotoUrl(e.target.value)} placeholder="Photo URL (optional)" className={field} />
        <button
          onClick={() => void submit()}
          disabled={busy}
          className="w-full rounded-lg py-2.5 text-[13px] font-bold disabled:opacity-50"
          style={{ background: GOLD, color: "#3A2A07" }}
        >
          {busy ? "Submitting…" : "Submit for review"}
        </button>
        {msg && <p className="text-center text-[12px] font-semibold text-[#6B5832]">{msg}</p>}
      </div>

      {mine.length > 0 && (
        <div>
          <p className="mb-2 text-[12px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Your updates</p>
          <div className="space-y-1.5">
            {mine.map((f) => (
              <div key={f.id} className="flex items-center justify-between rounded-lg border border-border bg-white px-3 py-2 text-[12.5px]">
                <span>{OUTCOMES.find((o) => o.v === f.outcome)?.label ?? f.outcome} · {f.occurred_on}</span>
                <span
                  className="rounded-full px-2 py-0.5 text-[10.5px] font-bold"
                  style={
                    f.moderation === "approved"
                      ? { background: "#D1FAE5", color: "#065F46" }
                      : f.moderation === "rejected"
                        ? { background: "#FEE2E2", color: "#991B1B" }
                        : { background: "#FEF3C7", color: "#92400E" }
                  }
                >
                  {MOD_LABEL[f.moderation] ?? f.moderation}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
