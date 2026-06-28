import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const CONSENT_STORAGE_KEY = "voyce_consent";
export const CONSENT_VERSION = "1.0";

type StoredConsent = {
  voyce_consent: true;
  consent_version: string;
  consent_at: string;
};

export function hasValidConsent(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.localStorage.getItem(CONSENT_STORAGE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as Partial<StoredConsent>;
    return parsed?.voyce_consent === true && parsed.consent_version === CONSENT_VERSION;
  } catch {
    return false;
  }
}

async function hashString(input: string): Promise<string> {
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
      .slice(0, 32);
  }
  // Fallback: very weak — only used if SubtleCrypto unavailable.
  let h = 0;
  for (let i = 0; i < input.length; i++) h = (h * 31 + input.charCodeAt(i)) | 0;
  return String(h);
}

export function ConsentGate({ onAccept }: { onAccept: () => void }) {
  const [open, setOpen] = useState<"ai" | "privacy" | "terms" | null>("ai");
  const [acks, setAcks] = useState({ inaccurate: false, verify: false, agree: false });
  const [submitting, setSubmitting] = useState(false);

  const allChecked = acks.inaccurate && acks.verify && acks.agree;

  const toggle = (key: keyof typeof acks) =>
    setAcks((s) => ({ ...s, [key]: !s[key] }));

  const handleSubmit = async () => {
    if (!allChecked || submitting) return;
    setSubmitting(true);
    const consent_at = new Date().toISOString();

    const stored: StoredConsent = {
      voyce_consent: true,
      consent_version: CONSENT_VERSION,
      consent_at,
    };
    try {
      window.localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(stored));
    } catch {
      /* storage may be unavailable in private mode — proceed anyway */
    }

    // Best-effort anonymous log; never block UX on failure.
    try {
      const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
      const user_agent_hash = ua ? await hashString(ua) : null;
      await supabase.from("ai_consent_log").insert({
        consent_version: CONSENT_VERSION,
        consent_at,
        ip_hash: null, // IP is not available client-side; left null on purpose
        user_agent_hash,
        source: "web_consent_gate",
      });
    } catch (err) {
      console.warn("[voyce] consent log failed", err);
    }

    setSubmitting(false);
    onAccept();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="voyce-consent-title"
      className="fixed inset-0 z-50 flex items-stretch justify-center overflow-y-auto bg-[#3A2A07]/60 px-0 py-0 sm:items-center sm:px-4 sm:py-8"
    >
      <div className="flex w-full max-w-xl flex-col bg-[#FAF8F5] shadow-2xl sm:rounded-3xl sm:border sm:border-[#E8DCC2]">
        <div className="border-b border-[#E8DCC2] px-6 py-5">
          <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#8A5A0E]">
            🐾 Voyce — AI Use Agreement
          </div>
          <h1
            id="voyce-consent-title"
            className="mt-2 font-serif text-2xl font-semibold leading-tight tracking-tight text-[#3A2A07]"
          >
            Before you use Voyce
          </h1>
          <p className="mt-1 text-[13.5px] text-[#5a4a2a]">
            Quick agreement before the AI starts working. Takes 30 seconds.
          </p>
        </div>

        <div className="flex-1 space-y-2 px-4 py-4 sm:px-6">
          <Accordion
            id="ai"
            title="🤖 About Voyce's AI"
            isOpen={open === "ai"}
            onToggle={() => setOpen(open === "ai" ? null : "ai")}
          >
            <p>
              Voyce uses <strong>Google Gemini AI</strong> to analyze animal photos. The AI:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Identifies species, breed, age, condition, and urgency</li>
              <li>Generates a Rescue Profile and AI Health Assessment in seconds</li>
              <li>Is advisory only — not a veterinary diagnosis</li>
            </ul>
            <p className="mt-3 font-semibold text-[#A8431F]">What the AI CANNOT do:</p>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              <li>Detect internal injuries, diseases, parasites, pain, or pregnancy</li>
              <li>Examine the animal in person</li>
              <li>Replace a licensed veterinarian</li>
              <li>Guarantee accurate breed, age, or condition</li>
            </ul>
            <p className="mt-3 italic text-[#5a4a2a]">
              The AI may misidentify or make mistakes. Always verify with licensed professionals
              before making medical, rescue, or transport decisions.
            </p>
          </Accordion>

          <Accordion
            id="privacy"
            title="🛡️ Privacy Policy"
            isOpen={open === "privacy"}
            onToggle={() => setOpen(open === "privacy" ? null : "privacy")}
          >
            <PolicySection title="What we collect">
              When you submit a rescue report, Voyce processes the photo you provide, your
              approximate location (from your device's GPS, when you allow it), and any text you
              add. We do not ask for your name or contact information for an anonymous report.
            </PolicySection>
            <PolicySection title="AI processing &amp; limitations">
              <p>
                Voyce uses <strong>Google Gemini Flash</strong>, a multimodal AI model, to assess
                animal photos. AI processing happens on Google servers. Photos are sent for
                analysis but are not stored by the AI provider for training.
              </p>
              <p className="mt-2">
                AI assessments may be inaccurate, incomplete, or wrong about species, breed, age,
                condition, urgency, environment, or any other field. The AI cannot detect internal
                injuries or diseases, diagnose any medical condition, estimate exact age, weight,
                or breed, assess parasites, pain, pregnancy, or vaccination status, or replace a
                veterinary examination.
              </p>
              <p className="mt-2 italic">
                Always verify with a licensed veterinarian before any medical, rescue, or transport
                decision. Voyce is not liable for outcomes from acting on an AI assessment.
              </p>
            </PolicySection>
            <PolicySection title="How we use your data">
              Photos and location are used to generate the rescue card, notify nearby responders,
              and improve the service. We do not sell your data.
            </PolicySection>
            <PolicySection title="Sharing &amp; retention">
              Rescue cards are public by default so the network can help. You may request deletion
              of any report you submitted.
            </PolicySection>
          </Accordion>

          <Accordion
            id="terms"
            title="📜 Terms of Use"
            isOpen={open === "terms"}
            onToggle={() => setOpen(open === "terms" ? null : "terms")}
          >
            <PolicySection title="Acceptance">
              By using Voyce, you agree to these terms. If you don't, please don't use the service.
            </PolicySection>
            <PolicySection title="AI assessment limitations &amp; liability">
              <p>You acknowledge and agree:</p>
              <ol className="mt-2 list-decimal space-y-1.5 pl-5">
                <li>
                  Voyce uses AI to generate animal assessments. These assessments are advisory
                  only, not professional veterinary diagnosis.
                </li>
                <li>
                  AI may misidentify breed, age, species, condition, urgency level, or any other
                  detail.
                </li>
                <li>
                  AI cannot detect internal injuries, diseases, parasites, pain, pregnancy,
                  vaccination status, or behavior accurately.
                </li>
                <li>AI cannot replace examination by a licensed veterinarian.</li>
                <li>
                  You agree to verify AI assessments with licensed professionals before making
                  medical, rescue, transport, or care decisions.
                </li>
                <li>
                  Voyce, its operators, and its volunteers are not liable for outcomes resulting
                  from AI assessments, user actions, or third-party responses to alerts.
                </li>
                <li>
                  Voyce facilitates connections between people who want to help animals. We do not
                  guarantee responses, outcomes, or safety of any rescue operation.
                </li>
                <li>Use Voyce in good faith. Report only animals genuinely in need.</li>
                <li>For wildlife: do not handle yourself unless you are licensed.</li>
              </ol>
            </PolicySection>
            <PolicySection title="No warranty">
              Voyce is provided "as is" without warranty of any kind. To the maximum extent
              permitted by law, Voyce disclaims all liability for any loss or harm arising from use
              of the service or reliance on AI output.
            </PolicySection>
          </Accordion>
        </div>

        <div className="border-t border-[#E8DCC2] bg-[#FFFBEC] px-6 py-5">
          <div className="space-y-3">
            <CheckRow
              checked={acks.inaccurate}
              onChange={() => toggle("inaccurate")}
              label="I understand AI assessments may be inaccurate and are not veterinary diagnosis"
            />
            <CheckRow
              checked={acks.verify}
              onChange={() => toggle("verify")}
              label="I will verify with licensed professionals before making medical, rescue, or transport decisions"
            />
            <CheckRow
              checked={acks.agree}
              onChange={() => toggle("agree")}
              label="I agree to Voyce's Privacy Policy and Terms of Use"
            />
          </div>

          <button
            type="button"
            disabled={!allChecked || submitting}
            onClick={handleSubmit}
            className="mt-5 w-full rounded-full px-5 py-3.5 text-[15px] font-bold uppercase tracking-wide shadow-md transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
            style={{
              background:
                allChecked && !submitting
                  ? "linear-gradient(135deg, #FFD24A 0%, #C9871A 100%)"
                  : "#E8DCC2",
              color: allChecked && !submitting ? "#3A2A07" : "#8A5A0E",
            }}
          >
            {submitting ? "Saving…" : "I Agree & Continue →"}
          </button>
          <p className="mt-3 text-center text-[11.5px] italic text-[#8A5A0E]/80">
            Recorded for your safety — version {CONSENT_VERSION}.
          </p>
        </div>
      </div>
    </div>
  );
}

