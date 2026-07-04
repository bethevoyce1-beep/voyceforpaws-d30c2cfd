import { useEffect, useState } from "react";
import {
  submitNetworkSignup,
  type NetworkRole,
} from "@/lib/signups.functions";
import { getTurnstileToken, loadTurnstile } from "@/lib/turnstile";

const ROLES: { id: NetworkRole; icon: string; label: string; sub: string }[] = [
  { id: "rescuer", icon: "🐾", label: "Rescuer", sub: "Pull from shelters" },
  { id: "foster", icon: "🏠", label: "Foster", sub: "Open my home temporarily" },
  { id: "vet", icon: "🩺", label: "Vet", sub: "Provide medical care" },
  { id: "shelter", icon: "🏛", label: "Shelter", sub: "I work at one" },
  { id: "animal_lover", icon: "💛", label: "Animal Lover", sub: "Share + support" },
];

export function JoinNetworkModal({
  open,
  onClose,
  initialRole,
  city,
  animalName,
}: {
  open: boolean;
  onClose: () => void;
  initialRole?: NetworkRole;
  city?: string;
  animalName?: string;
}) {
  const [selected, setSelected] = useState<NetworkRole[]>([]);
  const [email, setEmail] = useState("");
  const [zip, setZip] = useState("");
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSelected(initialRole ? [initialRole] : []);
    setEmail("");
    setZip("");
    setPhone("");
    setConsent(false);
    setError(null);
    setDone(false);
    loadTurnstile().catch(() => {});
  }, [open, initialRole]);

  if (!open) return null;

  const toggle = (r: NetworkRole) =>
    setSelected((prev) =>
      prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r],
    );

  const submit = async () => {
    if (submitting) return;
    setError(null);
    if (selected.length === 0) return setError("Pick at least one role.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setError("Enter a valid email.");
    if (!zip.trim()) return setError("Enter your ZIP / postal code.");
    if (!consent) return setError("Please accept Privacy & Terms to continue.");
    setSubmitting(true);
    try {
      const turnstileToken = await getTurnstileToken();
      await submitNetworkSignup({
        data: {
          email: email.trim(),
          zip: zip.trim(),
          phone: phone.trim() || undefined,
          city,
          roles: selected,
          turnstileToken,
        },
      });
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't submit. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 z-10 rounded-full bg-black/5 px-2.5 py-1 text-sm text-foreground/70 hover:bg-black/10"
        >
          ✕
        </button>

        {done ? (
          <div className="px-6 py-10 text-center">
            <div className="text-4xl">💛</div>
            <h2 className="mt-3 font-serif text-2xl font-bold tracking-tight text-[#0B0B0C]">
              You're on the founding list.
            </h2>
            <p className="mt-2 text-[14px] leading-relaxed text-foreground/75">
              We'll email you the moment Voyce launches full alerts
              {city ? ` in ${city}` : " in your area"}.
            </p>
            <button
              onClick={onClose}
              className="mt-6 rounded-full bg-[#FFDF3B] px-5 py-2.5 text-sm font-semibold text-[#3A2A07] shadow"
            >
              Done
            </button>
          </div>
        ) : (
          <div className="px-5 pb-6 pt-7 sm:px-6">
            <h2 className="font-serif text-[22px] font-bold leading-tight tracking-tight text-[#0B0B0C]">
              Be the first to answer{city ? ` in ${city}` : " in your area"}
            </h2>
            <p className="mt-1.5 text-[13.5px] leading-relaxed text-foreground/70">
              We're building the network animal by animal. Your sign-up means
              the next {animalName || "rescue"} reaches someone — instead of no one.
            </p>

            <div className="mt-4 space-y-1.5">
              {ROLES.map((r) => {
                const on = selected.includes(r.id);
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => toggle(r.id)}
                    className={`flex w-full items-center justify-between gap-3 rounded-2xl border-2 px-3.5 py-2.5 text-left transition ${
                      on
                        ? "border-[#FFDF3B] bg-[#FFF7D6]"
                        : "border-[#EAE6DE] bg-white hover:bg-[#FAF8F5]"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-lg">{r.icon}</span>
                      <div>
                        <div className="text-[13.5px] font-semibold text-foreground">
                          {r.label}
                        </div>
                        <div className="text-[11.5px] text-foreground/60">{r.sub}</div>
                      </div>
                    </div>
                    <span
                      className={`grid h-5 w-5 place-content-center rounded border-2 text-[11px] font-bold ${
                        on
                          ? "border-[#C9871A] bg-[#FFDF3B] text-[#3A2A07]"
                          : "border-[#D9D2C2] bg-white text-transparent"
                      }`}
                    >
                      ✓
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
              <label className="block sm:col-span-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-foreground/60">Email *</span>
                <input
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="mt-1 w-full rounded-xl border border-[#D9D2C2] bg-white px-3 py-2 text-[14px] outline-none focus:border-[#C9871A]"
                />
              </label>
              <label className="block">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-foreground/60">ZIP *</span>
                <input
                  type="text"
                  inputMode="text"
                  autoComplete="postal-code"
                  value={zip}
                  onChange={(e) => setZip(e.target.value)}
                  placeholder="90210"
                  className="mt-1 w-full rounded-xl border border-[#D9D2C2] bg-white px-3 py-2 text-[14px] outline-none focus:border-[#C9871A]"
                />
              </label>
              <label className="block">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-foreground/60">Phone (optional)</span>
                <input
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="555 555 5555"
                  className="mt-1 w-full rounded-xl border border-[#D9D2C2] bg-white px-3 py-2 text-[14px] outline-none focus:border-[#C9871A]"
                />
              </label>
            </div>

            <label className="mt-3 flex items-start gap-2.5 text-[12px] leading-snug text-foreground/70">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-[#C9871A]"
              />
              <span>
                I agree to Voyce's{" "}
                <a href="/privacy" target="_blank" className="underline">Privacy</a> &{" "}
                <a href="/terms" target="_blank" className="underline">Terms</a>, and
                consent to launch emails for my area.
              </span>
            </label>

            {error && (
              <div className="mt-3 rounded-xl bg-[#FCE4E4] px-3 py-2 text-[12.5px] font-medium text-[#7E1F1F]">
                {error}
              </div>
            )}

            <button
              onClick={submit}
              disabled={submitting}
              className="mt-5 w-full rounded-2xl border-2 border-[#FFDF3B] bg-black px-5 py-3 text-[14px] font-bold uppercase tracking-wide text-white shadow-lg transition hover:brightness-110 active:scale-[0.99] disabled:opacity-70"
            >
              {submitting ? "Joining…" : "Join the Network →"}
            </button>

            <p className="mt-3 text-center text-[11px] italic text-foreground/55">
              Protected by silent verification. No spam — launch announcements only.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
