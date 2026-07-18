import { useEffect, useState } from "react";
import {
  submitNetworkSignup,
  type NetworkRole,
  type AlertChannel,
  type AlertUrgency,
} from "@/lib/signups.functions";
import { getTurnstileToken, loadTurnstile } from "@/lib/turnstile";

const ROLES: { id: NetworkRole; icon: string; label: string; sub: string }[] = [
  { id: "rescuer", icon: "🐾", label: "Rescuer", sub: "Pull from shelters" },
  { id: "foster", icon: "🏠", label: "Foster", sub: "Open my home temporarily" },
  { id: "vet", icon: "🩺", label: "Vet", sub: "Provide medical care" },
  { id: "shelter", icon: "🏛", label: "Shelter", sub: "I work at one" },
  { id: "volunteer", icon: "🙌", label: "Volunteer", sub: "Lend time & hands" },
  { id: "wildlife_rehabilitator", icon: "🦝", label: "Wildlife Rehabilitator", sub: "Licensed wildlife care" },
  { id: "animal_lover", icon: "💛", label: "Animal Lover", sub: "Share + support" },
];

const US_STATES = ["AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"];

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
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [zip, setZip] = useState("");
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [betaTester, setBetaTester] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // Alert preferences
  const [alertUrgency, setAlertUrgency] = useState<AlertUrgency>("critical");
  const [alertPerDay, setAlertPerDay] = useState(0);
  const [breedsText, setBreedsText] = useState("");
  const [stateMode, setStateMode] = useState<"nationwide" | "mine" | "custom">("mine");
  const [myState, setMyState] = useState("TX");
  const [customStates, setCustomStates] = useState<string[]>([]);
  const [wantInApp, setWantInApp] = useState(true);
  const [wantText, setWantText] = useState(false);
  const [smsConsent, setSmsConsent] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSelected(initialRole ? [initialRole] : []);
    setName("");
    setEmail("");
    setZip("");
    setPhone("");
    setConsent(false);
    setBetaTester(false);
    setError(null);
    setDone(false);
    setAlertUrgency("critical");
    setAlertPerDay(0);
    setBreedsText("");
    setStateMode("mine");
    setMyState("TX");
    setCustomStates([]);
    setWantInApp(true);
    setWantText(false);
    setSmsConsent(false);
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
    // Role is optional — someone can join just to follow along / get launch
    // updates without committing to a role.
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setError("Enter a valid email.");
    if (!zip.trim()) return setError("Enter your ZIP / postal code.");
    if (wantText && !phone.trim()) return setError("Add a phone number to get text alerts.");
    if (wantText && !smsConsent) return setError("Please agree to receive texts, or uncheck Text alerts.");
    if (!consent) return setError("Please accept Privacy & Terms to continue.");
    setSubmitting(true);
    try {
      const turnstileToken = await getTurnstileToken();
      const alertChannels: AlertChannel[] = [
        ...(wantInApp ? (["in_app"] as AlertChannel[]) : []),
        ...(wantText ? (["text"] as AlertChannel[]) : []),
      ];
      const alertBreeds = breedsText
        .split(",")
        .map((b) => b.trim())
        .filter(Boolean);
      const alertStates =
        stateMode === "nationwide"
          ? []
          : stateMode === "mine"
            ? (myState ? [myState] : [])
            : customStates.slice();
      await submitNetworkSignup({
        data: {
          name: name.trim() || undefined,
          email: email.trim(),
          zip: zip.trim(),
          phone: phone.trim() || undefined,
          city,
          roles: selected,
          betaTester,
          turnstileToken,
          alertChannels,
          alertBreeds,
          alertUrgency,
          alertStates,
          alertPerDay,
          smsConsent,
        },
      });
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't submit. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const fieldClass =
    "mt-1 w-full rounded-xl border border-[#D9D2C2] bg-white px-3 py-2 text-[14px] outline-none focus:border-[#C9871A]";
  const labelClass =
    "text-[11px] font-semibold uppercase tracking-wider text-foreground/60";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="relative max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl"
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
              You're in the Voyce Pack! 🐾
            </h2>
            <p className="mt-2 text-[14px] leading-relaxed text-foreground/75">
              We'll alert you the way you chose the moment a matching animal needs help
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
              Join the Voyce Pack{city ? ` in ${city}` : " in your area"}
            </h2>
            <p className="mt-1.5 text-[13.5px] leading-relaxed text-foreground/70">
              We're building the pack animal by animal. Your sign-up means
              the next {animalName || "rescue"} reaches someone — instead of no one.
            </p>

            <p className="mt-4 text-[11px] font-semibold uppercase tracking-wider text-foreground/55">
              How do you want to help?{" "}
              <span className="font-normal normal-case text-foreground/45">(optional — you can just follow along)</span>
            </p>
            <div className="mt-1.5 space-y-1.5">
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
                <span className={labelClass}>Name</span>
                <input
                  type="text"
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  className={fieldClass}
                />
              </label>
              <label className="block sm:col-span-2">
                <span className={labelClass}>Email *</span>
                <input
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className={fieldClass}
                />
              </label>
              <label className="block">
                <span className={labelClass}>ZIP *</span>
                <input
                  type="text"
                  inputMode="text"
                  autoComplete="postal-code"
                  value={zip}
                  onChange={(e) => setZip(e.target.value)}
                  placeholder="90210"
                  className={fieldClass}
                />
              </label>
              <label className="block">
                <span className={labelClass}>Phone (for text alerts)</span>
                <input
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="555 555 5555"
                  className={fieldClass}
                />
              </label>
            </div>

            {/* Alert preferences */}
            <div className="mt-5 rounded-2xl border-2 border-[#EAE6DE] bg-[#FAF8F5] p-3.5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-foreground/55">
                Alert me about
              </p>

              <div className="mt-2 grid gap-2.5 sm:grid-cols-2">
                <label className="block">
                  <span className={labelClass}>How urgent</span>
                  <select
                    value={alertUrgency}
                    onChange={(e) => setAlertUrgency(e.target.value as AlertUrgency)}
                    className={fieldClass}
                  >
                    <option value="last_chance">Last Chance only (euthanasia now/today)</option>
                    <option value="critical">All critical</option>
                    <option value="atrisk">Everything at risk</option>
                  </select>
                </label>
                <label className="block">
                  <span className={labelClass}>How often</span>
                  <select
                    value={alertPerDay}
                    onChange={(e) => setAlertPerDay(Number(e.target.value))}
                    className={fieldClass}
                  >
                    <option value={0}>As it happens</option>
                    <option value={1}>Once a day</option>
                    <option value={2}>Twice a day</option>
                    <option value={3}>3× a day</option>
                    <option value={24}>Hourly</option>
                  </select>
                </label>
                <label className="block">
                  <span className={labelClass}>Breeds (blank = any)</span>
                  <input
                    type="text"
                    value={breedsText}
                    onChange={(e) => setBreedsText(e.target.value)}
                    placeholder="e.g. Husky, Pit Bull"
                    className={fieldClass}
                  />
                </label>
                <div className="sm:col-span-2">
                  <span className={labelClass}>Where — states to watch</span>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {([["mine", "My state"], ["custom", "Pick states"], ["nationwide", "Anywhere"]] as const).map(
                      ([m, lbl]) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setStateMode(m)}
                          className="rounded-full px-3 py-1 text-[12px] font-semibold transition active:scale-95"
                          style={
                            stateMode === m
                              ? { background: "#FFDF3B", color: "#3A2A07" }
                              : { background: "#FFFFFF", color: "#6B5832", border: "1px solid #D9D2C2" }
                          }
                        >
                          {lbl}
                        </button>
                      ),
                    )}
                  </div>
                  {stateMode === "mine" && (
                    <select
                      value={myState}
                      onChange={(e) => setMyState(e.target.value)}
                      className={fieldClass}
                      aria-label="My state"
                    >
                      {US_STATES.map((st) => (
                        <option key={st} value={st}>{st}</option>
                      ))}
                    </select>
                  )}
                  {stateMode === "custom" && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {US_STATES.map((st) => {
                        const on = customStates.includes(st);
                        return (
                          <button
                            key={st}
                            type="button"
                            onClick={() =>
                              setCustomStates((prev) =>
                                prev.includes(st) ? prev.filter((x) => x !== st) : [...prev, st],
                              )
                            }
                            className="rounded-md px-2 py-1 text-[11px] font-semibold transition active:scale-95"
                            style={
                              on
                                ? { background: "#FFDF3B", color: "#3A2A07" }
                                : { background: "#FFFFFF", color: "#6B5832", border: "1px solid #E3DAC4" }
                            }
                          >
                            {st}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {stateMode === "nationwide" && (
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Alerts for every state, as more cities come online.
                    </p>
                  )}
                </div>
              </div>

              <p className="mt-3 text-[11px] font-semibold uppercase tracking-wider text-foreground/55">
                How should we reach you?
              </p>
              <div className="mt-1.5 space-y-1.5">
                <label className="flex items-center gap-2.5 text-[13px] text-foreground/80">
                  <input
                    type="checkbox"
                    checked={wantInApp}
                    onChange={(e) => setWantInApp(e.target.checked)}
                    className="h-4 w-4 accent-[#C9871A]"
                  />
                  <span>🔔 In the app</span>
                </label>
                <label className="flex items-center gap-2.5 text-[13px] text-foreground/80">
                  <input
                    type="checkbox"
                    checked={wantText}
                    onChange={(e) => setWantText(e.target.checked)}
                    className="h-4 w-4 accent-[#C9871A]"
                  />
                  <span>💬 Text me</span>
                </label>
                {wantText && (
                  <label className="flex items-start gap-2.5 rounded-xl bg-white px-3 py-2 text-[12px] leading-snug text-foreground/75">
                    <input
                      type="checkbox"
                      checked={smsConsent}
                      onChange={(e) => setSmsConsent(e.target.checked)}
                      className="mt-0.5 h-4 w-4 accent-[#C9871A]"
                    />
                    <span>
                      I agree to receive text alerts at the number above. Msg &amp; data
                      rates may apply; reply STOP to opt out anytime.
                    </span>
                  </label>
                )}
              </div>
            </div>

            <label className="mt-4 flex items-start gap-2.5 rounded-2xl border-2 border-[#EAE6DE] bg-[#FAF8F5] px-3.5 py-2.5 text-[12.5px] leading-snug text-foreground/80">
              <input
                type="checkbox"
                checked={betaTester}
                onChange={(e) => setBetaTester(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-[#C9871A]"
              />
              <span>🧪 <strong>Help test Voyce before launch.</strong> Add me to the early testing team.</span>
            </label>

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
                consent to alerts for my area.
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
              {submitting ? "Joining…" : "Join the Pack →"}
            </button>

            <p className="mt-3 text-center text-[11px] italic text-foreground/55">
              Protected by silent verification. No spam — only the alerts you chose.
            </p>

            {/* Always-visible way back — the top ✕ scrolls out of view on this
                long form, so offer a clear exit at the bottom too. */}
            <button
              type="button"
              onClick={onClose}
              className="mt-3 w-full rounded-2xl border border-[#D9D2C2] bg-white px-5 py-2.5 text-[13px] font-semibold text-foreground/70 transition hover:bg-[#FAF8F5] active:scale-[0.99]"
            >
              ← Maybe later
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
