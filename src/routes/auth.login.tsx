import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { signInEmail, signInWithProvider, currentUser } from "@/lib/auth";
import { VoyceMark } from "@/components/voyce/VoyceMark";

// Sign in. Also handles the landing after the email-confirmation / OAuth
// redirect: if a session is already present (captured from the URL), it sends
// you into the app.
export const Route = createFileRoute("/auth/login")({ component: Login });

function Login() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  // If we arrived here already authenticated (e.g. straight after confirming
  // email, or returning from a Google / Apple sign-in), go into the app.
  useEffect(() => {
    void (async () => {
      try {
        const u = await currentUser();
        if (u) {
          setNote(`Welcome, ${u.name.split(" ")[0]} — taking you in…`);
          setTimeout(() => nav({ to: "/" }), 900);
        }
      } catch { /* ignore */ }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async () => {
    setErr(null);
    if (!email.trim() || !pw) { setErr("Enter your email and password."); return; }
    setBusy(true);
    try {
      const { error } = await signInEmail(email.trim(), pw);
      if (error) {
        setErr(/confirm/i.test(error.message) ? "Please confirm your email first — check your inbox." : error.message);
        return;
      }
      nav({ to: "/" });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't sign in — please try again.");
    } finally {
      setBusy(false);
    }
  };

  // One-tap Google / Apple. On success the browser redirects to the provider,
  // so there's nothing more to do here; we only clear busy on an error.
  const oauth = async (provider: "google" | "apple") => {
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
        <h1 className="mt-4 font-serif text-[26px] font-bold text-[#0B0B0C]">Welcome back</h1>
        <p className="mt-1 text-[13.5px] text-[#6B5832]">Sign in to the pack.</p>
      </div>

      {note && <div className="mb-4 w-full max-w-sm rounded-2xl bg-[#E7F5EC] px-4 py-3 text-center text-[13.5px] font-semibold text-[#1F6B3D]">{note}</div>}

      <div className="w-full max-w-sm rounded-3xl border border-[#EDE5D8] bg-white/70 p-5 shadow-[0_8px_30px_-12px_rgba(60,40,10,0.15)]">
        {/* One-tap social sign-in — fastest, no password, pre-verified email */}
        <SocialButtons busy={busy} onPick={oauth} />

        <div className="my-4 flex items-center gap-3">
          <div className="h-px flex-1 bg-[#E3DAC4]" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#8A8175]">or</span>
          <div className="h-px flex-1 bg-[#E3DAC4]" />
        </div>

        <label className="block">
          <span className={label}>Email</span>
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="you@email.com" className={input} />
        </label>
        <label className="mt-4 block">
          <span className={label}>Password</span>
          <div className="relative">
            <input value={pw} onChange={(e) => setPw(e.target.value)} type={show ? "text" : "password"} placeholder="Your password" className={input + " pr-11"}
              onKeyDown={(e) => { if (e.key === "Enter") void submit(); }} />
            <button type="button" onClick={() => setShow((s) => !s)} aria-label="Show password"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-[13px] text-[#8A8175]">{show ? "🙈" : "👁"}</button>
          </div>
        </label>

        {err && <p className="mt-3 rounded-xl bg-[#FCE4E4] px-3 py-2 text-[12.5px] font-medium text-[#7E1F1F]">{err}</p>}

        <button type="button" onClick={submit} disabled={busy}
          className="mt-5 w-full rounded-2xl px-5 py-3.5 text-[15px] font-bold text-[#3A2A07] shadow transition active:scale-[0.99] disabled:opacity-60"
          style={{ background: "linear-gradient(135deg,#FFDF3B,#C9871A)" }}>
          {busy ? "Signing in…" : "Sign in"}
        </button>

        <p className="mt-3 text-center text-[13px] text-[#6B5832]">
          New here? <a href="/auth/register" className="font-bold text-[#C9871A] hover:underline">Join the pack</a>
        </p>
      </div>

      <a href="/" className="mt-6 text-[13px] font-semibold text-[#8A5A0E] underline-offset-2 hover:underline">
        Just looking? Explore the app first →
      </a>
    </div>
  );
}

// Shared "Continue with Google / Apple" buttons.
function SocialButtons({ busy, onPick }: { busy: boolean; onPick: (p: "google" | "apple") => void }) {
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
    </div>
  );
}