function Accordion({
  id,
  title,
  isOpen,
  onToggle,
  children,
}: {
  id: string;
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[#E8DCC2] bg-white">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls={`consent-${id}`}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-[#FFFBEC]"
      >
        <span className="font-serif text-[15px] font-semibold text-[#3A2A07]">{title}</span>
        <span
          aria-hidden
          className="text-[18px] leading-none text-[#8A5A0E] transition"
          style={{ transform: isOpen ? "rotate(180deg)" : "none" }}
        >
          ⌄
        </span>
      </button>
      {isOpen && (
        <div
          id={`consent-${id}`}
          className="border-t border-[#E8DCC2] px-4 py-3.5 text-[13.5px] leading-relaxed text-[#3A2A07]/90"
        >
          {children}
        </div>
      )}
    </div>
  );
}

function PolicySection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-3 first:mt-0">
      <h3 className="font-serif text-[14px] font-semibold tracking-tight text-[#3A2A07]">
        {title}
      </h3>
      <div className="mt-1 text-[13.5px] text-[#3A2A07]/85">{children}</div>
    </section>
  );
}

function CheckRow({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[#E8DCC2] bg-white px-3 py-2.5 transition hover:border-[#C9871A]/60">
      <span
        className="mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-md border-2 transition"
        style={{
          borderColor: checked ? "#C9871A" : "#C9B98A",
          background: checked ? "#C9871A" : "white",
          color: "white",
        }}
        aria-hidden
      >
        {checked && <span className="text-[12px] font-bold leading-none">✓</span>}
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="sr-only"
      />
      <span className="text-[13.5px] leading-snug text-[#3A2A07]">{label}</span>
    </label>
  );
}
