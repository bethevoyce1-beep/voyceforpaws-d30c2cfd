/**
 * Voyce — Terms of Service
 *
 * Public-facing, app-owned editable content. Maintained by Voyce. Includes
 * the AI honesty disclosures so users have a single canonical reference.
 */
import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — Voyce" },
      {
        name: "description",
        content:
          "The terms that govern your use of Voyce, including the limits of the AI assessment and the responsibilities of users and responders.",
      },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <div className="min-h-[100dvh] bg-[#FAF8F5] px-5 py-10 text-[15px] leading-relaxed text-foreground">
      <div className="mx-auto max-w-2xl">
        <Link to="/" className="text-[12px] font-medium uppercase tracking-[0.14em] text-[#8A5A0E]">
          ← Back to Voyce
        </Link>
        <h1 className="mt-3 font-serif text-3xl font-semibold tracking-tight">Terms of Service</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          This page is maintained by Voyce. Last updated: July 2026.
        </p>

        <Section title="1. Acceptance">
          By using Voyce, you agree to these terms. If you don't, please don't use the service.
        </Section>

        <Section title="2. AI assessment limitations &amp; liability">
          <p>You acknowledge and agree:</p>
          <ol className="mt-2 list-decimal space-y-1.5 pl-5">
            <li>
              Voyce uses AI to generate animal assessments. These assessments are advisory only,
              not professional veterinary diagnosis.
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
              Voyce, its operators, and its volunteers are not liable for outcomes resulting from
              AI assessments, user actions, or third-party responses to alerts.
            </li>
            <li>
              Voyce facilitates connections between people who want to help animals. We do not
              guarantee responses, outcomes, or safety of any rescue operation.
            </li>
            <li>Use Voyce in good faith. Report only animals genuinely in need.</li>
            <li>For wildlife: do not handle yourself unless you are licensed.</li>
          </ol>
        </Section>


        <Section title="3. Responder responsibility">
          Final assessments and decisions rest with rescuers and licensed vets, not with Voyce or
          its AI. Use your judgment in the field and follow local laws.
        </Section>

        <Section title="4. Sharing">
          Reports you create may be shared publicly to help mobilize the rescue network. Do not
          submit content you don't have the right to share.
        </Section>

        <Section title="5. Intellectual property &amp; copyright">
          <p>
            Voyce for Paws, including its name, logo, brand, page and card designs, text, code,
            rescue-card formats, and all related content, is owned by Be the Voyce, Inc. and is
            protected by copyright and trademark law. &copy; 2026 Be the Voyce, Inc. All rights
            reserved.
          </p>
          <ol className="mt-2 list-decimal space-y-1.5 pl-5">
            <li>
              You may not copy, reproduce, republish, scrape, mirror, reverse-engineer, or create
              derivative works from any part of the service without our prior written permission.
            </li>
            <li>
              &ldquo;Voyce for Paws,&rdquo; the Voyce for Paws logo, and related marks are
              trademarks of Be the Voyce, Inc. You may not use them without permission.
            </li>
            <li>
              Rescue cards are provided to help the specific animal shown. You may share them to
              mobilize help, but not repurpose, resell, or use them for unrelated commercial
              purposes.
            </li>
            <li>
              You keep ownership of photos you upload, and grant Voyce a limited license to use
              them solely to operate the service and coordinate rescue.
            </li>
          </ol>
        </Section>

        <Section title="6. No warranty">
          Voyce is provided "as is" without warranty of any kind. To the maximum extent permitted
          by law, Voyce disclaims all liability for any loss or harm arising from use of the
          service or reliance on AI output.
        </Section>

        <Section title="7. Changes">
          We may update these terms. Continued use means you accept the updated terms.
        </Section>

        <Section title="8. Contact">
          Questions? Reach out via the in-app help link.
        </Section>

        <div className="mt-10 border-t border-[#EDE5D8] pt-4 text-[12px] text-muted-foreground">
          <div>
            &copy; 2026 Be the Voyce, Inc. All rights reserved. &ldquo;Voyce for Paws&rdquo; is a
            trademark of Be the Voyce, Inc.
          </div>
          <div className="mt-1 uppercase tracking-[0.14em]">AI is advisory · not a diagnosis</div>
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
