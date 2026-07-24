import { useCallback, useEffect, useState } from "react";
import {
  addNetworkResponse,
  listNetworkResponses,
  type NetworkResponse,
} from "@/lib/network.functions";

// =============================================================
// NetworkResponses — the shared "How the network is responding" feed.
// A viewer enters their name once, then taps how they can help (Foster, Adopt,
// Rescue pull, Transport, Pledge, Share). Each tap posts to a shared feed so
// EVERYONE watching this animal sees the pack step up in real time — that's the
// ripple. Persisted in Supabase (network_responses), keyed by animal.
// =============================================================

const NAME_KEY = "voyce_responder_name";

type KindMeta = { label: string; dot: string; icon?: string; chip?: string };
const KINDS: Record<string, KindMeta> = {
  adopt:         { label: "wants to adopt", dot: "#993556", icon: "🤝", chip: "Adopt" },
  rescue:        { label: "will pull · rescue partner", dot: "#7C3AED", icon: "🐾", chip: "Rescue pull" },
  foster_rescue: { label: "can foster", dot: "#12805C", icon: "🏠", chip: "Foster" },
  transport:     { label: "can transport", dot: "#2563EB", icon: "🚗", chip: "Transport" },
  pledge:        { label: "pledged funds toward the pull", dot: "#0F6E56", icon: "💵", chip: "Pledge" },
  share:         { label: "shared to the network", dot: "#8A8175", icon: "📣", chip: "Share" },
  foster_acs:    { label: "can foster · through ACS", dot: "#8A5A0E" },
  transfer:      { label: "another shelter can take · transfer", dot: "#185FA5" },
  other:         { label: "wants to help", dot: "#8A5A0E" },
};
// The tappable actions, in order.
const ACTIONS = ["foster_rescue", "adopt", "rescue", "transport", "pledge", "share"] as const;

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
}: {
  subjectType?: string;
  subjectId: string;
  animalName?: string;
}) {
  const [name, setName] = useState<string>("");
  const [draft, setDraft] = useState("");
  const [items, setItems] = useState<NetworkResponse[]>([]);
  const [busy, setBusy] = useState(false);

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

  const respond = async (kind: string) => {
    if (!name || busy) return;
    setBusy(true);
    try {
      await addNetworkResponse({
        data: { subjectType, subjectId, animalName, responderName: name, kind },
      });
      await refresh();
    } catch { /* ignore */ } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-5 mt-2 mb-5">
      {/* Who's responding — name gate */}
      {!name ? (
        <div className="rounded-2xl border border-[#EDE5D8] bg-white px-4 py-3.5">
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
              style={{ background: "linear-gradient(135deg,#FFDF3B,#C9871A)" }}>Start</button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2.5 rounded-2xl border border-[#EDE5D8] bg-white px-3.5 py-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-full text-[12px] font-bold text-[#3A2A07]" style={{ background: "#FFDF3B" }}>{initials(name)}</span>
          <span className="flex-1 text-[13px] text-foreground/85">Responding as <span className="font-bold">{name}</span></span>
          <button type="button" onClick={() => setName("")} className="text-[12px] font-semibold text-[#8A5A0E] hover:underline">change</button>
        </div>
      )}

      {/* What would you like to do? */}
      {name && (
        <div className="mt-3">
          <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#9CA3AF]">What would you like to do?</div>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {ACTIONS.map((k) => {
              const meta = KINDS[k];
              return (
                <button key={k} type="button" disabled={busy} onClick={() => void respond(k)}
                  className="flex items-center justify-center gap-1.5 rounded-xl border px-2 py-2.5 text-[12.5px] font-bold transition active:scale-[0.97] disabled:opacity-60"
                  style={{ borderColor: "#E3DAC4", background: "#fff", color: "#6B5832" }}>
                  <span>{meta.icon}</span><span>{meta.chip}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* How the network is responding */}
      <div className="mt-4 flex items-center justify-between">
        <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#9CA3AF]">How the network is responding</div>
        <div className="text-[11px] font-semibold text-muted-foreground">{items.length} {items.length === 1 ? "response" : "responses"}</div>
      </div>

      {items.length === 0 ? (
        <p className="mt-2 rounded-2xl border border-dashed border-[#E3DAC4] bg-[#FBF7EC] px-4 py-3 text-center text-[12.5px] text-[#8A5A0E]">
          Be the first to step up for {animalName || "this animal"}.
        </p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {items.map((r) => {
            const meta = KINDS[r.kind] ?? KINDS.other;
            return (
              <li key={r.id} className="flex items-center gap-2.5 rounded-xl border border-[#EDE5D8] bg-white px-3 py-2">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: meta.dot }} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-semibold text-foreground/90">{r.responder_name}</div>
                  <div className="truncate text-[12px] text-muted-foreground">{meta.label}</div>
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
    </div>
  );
}
