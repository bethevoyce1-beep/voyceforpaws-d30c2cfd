import { useState, type ReactNode } from "react";
import type { MissionId } from "@/lib/missions";
import type { Assessment } from "@/lib/analyze.functions";

// Bottom-sheet pop-up: shows what Voyce read from the photo (pre-selected), lets
// the reporter confirm or fix it, then sends to the pack. Opened from the
// rescue card. "Send" is the single confirm-and-send action.

export type ReviewResult = {
  animalType: string;
  situation: string;
  witnessed: string[];
  notes: string;
};

const GOLD = "#FFDF3B";
const DEEP_GOLD = "#C9871A";

const ANIMAL_TYPES = ["Dog", "Cat", "Puppy", "Kitten", "Other"];
const SITUATION_GROUPS: { header: string; options: string[] }[] = [
  { header: "Injured / sick", options: ["Injured or hit by a car", "Sick or in distress"] },
  { header: "Lost & found", options: ["Lost pet", "Found pet", "Abandoned puppies or kittens"] },
  { header: "Ongoing care", options: ["Stray, needs care", "Needs spay or vaccine", "At-risk shelter"] },
  { header: "Just testing", options: ["Just testing on my own pet"] },
];
const ALL_SITUATIONS = SITUATION_GROUPS.flatMap((g) => g.options);
const WITNESSED = ["Hit by a car", "Trapped / in danger", "Abuse / cruelty witnessed"];

function defaultSituation(mission: MissionId): string {
  switch (mission) {
    case "injured": return "Injured or hit by a car";
    case "at-risk-shelter": return "At-risk shelter";
    case "lost-found": return "Lost pet";
    case "prevention": return "Needs spay or vaccine";
    default: return "Stray, needs care";
  }
}
function initialAnimalType(a?: Assessment | null): string {
  if (!a) return "";
  const age = (a.age || "").toLowerCase();
  if (age.includes("puppy")) return "Puppy";
  if (age.includes("kitten")) return "Kitten";
  const sp = (a.species || "").toLowerCase();
  if (sp === "dog") return "Dog";
  if (sp === "cat") return "Cat";
  return a.animal_present === false ? "" : "Other";
}
function initialSituation(mission: MissionId, a?: Assessment | null): string {
  const s = a?.suggested_situation;
  if (s && ALL_SITUATIONS.includes(s)) return s;
  return defaultSituation(mission);
}

export function ReviewSheet({
  mission,
  assessment,
  onCancel,
  onSend,
}: {
  mission: MissionId;
  assessment?: Assessment | null;
  onCancel: () => void;
  onSend: (r: ReviewResult) => void;
}) {
  const initAnimal = initialAnimalType(assessment);
  const initSituation = initialSituation(mission, assessment);
  const [animalType, setAnimalType] = useState(initAnimal);
  const [situation, setSituation] = useState(initSituation);
  const [witnessed, setWitnessed] = useState<string[]>([]);
  const [notes, setNotes] = useState("");

  const changed =
    situation !== initSituation ||
    animalType !== initAnimal ||
    witnessed.length > 0 ||
    notes.trim().length > 0;

  const toggleWitnessed = (o: string) =>
    setWitnessed((prev) => (prev.includes(o) ? prev.filter((x) => x !== o) : [...prev, o]));

  const send = () => onSend({ animalType, situation, witnessed, notes: notes.trim() });

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 sm:items-center"
      onClick={onCancel}
    >
      <div
        className="relative flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onCancel}
          aria-label="Close"
          className="absolute right-3 top-3 z-10 rounded-full bg-black/5 px-2.5 py-1 text-sm text-foreground/70 hover:bg-black/10"
        >
          ✕
        </button>

        <div className="overflow-y-auto px-5 pb-4 pt-6">
          <h2 className="font-serif text-[20px] font-bold tracking-tight text-[#0B0B0C]">
            Here's what Voyce read
          </h2>
          <p className="mt-1 text-[13px] leading-relaxed text-foreground/70">
            Voyce pre-filled this from your photo. Looks right? Send it. Something off? Fix it, then send.
          </p>

          <Section label="What kind of animal?">
            <Chips options={ANIMAL_TYPES} value={animalType} onChange={setAnimalType} />
          </Section>

          <Section label="What's happening?">
            <div className="space-y-3">
              {SITUATION_GROUPS.map((g) => (
                <div key={g.header}>
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground/45">
                    {g.header}
                  </p>
                  <Chips options={g.options} value={situation} onChange={setSituation} />
                </div>
              ))}
            </div>
          </Section>

          <Section label="Did you see any of these? (the photo can't tell us)">
            <MultiChips options={WITNESSED} values={witnessed} onToggle={toggleWitnessed} />
          </Section>

          <Section label="Anything else? (optional)">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Color, size, behavior, how long it's been there…"
              className="w-full resize-none rounded-xl border border-border bg-card px-3.5 py-2.5 text-[14px] outline-none focus:border-[#C9871A]"
            />
          </Section>
        </div>

        <div className="border-t border-[#EDE5D8] bg-white px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={send}
            className="w-full rounded-2xl py-3.5 text-[15px] font-bold uppercase tracking-wide shadow-md transition active:scale-[0.99]"
            style={{ background: `linear-gradient(135deg, ${GOLD} 0%, ${DEEP_GOLD} 100%)`, color: "#3A2A07" }}
          >
            {changed ? "✨ Update & send to pack" : "🔔 Send to pack"}
          </button>
          <p className="mt-2 text-center text-[11px] italic text-foreground/55">
            Sends instantly to the nearby pack. Pre-launch: this is a preview of launch alerts.
          </p>
        </div>
      </div>
    </div>
  );
}

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mt-4">
      <p className="mb-2 text-[12px] font-semibold uppercase tracking-[0.1em] text-foreground/60">{label}</p>
      {children}
    </div>
  );
}
function Chips({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const active = o === value;
        return (
          <button key={o} type="button" onClick={() => onChange(o)}
            className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition active:scale-[0.97] ${active ? "text-[#3A2A07] shadow-sm" : "border border-border bg-card text-foreground/80 hover:border-[#C9871A]"}`}
            style={active ? { background: GOLD } : undefined}>
            {o}
          </button>
        );
      })}
    </div>
  );
}
function MultiChips({ options, values, onToggle }: { options: string[]; values: string[]; onToggle: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const active = values.includes(o);
        return (
          <button key={o} type="button" onClick={() => onToggle(o)}
            className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition active:scale-[0.97] ${active ? "text-[#3A2A07] shadow-sm" : "border border-border bg-card text-foreground/80 hover:border-[#C9871A]"}`}
            style={active ? { background: GOLD } : undefined}>
            {active ? "✓ " : ""}{o}
          </button>
        );
      })}
    </div>
  );
}
