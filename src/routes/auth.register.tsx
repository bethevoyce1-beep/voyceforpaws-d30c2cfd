import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { signUpEmail, signInWithProvider, authClient } from "@/lib/auth";
import { VoyceMark } from "@/components/voyce/VoyceMark";

// Join the Pack — account sign-up. Optional to use the app, but required to
// report an animal (keeps the network trusted). Guests can "just look" instead.
export const Route = createFileRoute("/auth/register")({ component: Register });

// The ways a member can help — saved with their sign-up so we alert them for
// the right animals. Optional; someone can join just to follow along.
const ROLES: { id: string; icon: string; label: string }[] = [
  { id: "rescuer",   icon: "🐾", label: "Rescuer" },
  { id: "foster",    icon: "🏠", label: "Foster" },
  { id: "vet",       icon: "🩺", label: "Vet" },
  { id: "shelter",   icon: "🏛", label: "Shelter" },
  { id: "volunteer", icon: "🙌", label: "Volunteer" },
  { id: "animal_lover", icon: "💛", label: "Animal lover" },
];

function Register() {
  const nav = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // Alert preferences folded into sign-up (all optional).
  const [zip, setZip] = useState("");
  const [roles, setRoles] = useState<string[]>([]);
  const [phone, setPhone] = useState("");
  const [wantText, setWantText] = useState(false);
  const [smsConsent, setSmsConsent] = useState(false);

  const submit = async () => {
    setErr(null);
    if (!name.trim() || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim()) || pw.length < 8) {
      setErr("Enter your name, a valid email, and a password of at least 8 characters.");
      return;
    }
    if (wantText && !phone.trim()) { setErr("Add a phone number for text alerts, or uncheck it."); return; }
    if (wantText && !smsConsent) { setErr("Please agree to receive texts, or uncheck text alerts."); return; }
    setBusy(true);
    try {
      const { data, error } = await signUpEmail(name.trim(), email.trim(), pw);
      if (error) { setErr(error.message); return; }
      // Save the member's alert preferences (best-effort — never blocks the
      // account). network_signups allows public inserts.
      try {
        const channels = wantText && smsConsent ? ["in_app", "text"] : ["in_app"];
        await authClient().from("network_signups").insert({
          name: name.trim() || null,
          email: email.trim().toLowerCase(),
          zip: zip.trim() || null,
          phone: phone.trim() || null,
          roles,
          source: "auth_register",
          alert_channels: channels,
          alert_urgency: "critical",
          sms_consent: wantText && smsConsent,
        });
      } catch { /* prefs are a bonus — ignore failures */ }
      // Zero-friction signup (like Final Fetch): if email confirmation is OFF,
      // sign-up returns a live session — drop them straight into the app. If
      // confirmation is ON there's no session yet, so send them to the
      // "check your email" page instead.
      if (data.session) { nav({ to: "/" }); } else { nav({ to: "/auth/verify-email" }); }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong — please try again.");
    } finally {
      setBusy(false);
    }
  };

  // One-tap Google / Apple / Facebook. On success the browser redirects to the
  // provider, so there's nothing more to do here; we only clear busy on an error.
  const oauth = async (provider: "google" | "apple" | "facebook") => {
    setErr(null);
    setBusy(true);
    try {
      const { error } = await signInWithProvider(provider);
      if (error) { setErr(error.message); setBusy(false); }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't start sign-in — please try again.");
      setBusy(false);
    }
  };

  const input = "mt-1 w-full rounded-xl border border-[#E2DED6] bg-white px-3.5 py-3 text-[15px] text-[#1A1611] outline-none focus:border-[#C9871A]";
  const label = "text-[11px] font-bold uppercase tracking-[0.14em] text-[#8A8175]";

  return (
    <div className="flex min-h-[100dvh] flex-col items-center bg-[#FBF7EC] px-5 py-10">
      <div className="mb-6 flex flex-col items-center text-center">
        <VoyceMark size={56} className="mb-2" />
        <div className="text-[22px] font-black tracking-tight text-[#0B0B0C]">Voyce <span className="italic text-[#C9871A]">for</span> Paws&trade;</div>
        <h1 className="mt-4 font-serif text-[26px] font-bold text-[#0B0B0C]">Join the pack</h1>
        <p className="mt-1 text-[13.5px] text-[#6B5832]">Be part of something that saves lives.</p>
      </div>

      <div className="w-full max-w-sm rounded-3xl border border-[#EDE5D8] bg-white/70 p-5 shadow-[0_8px_30px_-12px_rgba(60,40,10,0.15)]">
        {/* One-tap social sign-up — fastest, no password, pre-verified email */}
        <SocialButtons busy={busy} onPick={oauth} />

        <div className="my-4 flex items-center gap-3">
          <div className="h-px flex-1 bg-[#E3DAC4]" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#8A8175]">or</span>
          <div className="h-px flex-1 bg-[#E3DAC4]" />
        </div>

        <label className="block">
          <span className={label}>Your name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="First and last" className={input} />
        </label>
        <label className="mt-4 block">
          <span className={label}>Email</span>
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="you@email.com" className={input} />
        </label>
        <label className="mt-4 block">
          <span className={label}>Password</span>
          <div className="relative">
            <input value={pw} onChange={(e) => setPw(e.target.value)} type={show ? "text" : "password"} placeholder="At least 8 characters" className={input + " pr-11"}
              onKeyDown={(e) => { if (e.key === "Enter") void submit(); }} />
            <button type="button" onClick={() => setShow((s) => !s)} aria-label="Show password"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-[13px] text-[#8A8175]">{show ? "🙈" : "👁"}</button>
          </div>
        </label>

        {/* Alert preferences — so a verified member also gets the right alerts. */}
        <div className="mt-5 rounded-2xl border border-[#EDE5D8] bg-[#FBF7EC] p-3.5">
          <div className={label}>How can you help? <span className="font-normal normal-case text-[#8A8175]">(optional)</span></div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {ROLES.map((r) => {
              const on = roles.includes(r.id);
              return (
                <button key={r.id} type="button"
                  onClick={() => setRoles((prev) => prev.includes(r.id) ? prev.filter((x) => x !== r.id) : [...prev, r.id])}
                  className="rounded-full border-2 px-2.5 py-1 text-[12.5px] font-semibold transition active:scale-95"
                  style={on ? { borderColor: "#FFDF3B", background: "#FFF7D6", color: "#8A5A0E" } : { borderColor: "#E3DAC4", background: "#fff", color: "#6B5832" }}>
                  {r.icon} {r.label}
                </button>
              );
            })}
          </div>
          <label className="mt-3 block">
            <span className={label}>ZIP <span className="font-normal normal-case text-[#8A8175]">(for nearby alerts)</span></span>
            <input value={zip} onChange={(e) => setZip(e.target.value)} inputMode="text" autoComplete="postal-code" placeholder="90210" className={input} />
          </label>
          <label className="mt-3 flex items-center gap-2.5 text-[13px] text-[#3A2A07]">
            <input type="checkbox" checked={wantText} onChange={(e) => setWantText(e.target.checked)} className="h-4 w-4 accent-[#C9871A]" />
            <span>💬 Also text me urgent alerts</span>
          </label>
          {wantText && (
            <>
              <label className="mt-2 block">
                <span className={label}>Phone</span>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" inputMode="tel" autoComplete="tel" placeholder="555 555 5555" className={input} />
              </label>
              <label className="mt-2 flex items-start gap-2.5 text-[11.5px] leading-snug text-[#6B5832]">
                <input type="checkbox" checked={smsConsent} onChange={(e) => setSmsConsent(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#C9871A]" />
                <span>I agree to receive text alerts. Msg &amp; data rates may apply; reply STOP to opt out.</span>
              </label>
            </>
          )}
        </div>

        {err && <p className="mt-3 rounded-xl bg-[#FCE4E4] px-3 py-2 text-[12.5px] font-medium text-[#7E1F1F]">{err}</p>}

        <button type="button" onClick={submit} disabled={busy}
          className="mt-5 w-full rounded-2xl px-5 py-3.5 text-[15px] font-bold text-[#3A2A07] shadow transition active:scale-[0.99] disabled:opacity-60"
          style={{ background: "linear-gradient(135deg,#FFDF3B,#C9871A)" }}>
          {busy ? "Creating your account…" : "Create account"}
        </button>

        <p className="mt-3 text-center text-[13px] text-[#6B5832]">
          Already have an account? <a href="/auth/login" className="font-bold text-[#C9871A] hover:underline">Sign in</a>
        </p>
      </div>

      <a href="/" className="mt-6 text-[13px] font-semibold text-[#8A5A0E] underline-offset-2 hover:underline">
        Just looking? Explore the app first →
      </a>
      <p className="mt-2 max-w-xs text-center text-[11px] leading-relaxed text-muted-foreground">
        You can browse and try Voyce without an account. You'll only need to join the pack when you report an animal.
      </p>
    </div>
  );
}

// Shared "Continue with Google / Apple / Facebook" buttons.
function SocialButtons({ busy, onPick }: { busy: boolean; onPick: (p: "google" | "apple" | "facebook") => void }) {
  return (
    <div className="flex flex-col gap-2">
      <button type="button" onClick={() => onPick("google")} disabled={busy}
        className="flex w-full items-center justify-center gap-2.5 rounded-2xl border border-[#E2DED6] bg-white px-5 py-3 text-[14.5px] font-semibold text-[#1A1611] shadow-sm transition active:scale-[0.99] disabled:opacity-60">
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
          <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.7-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8z" />
          <path fill="#34A853" d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9H1.4v3.1C3.4 21.3 7.4 24 12 24z" />
          <path fill="#FBBC05" d="M5.4 14.4c-.2-.7-.4-1.4-.4-2.4s.1-1.7.4-2.4V6.5H1.4C.5 8.2 0 10 0 12s.5 3.8 1.4 5.5l4-3.1z" />
          <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.5 1.8l3.4-3.4C17.9 1.2 15.2 0 12 0 7.4 0 3.4 2.7 1.4 6.5l4 3.1C6.3 6.8 8.9 4.8 12 4.8z" />
        </svg>
        <span>Continue with Google</span>
      </button>
      <button type="button" onClick={() => onPick("apple")} disabled={busy}
        className="flex w-full items-center justify-center gap-2.5 rounded-2xl bg-[#1A1611] px-5 py-3 text-[14.5px] font-semibold text-white shadow-sm transition active:scale-[0.99] disabled:opacity-60">
        <svg viewBox="0 0 24 24" width="17" height="17" fill="#fff" aria-hidden>
          <path d="M16.365 1.43c0 1.14-.42 2.2-1.12 2.99-.76.86-2 1.52-3.02 1.44-.13-1.1.44-2.28 1.1-3.02.74-.84 2.02-1.46 3.04-1.41zM20.5 17.06c-.55 1.27-.82 1.84-1.53 2.96-.99 1.57-2.38 3.53-4.1 3.54-1.53.01-1.92-.99-4-.98-2.08.01-2.51.99-4.04.98-1.72-.01-3.04-1.77-4.03-3.34C.02 16.6-.35 12.4 1.3 9.98c1.1-1.63 2.86-2.58 4.5-2.58 1.68 0 2.73 1 4.12 1 1.35 0 2.17-1 4.11-1 1.47 0 3.03.8 4.14 2.18-3.64 1.99-3.05 7.18.23 8.48z" />
        </svg>
        <span>Continue with Apple</span>
      </button>
      <button type="button" onClick={() => onPick("facebook")} disabled={busy}
        className="flex w-full items-center justify-center gap-2.5 rounded-2xl px-5 py-3 text-[14.5px] font-semibold text-white shadow-sm transition active:scale-[0.99] disabled:opacity-60"
        style={{ background: "#1877F2" }}>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="#fff" aria-hidden>
          <path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.95.93-1.95 1.88v2.26h3.32l-.53 3.49h-2.79V24C19.61 23.1 24 18.1 24 12.07z" />
        </svg>
        <span>Continue with Facebook</span>
      </button>
    </div>
  );
}
