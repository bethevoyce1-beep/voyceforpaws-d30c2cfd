import { useState, type ReactNode } from "react";
import type { Assessment } from "@/lib/analyze.functions";
import type { MissionId } from "@/lib/missions";
import { BrandHeader } from "@/components/voyce/BrandHeader";

// Reporter-supplied details, collected after the AI card so the reporter can
// review, correct, and add context before the report goes to the network.
export type ReportDetails = {
  animalType: string;
  situation: string;
  notes: string;
  email: string;
  phone: string;
};

const GOLD = "#FFD24A";
const DEEP_GOLD = "#C9871A";

const ANIMAL_TYPES = ["Dog", "Cat", "Puppy", "Kitten", "Other"];
const SITUATIONS = [
  "Injured / Sick",
  "Stray / Needs care",
  "Lost pet",
  "Found pet",
  "At-risk shelter",
  "Needs spay/vaccine",
];

// Pre-select the animal type from what the AI saw.
function defaultAnimal(species: string): string {
  const s = (species || "").toLowerCase();
  if (s.includes("pup")) return "Puppy";
  if (s.includes("kit")) return "Kitten";
  if (s.includes("dog") || s.includes("canine")) return "Dog";
  if (s.includes("cat") || s.includes("feline")) return "Cat";
  return "Other";
}

// Pre-select "what's happening" from the mission the reporter came in through.
function defaultSituation(mission: MissionId): string {
  switch (mission) {
    case "injured":
      return "Injured / Sick";
    case "at-risk-shelter":
      return "At-risk shelter";
    case "lost-found":
      return "Lost pet";
    case "prevention":
      return "Needs spay/vaccine";
    default:
      return "Stray / Needs care";
  }
}

export function ReportDetails({
  image,
  data,
  mission,
  onContinue,
}: {
  image: string;
  data: Assessment;
  mission: MissionId;
  onContinue: (details: ReportDetails) => void;
}) {
  const [animalType, setAnimalType] = useState<string>(() => defaultAnimal(data.species));
  const [situation, setSituation] = useState<string>(() => defaultSituation(mission));
  const [notes, setNotes] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const canSend = email.trim().length > 0 || phone.trim().length > 0;

  const submit = () => {
    onContinue({
      animalType,
      situation,
      notes: notes.trim(),
      email: email.trim(),
      phone: phone.trim(),
    });
  };

  return (
    <div className="min-h-[100dvh] bg-background pb-28">
      <BrandHeader />
      <div className="mx-auto w-full max-w-md px-5 pt-4">
        <h1 className="font-serif text-[24px] font-bold tracking-tight">Tell us about them</h1>
        <p className="mt-1 text-[13.5px] leading-relaxed text-muted-foreground">
          A few details help the closest rescuers respond faster. We pre-filled what
          Voyce could tell — fix anything that's off.
        </p>

        {/* Photo */}
        <div className="mt-4 overflow-hidden rounded-2xl border-2" style={{ borderColor: GOLD }}>
          <img src={image} alt="Reported animal" className="aspect-[4/3] w-full object-cover" />
        </div>

        <Section label="What kind of animal?">
          <Chips options={ANIMAL_TYPES} value={animalType} onChange={setAnimalType} />
        </Section>

        <Section label="What's happening?">
          <Chips options={SITUATIONS} value={situation} onChange={setSituation} />
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

        <Section label="How can we reach you? (at least one)">
          <input
            type="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@email.com"
            className="w-full rounded-xl border border-border bg-card px-3.5 py-2.5 text-[14px] outline-none focus:border-[#C9871A]"
          />
          <input
            type="tel"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Phone or text (faster on the street)"
            className="mt-2 w-full rounded-xl border border-border bg-card px-3.5 py-2.5 text-[14px] outline-none focus:border-[#C9871A]"
          />
          <p className="mt-1.5 text-[11.5px] leading-snug text-muted-foreground">
            Shared only with responders who can help — never shown publicly.
          </p>
        </Section>

        <button
          type="button"
          onClick={submit}
          disabled={!canSend}
          className="mt-6 w-full rounded-2xl py-4 text-[15px] font-bold uppercase tracking-wide shadow-md transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
          style={{
            background: `linear-gradient(135deg, ${GOLD} 0%, ${DEEP_GOLD} 100%)`,
            color: "#3A2A07",
          }}
        >
          🔔 Send to nearest network
        </button>
        {!canSend && (
          <p className="mt-2 text-center text-[12px] text-muted-foreground">
            Add an email or phone so rescuers can reach you.
          </p>
        )}
        <p className="mt-3 text-center text-[11.5px] leading-relaxed text-muted-foreground">
          No signal where you found them? Send anyway — Voyce saves the report and
          delivers it the moment you reconnect.
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
