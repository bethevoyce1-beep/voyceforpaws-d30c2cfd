import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { signInEmail, currentUser } from "@/lib/auth";

// Sign in. Also handles the landing after the email-confirmation link: if a
// session is already present (captured from the URL), it sends you into the app.
export const Route = createFileRoute("/auth/login")({ component: Login });

function Login() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

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

  const input = "mt-1 w-full rounded-xl border border-[#E2DED6] bg-white px-3.5 py-3 text-[15px] text-[#1A1611] outline-none focus:border-[#C9871A]";
  const label = "text-[11px] font-bold uppercase tracking-[0.14em] text-[#8A8175]";

  return (
    <div className="flex min-h-[100dvh] flex-col items-center bg-[#FBF7EC] px-5 py-10">
      <div className="mb-6 flex flex-col items-center text-center">
        <span className="mb-2 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#0B0B0C] text-[28px]">🐾</span>
        <div className="text-[22px] font-black tracking-tight text-[#0B0B0C]">Voyce <span className="italic text-[#C9871A]">for</span> Paws&trade;</div>
        <h1 className="mt-4 font-serif text-[26px] font-bold text-[#0B0B0C]">Welcome back</h1>
        <p className="mt-1 text-[13.5px] text-[#6B5832]">Sign in to the pack.</p>
      </div>

      {note && <div className="mb-4 w-full max-w-sm rounded-2xl bg-[#E7F5EC] px-4 py-3 text-center text-[13.5px] font-semibold text-[#1F6B3D]">{note}</div>}

      <div className="w-full max-w-sm rounded-3xl border border-[#EDE5D8] bg-white/70 p-5 shadow-[0_8px_30px_-12px_rgba(60,40,10,0.15)]">
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
