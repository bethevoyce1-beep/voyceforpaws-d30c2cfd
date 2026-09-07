import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  addNetworkResponse,
  listNetworkResponses,
  type NetworkResponse,
} from "@/lib/network.functions";

// =============================================================
// NetworkResponses — the shared "Can you help? + How the network responds"
// block. It does BOTH jobs in one place:
//   1) Commitment — a viewer enters their name once, taps how they can help
//      (Foster, Adopt, Rescue pull, Transport, Pledge, Good Samaritan, …), then
//      a popup asks what they can do + what ELSE is still needed to get the
//      animal all the way to safety, and where they're at (status).
//   2) Live pack feed — that commitment posts to a shared feed so EVERYONE
//      watching this animal sees the pack step up in real time, e.g.
//      "Rachna · Offered · can foster · still needs a rescue and an adopter".
// Persisted in Supabase (network_responses), keyed by animal. A "➕ Other" pill
// opens a sheet with the less-common paths (shelter transfer, vet, trainer,
// boarding) plus a free-text "Something else" field — and those now open the
// same needs + status popup too.
//
// It also EXPLAINS itself (a short "this is the pack, live" intro) and offers a
// "Join the pack / Donate" footer (hide with showJoinCta={false}).
// =============================================================

const NAME_KEY = "voyce_responder_name";
const GOLD = "linear-gradient(135deg,#FFDF3B,#C9871A)";

