import { createFileRoute } from "@tanstack/react-router";
import { VoyceMark } from "@/components/voyce/VoyceMark";

// Shown right after sign-up — tells the person to confirm their email.
export const Route = createFileRoute("/auth/verify-email")({ component: VerifyEmail });

function VerifyEmail() {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center bg-[#FBF7EC] px-5 py-10">
      <div className="mb-6 flex flex-col items-center text-center">
        <VoyceMark size={56} className="mb-2" />
        <div className="text-[22px] font-black tracking-tight text-[#0B0B0C]">Voyce <span className="italic text-[#C9871A]">for</span> Paws&trade;</div>
      </div>

      <div className="w-full max-w-sm rounded-3xl border border-[#EDE5D8] bg-white/70 p-6 text-center shadow-[0_8px_30px_-12px_rgba(60,40,10,0.15)]">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#FFF3C4] text-[30px]">✉️</div>
        <h1 className="mt-4 font-serif text-[24px] font-bold text-[#0B0B0C]">Check your email</h1>
        <p className="mt-2 text-[13.5px] leading-relaxed text-[#6B5832]">
          We sent a confirmation link to your email. Click it to activate your account and get started.
        </p>

        <div className="mt-5 rounded-2xl border border-[#EDE5D8] bg-[#FBF7EC] px-4 py-3 text-left">
          <div className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#8A8175]">What to do next</div>
          <ol className="mt-1.5 space-y-1 text-[13px] text-[#3A2A07]">
            <li>1. Open the email from <b>Voyce for Paws</b>.</li>
            <li>2. Tap <b>Confirm your email</b>.</li>
            <li>3. You'll land back here to sign in.</li>
          </ol>
        </div>

        <p className="mt-4 text-[12px] text-muted-foreground">Didn't get it? Check your spam folder.</p>
        <a href="/auth/login" className="mt-3 inline-block font-bold text-[#C9871A] hover:underline">Back to sign in</a>
      </div>

      <a href="/" className="mt-6 text-[13px] font-semibold text-[#8A5A0E] underline-offset-2 hover:underline">
        Explore the app while you wait →
      </a>
    </div>
  );
}
