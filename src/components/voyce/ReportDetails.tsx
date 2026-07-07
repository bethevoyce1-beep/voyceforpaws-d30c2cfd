import { useState, type ReactNode } from "react";
import type { MissionId } from "@/lib/missions";
import type { Assessment } from "@/lib/analyze.functions";
import { BrandHeader } from "@/components/voyce/BrandHeader";

// Reporter-supplied details, collected after the AI card so the reporter can
// review, correct, and add context before the report goes to the network.
export type ReportDetails = {
  animalType: string;
  situation: string;
  witnessed: string[];
  notes: string;
  email: string;
  phone: string;
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

// Things a photo CANNOT reveal — only the person on the scene knows these.
// Multi-select: pick any, all, or none.
const WITNESSED = [
  "Hit by a car",
  "Trapped / in danger",
  "Abuse / cruelty witnessed",
];

// Pre-select "what's happening" from the mission the reporter came in through.
function defaultSituation(mission: MissionId): string {
  switch (mission) {
    case "injured":
      return "Injured or hit by a car";
    case "at-risk-shelter":
      return "At-risk shelter";
    case "lost-found":
      return "Lost pet";
    case "prevention":
      return "Needs spay or vaccine";
    default:
      return "Stray, needs care";
  }
}

const ALL_SITUATIONS = SITUATION_GROUPS.flatMap((g) => g.options);

// Pre-fill the animal type from what the AI read in the photo.
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

// Pre-select the situation from Voyce's read when it matches a pill, else the
// mission default.
function initialSituation(mission: MissionId, a?: Assessment | null): string {
  const s = a?.suggested_situation;
  if (s && ALL_SITUATIONS.includes(s)) return s;
  return defaultSituation(mission);
}

export function ReportDetails({
  image,
  mission,
  assessment,
  onContinue,
}: {
  image: string;
  mission: MissionId;
  assessment?: Assessment | null;
  onContinue: (details: ReportDetails) => void;
}) {
  const [animalType, setAnimalType] = useState<string>(() => initialAnimalType(assessment));
  const [situation, setSituation] = useState<string>(() => initialSituation(mission, assessment)); // pre-filled from Voyce's read; reporter can change
  const [witnessed, setWitnessed] = useState<string[]>([]);
  const [notes, setNotes] = useState("");

  const toggleWitnessed = (o: string) =>
    setWitnessed((prev) =>
      prev.includes(o) ? prev.filter((x) => x !== o) : [...prev, o],
    );

  const submit = () => {
    onContinue({
      animalType,
      situation,
      witnessed,
      notes: notes.trim(),
      email: "",
      phone: "",
    });
  };

  return (
    <div className="min-h-[100dvh] bg-background pb-28">
      <BrandHeader />
      <div className="mx-auto w-full max-w-md px-5 pt-4">
        <h1 className="font-serif text-[24px] font-bold tracking-tight">Tell us about them</h1>
        <p className="mt-1 text-[13.5px] leading-relaxed text-muted-foreground">
          Voyce already read the photo — check what it picked up and fix anything it
          missed before the card goes out.
        </p>

        {/* Photo */}
        <div className="mt-4 overflow-hidden rounded-2xl border-2" style={{ borderColor: GOLD }}>
          <img src={image} alt="Reported animal" className="aspect-[4/3] w-full object-cover" />
        </div>

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
          <p className="mt-2 text-[11.5px] leading-snug text-muted-foreground">
            Pick any that apply — or none. These tell responders about things a photo
            can't show, like a car accident or abuse you witnessed.
          </p>
        </Section>

        <Section label="Anything else? (optional)">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Color, size, behavior, how long it's been there…"
            className="w-full resize-none rounded-xl border border-border bg-card px-3.5 py-2.5 text-[14px] outline-none focus:border-[#C9871A]"
          />
        </Section>

        <button
          type="button"
          onClick={submit}
          className="mt-6 w-full rounded-2xl py-4 text-[15px] font-bold uppercase tracking-wide shadow-md transition active:scale-[0.99]"
          style={{
            background: `linear-gradient(135deg, ${GOLD} 0%, ${DEEP_GOLD} 100%)`,
            color: "#3A2A07",
          }}
        >
          ✨ Update the rescue card
        </button>
        <p className="mt-3 text-center text-[11.5px] leading-relaxed text-muted-foreground">
          We'll finalize the rescue card with your corrections.
        </p>
      </div>
    </div>
  );
}

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mt-5">
      <p className="mb-2 text-[12.5px] font-semibold uppercase tracking-[0.1em] text-foreground/60">
        {label}
      </p>
      {children}
    </div>
  );
}

function Chips({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const active = o === value;
        return (
          <button
            key={o}
            type="button"
            onClick={() => onChange(o)}
            className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition active:scale-[0.97] ${
              active
                ? "text-[#3A2A07] shadow-sm"
                : "border border-border bg-card text-foreground/80 hover:border-[#C9871A]"
            }`}
            style={active ? { background: GOLD } : undefined}
          >
            {o}
          </button>
        );
      })}
    </div>
  );
}

// Multi-select variant — reporter can pick several (or none).
function MultiChips({
  options,
  values,
  onToggle,
}: {
  options: string[];
  values: string[];
  onToggle: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const active = values.includes(o);
        return (
          <button
            key={o}
            type="button"
            onClick={() => onToggle(o)}
            className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition active:scale-[0.97] ${
              active
                ? "text-[#3A2A07] shadow-sm"
                : "border border-border bg-card text-foreground/80 hover:border-[#C9871A]"
            }`}
            style={active ? { background: GOLD } : undefined}
          >
            {active ? "✓ " : ""}
            {o}
          </button>
        );
      })}
    </div>
  );
}