function cap(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

// Join a list of phrases as "a", "a and b", or "a, b and c".
function joinNice(list: string[]): string {
  if (list.length === 0) return "";
  if (list.length === 1) return list[0];
  return list.slice(0, -1).join(", ") + " and " + list[list.length - 1];
}

type KindMeta = { label: string; dot: string; icon?: string; chip?: string };
const KINDS: Record<string, KindMeta> = {
  adopt:          { label: "wants to adopt", dot: "#993556", icon: "🤝", chip: "Adopt" },
  rescue:         { label: "will pull · rescue partner", dot: "#7C3AED", icon: "🐾", chip: "Rescue pull" },
  foster_rescue:  { label: "can foster", dot: "#12805C", icon: "🏠", chip: "Foster" },
  transport:      { label: "can transport", dot: "#2563EB", icon: "🚚", chip: "Transport" },
  pledge:         { label: "pledged funds toward the pull", dot: "#0F6E56", icon: "💵", chip: "Pledge" },
  share:          { label: "shared to the network", dot: "#8A8175", icon: "📣", chip: "Share" },
  good_samaritan: { label: "can help nearby", dot: "#0891B2", icon: "🙌", chip: "Samaritan" },
  foster_acs:     { label: "can foster · can pick up nearby", dot: "#8A5A0E" },
  transfer:       { label: "another shelter can take · transfer", dot: "#185FA5", icon: "🏢", chip: "Shelter transfer" },
  vet:            { label: "can help with vet care", dot: "#0F766E", icon: "🩺", chip: "Vet care" },
  trainer:        { label: "can help with training · behavior", dot: "#7C3AED", icon: "🎓", chip: "Trainer" },
  boarding:       { label: "can offer boarding · temporary space", dot: "#B45309", icon: "🛏", chip: "Boarding" },
  other:          { label: "wants to help", dot: "#8A5A0E" },
};

// Where a helper is in their commitment — an optional, evolving progress marker
// shown as a small colored pill in the live feed. Distinct from `kind` (WHAT
// they offered) and `detail` (what's still needed). Null for older rows and for
// one-off actions like a share.
type StatusMeta = { label: string; bg: string };
const STATUSES: { id: string; label: string }[] = [
  { id: "offered",    label: "Offered" },
  { id: "on_the_way", label: "On the way" },
  { id: "confirmed",  label: "Confirmed" },
];
const STATUS_META: Record<string, StatusMeta> = {
  offered:    { label: "Offered",    bg: "#B08400" },
  on_the_way: { label: "On the way", bg: "#2563EB" },
  confirmed:  { label: "Confirmed",  bg: "#12805C" },
};

// The main tappable role pills, in order. "share" posts directly; every other
// role opens the commit popup (needs + status). "good_samaritan" is shown as a
// separate full-width button below the grid.
const ACTIONS = ["foster_rescue", "adopt", "rescue", "transport", "pledge", "share"] as const;

// The verb shown in the commitment popup header for each kind.
const ROLE_VERB: Record<string, string> = {
  foster_rescue: "foster",
  adopt: "adopt",
  rescue: "pull",
  transport: "transport",
  pledge: "pledge for",
  vet: "help vet",
  trainer: "help train",
  boarding: "board",
  transfer: "transfer",
  good_samaritan: "help",
  other: "help",
};

// The practical "still needs" menu — the real chain to get an animal all the
// way to safe. Every role picks from this (minus the one it already is).
const STILL_NEEDS: { id: string; label: string }[] = [
  { id: "rescue",    label: "a rescue to pull" },
  { id: "foster",    label: "a foster" },
  { id: "adopter",   label: "an adopter" },
  { id: "transport", label: "transport" },
  { id: "vet",       label: "a vet" },
  { id: "funds",     label: "funds / pledges" },
  { id: "boarding",  label: "boarding" },
];
// The need each kind already covers (so we don't ask the lead for it again).
const ROLE_COVERS: Record<string, string> = {
  foster_rescue: "foster",
  adopt: "adopter",
  rescue: "rescue",
  transport: "transport",
  pledge: "funds",
  vet: "vet",
  boarding: "boarding",
  transfer: "rescue",
  trainer: "",
  good_samaritan: "",
  other: "",
};

// The on-the-ground actions a Good Samaritan (anyone nearby) can take. `phrase`
// is how it reads in the live feed. Shown only in the Good Samaritan popup.
const SAM_ACTIONS: { id: string; icon: string; label: string; phrase: string }[] = [
  { id: "eyes_on",   icon: "👀", label: "Keep eyes on",   phrase: "keeping eyes on it" },
  { id: "contain",   icon: "🤲", label: "Contain / hold",  phrase: "can contain / hold" },
  { id: "food",      icon: "🥣", label: "Food / water",    phrase: "bringing food / water" },
  { id: "ride",      icon: "🚗", label: "Give a ride",     phrase: "can give a ride" },
  { id: "photos",    icon: "📸", label: "Photos / video",  phrase: "adding photos / video" },
  { id: "overnight", icon: "🏠", label: "Keep overnight",  phrase: "can keep overnight" },
  { id: "share",     icon: "📣", label: "Share it out",    phrase: "sharing it out" },
];

// The less-common ways to step up, shown in the "More ways to help" sheet that
// the ➕ Other pill opens. Each now opens the same needs + status popup.
const MORE_WAYS: { kind: string; icon: string; label: string; tag: string }[] = [
  { kind: "transfer",  icon: "🏢", label: "Shelter transfer", tag: "another shelter takes" },
  { kind: "vet",       icon: "🩺", label: "Vet care",          tag: "medical" },
  { kind: "trainer",   icon: "🎓", label: "Trainer",           tag: "behavior help" },
  { kind: "boarding",  icon: "🛏", label: "Boarding",           tag: "temporary space" },
];

function initials(n: string): string {
  const p = n.trim().split(/\s+/);
  return ((p[0]?.[0] || "?") + (p[1]?.[0] || "")).toUpperCase();
}

function relTime(iso: string): string {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 45) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function NetworkResponses({
  subjectType = "acs",
  subjectId,
  animalName,
  showJoinCta = true,
  joinHref = "/auth/register",
  donateHref = "/auth/register",
  onJoin,
  onDonate,
  onAction,
  canRespond = true,
  onNeedConfirm,
}: {
  subjectType?: string;
  subjectId: string;
  animalName?: string;
  /** Show the "Join the pack / Donate" footer (default true). Set false when the host card already has its own join CTA. */
  showJoinCta?: boolean;
  /** Where the Join button links when no onJoin handler is given. */
  joinHref?: string;
  /** Where the Donate button links when no onDonate handler is given. */
  donateHref?: string;
  /** If provided, the Join button calls this (e.g. open a modal) instead of navigating. */
  onJoin?: () => void;
  /** If provided, the Donate button calls this instead of navigating. */
  onDonate?: () => void;
  /** If provided, tapping an action ALSO calls this so the host can open its own UI (e.g. the share sheet). */
  onAction?: (kind: string) => void;
  /** When false, the "Can you help?" actions are soft-blocked until the host's safety confirm is ticked. */
  canRespond?: boolean;
  /** Called when a response is attempted while canRespond is false. */
  onNeedConfirm?: () => void;
}) {
  const [name, setName] = useState<string>("");
  const [draft, setDraft] = useState("");
  const [items, setItems] = useState<NetworkResponse[]>([]);
  const [busy, setBusy] = useState(false);
  // Commitment popup — the kind tapped + what the Samaritan can do + what else
  // is still needed + where they're at (status).
  const [commitRole, setCommitRole] = useState<string | null>(null);
  const [needs, setNeeds] = useState<Record<string, boolean>>({});
  const [samActions, setSamActions] = useState<Record<string, boolean>>({});
  const [commitStatus, setCommitStatus] = useState<string>("offered");
  // "More ways to help" sheet (opened by the ➕ Other pill) + its free-text draft.
  const [showMore, setShowMore] = useState(false);
  const [customText, setCustomText] = useState("");

  const who = animalName || "this animal";

  useEffect(() => {
    try {
      const n = typeof window !== "undefined" ? window.localStorage.getItem(NAME_KEY) : null;
      if (n) { setName(n); setDraft(n); }
    } catch { /* ignore */ }
  }, []);

  const refresh = useCallback(async () => {
    try {
      const rows = await listNetworkResponses({ data: { subjectType, subjectId } });
      setItems(Array.isArray(rows) ? rows : []);
    } catch { /* ignore */ }
  }, [subjectType, subjectId]);

  useEffect(() => { void refresh(); }, [refresh]);

  const saveName = () => {
    const v = draft.trim();
    if (!v) return;
    try { window.localStorage.setItem(NAME_KEY, v); } catch { /* ignore */ }
    setName(v);
  };

  // Post a response to the shared feed. `detail` carries the "can do … · still
  // needs …" phrase; `status` is the optional commitment-progress marker.
  const respond = async (kind: string, detail?: string, status?: string) => {
    if (!name || busy) return;
    setBusy(true);
    try {
      await addNetworkResponse({
        data: { subjectType, subjectId, animalName, responderName: name, kind, detail: detail ?? null, status: status ?? null },
      });
      await refresh();
    } catch { /* ignore */ } finally {
      setBusy(false);
    }
  };

  const openCommit = (role: string) => {
    if (!name) return;
    setCommitRole(role);
    setNeeds({});
    setSamActions({});
    setCommitStatus("offered");
  };

  const submitCustom = () => {
    const t = customText.trim();
    if (!t) return;
    void respond("other", t);
    onAction?.("other");
    setCustomText("");
    setShowMore(false);
  };

  return (
    <div className="mx-5 mt-2 mb-5">
      {/* Section heading + live response count */}
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#9CA3AF]">How the pack responds</div>
        <div className="text-[11px] font-semibold text-muted-foreground">{items.length} {items.length === 1 ? "response" : "responses"}</div>
      </div>

      {/* The call to action — moved up under the heading and highlighted */}
      <div className="mt-2 rounded-2xl border border-[#F0C88A] bg-[#FFF6E5] px-4 py-2.5">
        <div className="text-[14.5px] font-bold text-[#8A5A0E]">Can you help {who}?</div>
      </div>

      {/* What is this? — a plain-language explainer so a newcomer gets it */}
      <div className="mt-3 rounded-2xl border border-[#F0C88A] bg-[#FFF9EC] px-4 py-3">
        <div className="text-[12.5px] font-bold text-[#8A5A0E]">🐾 This is the pack — responding live</div>
        <p className="mt-1 text-[12px] leading-relaxed text-[#6B5832]">
          When you tap what you can do, everyone watching {who} sees it right here. Voyce alerts the
          closest fosters, rescues, and adopters first, then ripples outward — friend to friend, group
          to group — until {who} is safe. Every response widens the circle.
        </p>
      </div>

      {/* Live feed */}
      {items.length === 0 ? (
        <p className="mt-3 rounded-2xl border border-dashed border-[#E3DAC4] bg-[#FBF7EC] px-4 py-3 text-center text-[12.5px] text-[#8A5A0E]">
          Be the first to step up for {who}.
        </p>
      ) : (
        <ul className="mt-3 space-y-1.5">
          {items.map((r) => {
            const meta = KINDS[r.kind] ?? KINDS.other;
            const statusMeta = r.status ? STATUS_META[r.status] : undefined;
            // Free-text "Something else" and Good Samaritan show their detail
            // verbatim; a role commitment shows its label plus any detail.
            const sub = (r.kind === "other" || r.kind === "good_samaritan")
              ? (r.detail || meta.label)
              : (meta.label + (r.detail ? ` · ${r.detail}` : ""));
            return (
              <li key={r.id} className="flex items-center gap-2.5 rounded-xl border border-[#EDE5D8] bg-white px-3 py-2">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white" style={{ background: meta.dot }}>{initials(r.responder_name)}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-semibold text-foreground/90">{r.responder_name}</div>
                  <div className="flex min-w-0 items-center gap-1.5">
                    {statusMeta && (
                      <span className="shrink-0 rounded-full px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-white" style={{ background: statusMeta.bg }}>{statusMeta.label}</span>
                    )}
                    <span className="truncate text-[12px] text-muted-foreground">{sub}</span>
                  </div>
                </div>
                {meta.chip && (
                  <span className="shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-bold text-white" style={{ background: meta.dot }}>{meta.chip}</span>
                )}
                <span className="shrink-0 text-[11px] text-muted-foreground">{relTime(r.created_at)}</span>
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-2 text-center text-[10.5px] italic text-muted-foreground">
        Responses are shared with the pack. Pre-launch preview · always confirm status with the shelter.
      </p>

      {/* Who's responding — name gate */}
      {!name ? (
        <div className="mt-3 rounded-2xl border border-[#EDE5D8] bg-white px-4 py-3.5">
          <div className="text-[13px] font-bold text-[#0B0B0C]">Who's responding?</div>
          <p className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">
            Enter your name or initials. Your response shows on the card, the way a pack member's would.
          </p>
          <div className="mt-2 flex gap-2">
            <input value={draft} onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") saveName(); }}
              placeholder="e.g. Rachna or R.W."
              className="min-w-0 flex-1 rounded-xl border border-[#E2DED6] bg-white px-3 py-2 text-[13px] outline-none focus:border-[#C9871A]" />
            <button type="button" onClick={saveName}
              className="shrink-0 rounded-xl px-4 py-2 text-[13px] font-bold text-[#3A2A07]"
              style={{ background: GOLD }}>Start</button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex items-center gap-2.5 rounded-2xl border border-[#EDE5D8] bg-white px-3.5 py-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-full text-[12px] font-bold text-[#3A2A07]" style={{ background: "#FFDF3B" }}>{initials(name)}</span>
          <span className="flex-1 text-[13px] text-foreground/85">Responding as <span className="font-bold">{name}</span></span>
          <button type="button" onClick={() => setName("")} className="text-[12px] font-semibold text-[#8A5A0E] hover:underline">change</button>
        </div>
      )}

      {/* Tap how you can help — role pills (gated by name). Each opens the
          commitment popup, then it posts to the live feed above. */}
      {name && (
        <div className="mt-3">
          <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#9CA3AF]">Tap how you can help</div>
          {!canRespond && (
            <p className="mt-1 text-[11.5px] font-semibold text-[#8A5A0E]">✓ Tick the safety box above to respond.</p>
          )}
          <div className="mt-2 grid grid-cols-3 gap-2">
            {ACTIONS.map((k) => {
              const meta = KINDS[k];
              const isShare = k === "share";
              return (
                <button key={k} type="button" disabled={busy}
                  onClick={() => { if (!canRespond) { onNeedConfirm?.(); return; } if (isShare) { void respond(k); onAction?.(k); return; } openCommit(k); }}
                  className="flex items-center justify-center gap-1.5 rounded-xl border px-2 py-2.5 text-[12.5px] font-bold transition active:scale-[0.97] disabled:opacity-60"
                  style={{ borderColor: "#E3DAC4", background: "#fff", color: "#6B5832" }}>
                  <span>{meta.icon}</span><span>{meta.chip}</span>
                </button>
              );
            })}
            {/* ➕ Other — opens the "More ways to help" sheet */}
            <button type="button" onClick={() => { if (!canRespond) { onNeedConfirm?.(); return; } setShowMore(true); }}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-dashed px-2 py-2.5 text-[12.5px] font-bold transition active:scale-[0.97]"
              style={{ borderColor: "#C9871A", background: "#FFF9EC", color: "#8A5A0E" }}>
              <span>➕</span><span>Other</span>
            </button>
          </div>

          {/* Good Samaritan — the everyone-can-help entry. Anyone nearby can
              step in, even without a formal role. Opens the same popup with an
              extra "what can you do right now?" picker. */}
          <button type="button" disabled={busy}
            onClick={() => { if (!canRespond) { onNeedConfirm?.(); return; } openCommit("good_samaritan"); }}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border-2 px-3 py-2.5 text-[13px] font-bold transition active:scale-[0.98] disabled:opacity-60"
            style={{ borderColor: "#0891B2", background: "#ECFEFF", color: "#0E6A80" }}>
            <span>🙌</span><span>I can help — Good Samaritan</span>
          </button>
        </div>
      )}

      {/* Join the pack + Donate — so a newcomer can step in for real */}
      {showJoinCta && (
        <div className="mt-4 rounded-2xl border border-[#EDE5D8] bg-[#FBF7EC] px-4 py-3.5 text-center">
          <div className="text-[12.5px] font-bold text-[#0B0B0C]">Want to be part of the pack?</div>
          <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted-foreground">
            Join to foster, adopt, transport, or just share the next alert — and be first when donations open.
          </p>
          <div className="mt-2.5 flex gap-2">
            <CtaButton onClick={onJoin} href={joinHref} primary>🐾 Join the pack</CtaButton>
            <CtaButton onClick={onDonate} href={donateHref}>💛 Donate</CtaButton>
          </div>
          <p className="mt-2 text-[10.5px] italic text-muted-foreground">
            We're a 501(c)(3) · donations open at launch. Joining the pack is always free.
          </p>
        </div>
      )}

      {/* Commitment popup — opened by any role (or Good Samaritan). For a
          Samaritan it also asks "what can you do right now?". Everyone picks
          what's still needed (optional) and where they're at (status), then it
          posts to the live feed. */}
      {commitRole && (() => {
        const isSam = commitRole === "good_samaritan";
        const covers = ROLE_COVERS[commitRole] ?? "";
        const askable = STILL_NEEDS.filter((n) => n.id !== covers);
        const chosen = askable.filter((n) => needs[n.id]);
        const doing = SAM_ACTIONS.filter((a) => samActions[a.id]);
        const verb = ROLE_VERB[commitRole] ?? "help";
        const accept = () => {
          const needsPhrase = chosen.length ? "still needs " + joinNice(chosen.map((n) => n.label)) : "";
          let detail: string | undefined;
          if (isSam) {
            const doingPhrase = doing.length ? joinNice(doing.map((a) => a.phrase)) : "";
            detail = [doingPhrase, needsPhrase].filter(Boolean).join(" · ") || undefined;
          } else {
            detail = needsPhrase || undefined;
          }
          void respond(commitRole, detail, commitStatus);
          onAction?.(commitRole);
          setCommitRole(null);
          setNeeds({});
          setSamActions({});
        };
        return (
          <div role="dialog" aria-modal="true"
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-10 sm:items-center sm:pb-10"
            onClick={() => setCommitRole(null)}>
            <div onClick={(e) => e.stopPropagation()} className="max-h-[85vh] w-full max-w-sm overflow-y-auto rounded-3xl border border-border bg-card p-5 shadow-2xl">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-serif text-lg font-semibold leading-tight">
                  {isSam ? `You're helping ${who}` : `You're stepping up to ${verb} ${who}`}
                </h3>
                <button type="button" onClick={() => setCommitRole(null)} aria-label="Close"
                  className="shrink-0 rounded-full border border-border bg-background px-2.5 py-1 text-sm">✕</button>
              </div>
              <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
                {isSam
                  ? <>Anyone nearby can help — even small things move {who} toward safety. <span className="italic">(Pick what fits — all optional.)</span></>
                  : <>Thank you for stepping up for {who}. What else do they still need to get all the way to safety? The pack carries the rest together. <span className="italic">(Optional — you can just commit.)</span></>}
              </p>

              {/* Good Samaritan: what can you do right now? */}
              {isSam && (
                <div className="mt-3">
                  <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#9CA3AF]">What can you do right now?</div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {SAM_ACTIONS.map((a) => {
                      const on = !!samActions[a.id];
                      return (
                        <button key={a.id} type="button" onClick={() => setSamActions((s) => ({ ...s, [a.id]: !on }))}
                          className="flex items-center gap-2 rounded-xl border px-2.5 py-2 text-left text-[12.5px] font-semibold transition active:scale-[0.98]"
                          style={on ? { borderColor: "#0891B2", background: "#ECFEFF", color: "#0E6A80" } : { borderColor: "#E3DAC4", background: "#fff", color: "#6B5832" }}>
                          <span>{a.icon}</span><span>{a.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* What does {who} still need? — the practical menu, minus what
                  this role already is. */}
              <div className="mt-4">
                <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#9CA3AF]">What does {who} still need?</div>
                <div className="mt-2 space-y-2">
                  {askable.map((n) => {
                    const on = !!needs[n.id];
                    return (
                      <button key={n.id} type="button" onClick={() => setNeeds((s) => ({ ...s, [n.id]: !on }))}
                        className="flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left text-[13px] font-semibold transition active:scale-[0.99]"
                        style={on ? { borderColor: "#C9871A", background: "#FFF6E5", color: "#8A5A0E" } : { borderColor: "#E3DAC4", background: "#fff", color: "#6B5832" }}>
                        <span className="text-[15px] leading-none">{on ? "✅" : "▢"}</span><span>{cap(n.label)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Where are you at? — the status pill that shows in the feed. */}
              <div className="mt-4">
                <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#9CA3AF]">Where are you at?</div>
                <div className="mt-2 flex gap-1.5">
                  {STATUSES.map((st) => {
                    const on = commitStatus === st.id;
                    const bg = STATUS_META[st.id].bg;
                    return (
                      <button key={st.id} type="button" onClick={() => setCommitStatus(st.id)}
                        aria-pressed={on}
                        className="flex-1 rounded-full px-2 py-1.5 text-[11.5px] font-bold transition active:scale-95"
                        style={on ? { background: bg, color: "#fff", borderColor: "transparent" } : { background: "#fff", color: "#6B5832", border: "1px solid #E3DAC4" }}>
                        {st.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mt-4 flex items-center justify-end gap-2">
                <button type="button" onClick={() => setCommitRole(null)} className="rounded-full border border-border bg-background px-4 py-2 text-sm font-medium">Cancel</button>
                <button type="button" disabled={busy} onClick={accept}
                  className="rounded-full px-4 py-2 text-sm font-semibold text-[#3A2A07] shadow-sm disabled:opacity-60"
                  style={{ background: GOLD }}>
                  {chosen.length > 0 ? "Commit & rally the rest" : "Commit — I've got it"}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* More ways to help — opened by the ➕ Other pill. The listed options now
          open the same needs + status popup; the free-text answer posts verbatim. */}
      {showMore && (
        <div role="dialog" aria-modal="true"
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-10 sm:items-center sm:pb-10"
          onClick={() => setShowMore(false)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-3xl border border-border bg-card p-5 shadow-2xl">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-serif text-lg font-semibold leading-tight">More ways to help {who}</h3>
              <button type="button" onClick={() => setShowMore(false)} aria-label="Close"
                className="shrink-0 rounded-full border border-border bg-background px-2.5 py-1 text-sm">✕</button>
            </div>
            <div className="mt-3 space-y-2">
              {MORE_WAYS.map((w) => (
                <button key={w.kind} type="button" disabled={busy}
                  onClick={() => { setShowMore(false); openCommit(w.kind); }}
                  className="flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-left text-[13.5px] font-semibold transition active:scale-[0.99] disabled:opacity-60"
                  style={{ borderColor: "#E3DAC4", background: "#fff", color: "#6B5832" }}>
                  <span className="flex items-center gap-2"><span>{w.icon}</span><span>{w.label}</span></span>
                  <span className="shrink-0 rounded-full bg-[#EAF7EE] px-2 py-0.5 text-[10.5px] font-bold text-[#1F7A3A]">{w.tag}</span>
                </button>
              ))}
              <div className="flex gap-1.5 pt-1">
                <input value={customText} onChange={(e) => setCustomText(e.target.value)} maxLength={90}
                  onKeyDown={(e) => { if (e.key === "Enter") submitCustom(); }}
                  placeholder="Something else — how can you help?"
                  className="min-w-0 flex-1 rounded-lg border border-[#E2DED6] bg-white px-3 py-2 text-[13px] outline-none focus:border-[#C9871A]" />
                <button type="button" disabled={busy || !customText.trim()} onClick={submitCustom}
                  className="shrink-0 rounded-lg px-4 text-[13px] font-bold text-[#3A2A07] disabled:opacity-50"
                  style={{ background: GOLD }}>Add</button>
              </div>
            </div>
            <button type="button" onClick={() => setShowMore(false)}
              className="mt-4 w-full rounded-xl bg-[#1A1611] py-2.5 text-[13.5px] font-bold text-white">Done</button>
          </div>
        </div>
      )}
    </div>
  );
}

// A Join/Donate button that calls a handler when one is given, otherwise
// navigates to a link — so the footer works on any card with zero wiring.
function CtaButton({
  onClick,
  href,
  primary,
  children,
}: {
  onClick?: () => void;
  href: string;
  primary?: boolean;
  children: ReactNode;
}) {
  const cls =
    "flex-1 rounded-xl px-3 py-2.5 text-center text-[12.5px] font-bold no-underline transition active:scale-[0.98]";
  const style = primary
    ? { background: GOLD, color: "#3A2A07" }
    : { border: "1px solid #C9871A", background: "#fff", color: "#8A5A0E" };
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={cls} style={style}>
        {children}
      </button>
    );
  }
  return (
    <a href={href} className={cls} style={style}>
      {children}
    </a>
  );
}
