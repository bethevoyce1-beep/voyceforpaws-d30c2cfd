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
//      (Foster, Adopt, Rescue pull, Transport, Pledge), then a popup asks what
//      ELSE is still needed to get the animal all the way to safety.
//   2) Live pack feed — that commitment posts to a shared feed so EVERYONE
//      watching this animal sees the pack step up in real time, and the feed
//      line reflects both the role AND the still-needs, e.g.
//      "Rachna · can foster · still needs an adopter, a vet".
// Persisted in Supabase (network_responses), keyed by animal. A "➕ Other" pill
// opens a sheet with the less-common paths (shelter transfer, transport, vet,
// trainer, boarding) plus a free-text "Something else" field.
//
// It also EXPLAINS itself (a short "this is the pack, live" intro) and offers a
// "Join the pack / Donate" footer (hide with showJoinCta={false}).
// =============================================================

const NAME_KEY = "voyce_responder_name";
const GOLD = "linear-gradient(135deg,#FFDF3B,#C9871A)";

function cap(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

type KindMeta = { label: string; dot: string; icon?: string; chip?: string };
const KINDS: Record<string, KindMeta> = {
  adopt:         { label: "wants to adopt", dot: "#993556", icon: "🤝", chip: "Adopt" },
  rescue:        { label: "will pull · rescue partner", dot: "#7C3AED", icon: "🐾", chip: "Rescue pull" },
  foster_rescue: { label: "can foster", dot: "#12805C", icon: "🏠", chip: "Foster" },
  transport:     { label: "can transport", dot: "#2563EB", icon: "🚚", chip: "Transport" },
  pledge:        { label: "pledged funds toward the pull", dot: "#0F6E56", icon: "💵", chip: "Pledge" },
  share:         { label: "shared to the network", dot: "#8A8175", icon: "📣", chip: "Share" },
  foster_acs:    { label: "can foster · can pick up nearby", dot: "#8A5A0E" },
  transfer:      { label: "another shelter can take · transfer", dot: "#185FA5", icon: "🏢", chip: "Shelter transfer" },
  vet:           { label: "can help with vet care", dot: "#0F766E", icon: "🩺", chip: "Vet care" },
  trainer:       { label: "can help with training · behavior", dot: "#7C3AED", icon: "🎓", chip: "Trainer" },
  boarding:      { label: "can offer boarding · temporary space", dot: "#B45309", icon: "🛏", chip: "Boarding" },
  other:         { label: "wants to help", dot: "#8A5A0E" },
};
// The tappable actions, in order. Each role (all but "share") opens the
// commitment popup; "share" posts directly and lets the host open its share UI.
const ACTIONS = ["foster_rescue", "adopt", "rescue", "transport", "pledge", "share"] as const;

// The verb shown in the commitment popup header for each role.
const ROLE_VERB: Record<string, string> = {
  foster_rescue: "foster",
  adopt: "adopt",
  rescue: "pull",
  transport: "transport",
  pledge: "pledge for",
};
// After picking a role, the responder says what ELSE is still needed. These
// post together so the feed reads "can foster · still needs an adopter, a vet".
const STILL_NEEDS: { id: string; label: string }[] = [
  { id: "foster",    label: "a foster" },
  { id: "adopter",   label: "an adopter" },
  { id: "transport", label: "transport" },
  { id: "funds",     label: "funds / pledges" },
  { id: "vet",       label: "a vet" },
];
// The need each role already covers (so we don't ask the lead for it again).
const ROLE_COVERS: Record<string, string> = {
  foster_rescue: "foster",
  adopt: "adopter",
  rescue: "",
  transport: "transport",
  pledge: "funds",
};

// The less-common ways to step up, shown in the "More ways to help" sheet that
// the ➕ Other pill opens. Each posts to the same live feed via respond().
const MORE_WAYS: { kind: string; icon: string; label: string; tag: string }[] = [
  { kind: "transfer",  icon: "🏢", label: "Shelter transfer", tag: "another shelter takes" },
  { kind: "transport", icon: "🚚", label: "Transport",        tag: "get them there" },
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
  // Commitment popup — the role the responder tapped + what else they still need.
  const [commitRole, setCommitRole] = useState<string | null>(null);
  const [needs, setNeeds] = useState<Record<string, boolean>>({});
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

  // Post a response to the shared feed. `detail` carries the "still needs …"
  // phrase (or the free-text "Something else" answer) so it shows in the feed.
  const respond = async (kind: string, detail?: string) => {
    if (!name || busy) return;
    setBusy(true);
    try {
      await addNetworkResponse({
        data: { subjectType, subjectId, animalName, responderName: name, kind, detail: detail ?? null },
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
            // Free-text "Something else" shows verbatim; a role commitment shows
            // its label plus any "still needs …" detail the responder added.
            const sub = r.kind === "other"
              ? (r.detail || meta.label)
              : (meta.label + (r.detail ? ` · ${r.detail}` : ""));
            return (
              <li key={r.id} className="flex items-center gap-2.5 rounded-xl border border-[#EDE5D8] bg-white px-3 py-2">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: meta.dot }} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-semibold text-foreground/90">{r.responder_name}</div>
                  <div className="truncate text-[12px] text-muted-foreground">{sub}</div>
                </div>
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

      {/* Commitment popup — opened by a role pill. Pick what else is still
          needed (optional), then it posts to the live feed above with both the
          role and the "still needs …" detail. */}
      {commitRole && (() => {
        const covers = ROLE_COVERS[commitRole] ?? "";
        const askable = STILL_NEEDS.filter((n) => n.id !== covers);
        const chosen = askable.filter((n) => needs[n.id]);
        const verb = ROLE_VERB[commitRole] ?? "help";
        const accept = () => {
          const list = chosen.map((n) => n.label);
          const phrase =
            list.length === 0 ? undefined :
            "still needs " + (list.length === 1
              ? list[0]
              : list.slice(0, -1).join(", ") + " and " + list[list.length - 1]);
          void respond(commitRole, phrase);
          onAction?.(commitRole);
          setCommitRole(null);
          setNeeds({});
        };
        return (
          <div role="dialog" aria-modal="true"
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-10 sm:items-center sm:pb-10"
            onClick={() => setCommitRole(null)}>
            <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-3xl border border-border bg-card p-5 shadow-2xl">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-serif text-lg font-semibold leading-tight">You're stepping up to {verb} {who}</h3>
                <button type="button" onClick={() => setCommitRole(null)} aria-label="Close"
                  className="shrink-0 rounded-full border border-border bg-background px-2.5 py-1 text-sm">✕</button>
              </div>
              <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
                As the first to accept, you're the <span className="font-semibold text-foreground/80">lead</span>. What else does {who} still need to get all the way to safety? <span className="italic">(Optional — you can just commit.)</span>
              </p>
              <div className="mt-3 space-y-2">
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

      {/* More ways to help — opened by the ➕ Other pill. Every option posts to
          the same live feed; the free-text answer is saved verbatim in `detail`. */}
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
                  onClick={() => { void respond(w.kind); onAction?.(w.kind); setShowMore(false); }}
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
