import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { Assessment } from "@/lib/analyze.functions";
import { listSharedReports, type SavedReport } from "@/lib/saved.functions";

// =============================================================
// /saved — the "Saved cards" gallery. Every rescue card auto-saves the moment
// it's created, so this is the testing view: every card taken, newest first,
// each tile showing the photo + honest status. Tap a tile to open the full
// card at its permalink (/r/<id>). Cards made on THIS device are highlighted.
// =============================================================

export const Route = createFileRoute("/saved")({
  loader: async () => ({ reports: await listSharedReports({ data: { limit: 60 } }) }),
  component: SavedPage,
});

function animalName(d: Assessment | null): string {
  if (!d) return "Animal";
  const breed = d.breed && !/unknown|mixed/i.test(d.breed) ? d.breed : "";
  const s = (breed || d.species || "animal").trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function tone(d: Assessment | null): { badge: string; bg: string; fg: string } {
  const s = `${d?.status ?? ""} ${d?.visible_condition ?? ""} ${d?.status_reason ?? ""}`.toLowerCase();
  if (/critical|emergency|euthan/.test(s)) return { badge: "🚨 Critical", bg: "#7E1F1F", fg: "#FFF1EE" };
  if (/urgent|concern|injur|sick|distress|bleed|hit by/.test(s)) return { badge: "🟠 Urgent", bg: "#A8431F", fg: "#FFF6F0" };
  return { badge: "💛 Needs care", bg: "#8A5A0E", fg: "#FFF9E6" };
}

function when(iso: string): string {
  const d = new Date(iso);
  const day = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `${day} · ${time}`;
}

function SavedPage() {
  const { reports } = Route.useLoaderData() as { reports: SavedReport[] };
  const [mine, setMine] = useState<string[]>([]);

  useEffect(() => {
    try {
      const j = typeof window !== "undefined" ? window.localStorage.getItem("voyce_my_reports") : null;
      if (j) setMine(JSON.parse(j) as string[]);
    } catch { /* ignore */ }
  }, []);

  return (
    <div className="min-h-[100dvh] bg-[#FBF7EC] pb-16">
      {/* Brand bar */}
      <div className="flex items-center gap-2.5 bg-[#0B0B0C] px-5 py-3.5">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#141414] text-[15px]">🐾</span>
        <span className="text-[16px] font-black tracking-tight text-white">Voyce <span className="italic text-[#FFDF3B]">for</span> Paws&trade;</span>
        <span className="ml-auto text-[11px] font-semibold uppercase tracking-[0.14em] text-white/55">Saved cards</span>
      </div>

      <div className="mx-auto w-full max-w-2xl px-4 pt-4">
        <div className="flex items-end justify-between">
          <h1 className="font-serif text-[22px] font-bold text-[#0B0B0C]">Saved cards</h1>
          <span className="text-[12px] font-semibold text-muted-foreground">{reports.length} saved</span>
        </div>
        <p className="mt-1 text-[12.5px] leading-relaxed text-[#6B5832]">
          Every card taken auto-saves here, newest first. Tap any card to open the full rescue card. Cards made on this device are marked <span className="font-bold text-[#8A5A0E]">Yours</span>.
        </p>

        {reports.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-[#E3DAC4] bg-white px-6 py-12 text-center">
            <div className="text-4xl">📷</div>
            <p className="mt-2 text-[14px] font-bold text-[#8A5A0E]">No cards saved yet</p>
            <p className="mt-1 text-[12.5px] text-muted-foreground">Take a photo of an animal in the app and its card will show up here.</p>
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {reports.map((r) => {
              const d = r.data;
              const name = animalName(d);
              const T = tone(d);
              const isMine = mine.includes(r.id);
              return (
                <a key={r.id} href={`/r/${r.id}`}
                  className="group overflow-hidden rounded-2xl border bg-white no-underline shadow-sm transition active:scale-[0.98]"
                  style={{ borderColor: isMine ? "#C9871A" : "#EDE5D8" }}>
                  <div className="relative aspect-[4/3] bg-[#f2ede2]">
                    {r.image ? (
                      <img src={r.image} alt={name} loading="lazy" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-3xl">🐾</div>
                    )}
                    <span className="absolute left-2 top-2 rounded-full px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.08em] shadow"
                      style={{ background: T.bg, color: T.fg }}>{T.badge}</span>
                    {isMine && (
                      <span className="absolute right-2 top-2 rounded-full bg-[#FFDF3B] px-2 py-0.5 text-[9.5px] font-extrabold text-[#3A2A07] shadow">Yours</span>
                    )}
                  </div>
                  <div className="px-2.5 py-2">
                    <div className="truncate text-[13px] font-bold text-[#1A1611]">{name}</div>
                    <div className="mt-0.5 text-[11px] text-muted-foreground">{when(r.created_at)}</div>
                  </div>
                </a>
              );
            })}
          </div>
        )}

        <p className="mx-auto mt-6 max-w-lg text-center text-[11px] italic leading-relaxed text-muted-foreground">
          Pre-launch testing view. Voyce shares AI observations, not veterinary advice — always confirm with a licensed vet or the shelter before acting.
        </p>
      </div>
    </div>
  );
}
