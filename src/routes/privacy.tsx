/**
 * Voyce — Privacy Policy
 *
 * Public-facing, app-owned editable content. Maintained by Voyce. Includes
 * the AI honesty disclosures required across the product so users have a
 * single canonical reference.
 */
import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — Voyce" },
      {
        name: "description",
        content:
          "How Voyce collects, uses, and protects information — including how AI assessments are generated and the limits of that AI.",
      },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <div className="min-h-[100dvh] bg-[#FAF8F5] px-5 py-10 text-[15px] leading-relaxed text-foreground">
      <div className="mx-auto max-w-2xl">
        <Link to="/" className="text-[12px] font-medium uppercase tracking-[0.14em] text-[#8A5A0E]">
          ← Back to Voyce
        </Link>
        <h1 className="mt-3 font-serif text-3xl font-semibold tracking-tight">Privacy Policy</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          This page is maintained by Voyce. Last updated: June 2026.
        </p>

        <Section title="1. What we collect">
          When you submit a rescue report, Voyce processes the photo you provide, your approximate
          location (from your device's GPS, when you allow it), and any text you add. We do not ask
          for your name or contact information for an anonymous report.
        </Section>

        <Section title="2. AI processing &amp; limitations">
          <p>
            Voyce uses <strong>Google Gemini Flash</strong>, a multimodal AI model, to assess
            animal photos. AI processing happens on Google servers. Photos are sent for analysis
            but are not stored by the AI provider for training.
          </p>
          <p className="mt-2">
            AI assessments may be inaccurate, incomplete, or wrong about species, breed, age,
            condition, urgency, environment, or any other field. The AI <strong>cannot</strong>{" "}
            detect internal injuries or diseases, diagnose any medical condition, estimate exact
            age, weight, or breed, assess parasites, pain, pregnancy, or vaccination status, or
            replace a veterinary examination.
          </p>
          <p className="mt-2 italic">
            Always verify with a licensed veterinarian before any medical, rescue, or transport
            decision. Voyce is not liable for outcomes from acting on an AI assessment.
          </p>
        </Section>


        <Section title="3. How we use your data">
          Photos and location are used to generate the rescue card, notify nearby responders, and
          improve the service. We do not sell your data.
        </Section>

        <Section title="4. Sharing">
          Rescue cards are public by default so the network can help. Avoid including identifying
          information about people in your photos or notes.
        </Section>

        <Section title="5. Retention &amp; deletion">
          You may request deletion of any report you submitted. Contact details are in the app.
        </Section>

        <Section title="6. Contact">
          Questions? Reach out via the in-app help link.
        </Section>

        <div className="mt-10 text-[12px] uppercase tracking-[0.14em] text-muted-foreground">
          AI is advisory — not a diagnosis
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="font-serif text-lg font-semibold tracking-tight">{title}</h2>
      <div className="mt-1 text-foreground/85">{children}</div>
    </section>
  );
}
