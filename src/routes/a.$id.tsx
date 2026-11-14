import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { getAcsAnimal, statusLabel, type AcsAnimalPage } from "@/lib/acs.functions";
import { AcsShareCard } from "@/components/voyce/AcsShareCard";
import { BrandHeader } from "@/components/voyce/BrandHeader";
import { animalUrl, deadlineWords, vitalsLine, APP_ORIGIN } from "@/lib/animalShare";

// =============================================================
// Public page for one shelter animal (/a/<ACS ID>). This is the link every
// Share sends, so it is what Facebook, Nextdoor, iMessage and the rest read
// when they draw a preview: the animal's own photo, name, status and deadline
// come from the tags below. The page itself is the same card the app shows.
// =============================================================

const FALLBACK_IMAGE =
  "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/a22290e8-4720-442b-aa62-697e9e9cf7cb";

function titleCase(s: string): string {
  return s.toLowerCase().replace(/\b([a-z])/g, (m) => m.toUpperCase());
}

export const Route = createFileRoute("/a/$id")({
  loader: async ({ params }) => getAcsAnimal({ data: { id: params.id } }),
  head: ({ loaderData, params }) => {
    const page = loaderData as AcsAnimalPage | undefined;
    const a = page?.animal ?? null;
    if (!a) {
      return {
        meta: [
          { title: "Voyce for Paws" },
          { property: "og:title", content: "Voyce for Paws" },
          { property: "og:description", content: "Shelter animals who need a foster, rescue, or adopter." },
          { property: "og:image", content: FALLBACK_IMAGE },
        ],
      };
    }
    const name = a.name && a.name !== "Unnamed" ? titleCase(a.name) : `Animal ${a.id}`;
    const shelter = page?.shelter_name ?? "San Antonio ACS";
    const title = `${statusLabel(a)}: ${name} at ${shelter}`;
    const when = deadlineWords(a);
    const vitals = vitalsLine(a);
    const desc = [
      when ? `Needs out by ${when}.` : null,
      vitals ? `${vitals}.` : null,
      `ID ${a.id}. Foster, rescue, adopt, or share.`,
    ]
      .filter(Boolean)
      .join(" ");
    const image = a.thumb || a.photos?.[0] || FALLBACK_IMAGE;
    const url = animalUrl(a.id || params.id);
    return {
      meta: [
        { title: `${name} · Voyce for Paws` },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:image", content: image },
        { property: "og:image:alt", content: `Photo of ${name}` },
        { property: "og:url", content: url },
        { property: "og:type", content: "website" },
        { property: "og:site_name", content: "Voyce for Paws" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: desc },
        { name: "twitter:image", content: image },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
  component: AnimalPage,
});

function AnimalPage() {
  const page = Route.useLoaderData() as AcsAnimalPage;
  const navigate = useNavigate();
  const a = page?.animal ?? null;

  if (!a) {
    return (
      <div className="min-h-[100dvh] bg-[#FAF7F1]">
        <BrandHeader />
        <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-6 pt-20 text-center">
          <div className="text-4xl">🐾</div>
          <h1 className="font-serif text-2xl font-bold text-[#8A5A0E]">We couldn&rsquo;t find this animal</h1>
          <p className="text-[14px] leading-relaxed text-muted-foreground">
            The ID in the link may be mistyped. You can still see every animal the shelter has listed.
          </p>
          <a
            href={APP_ORIGIN}
            className="rounded-2xl px-5 py-3 text-[14px] font-bold text-[#3A2A07] shadow"
            style={{ background: "linear-gradient(135deg,#FFDF3B,#C9871A)" }}
          >
            See the at-risk list
          </a>
        </div>
      </div>
    );
  }

  return (
    <AcsShareCard
      animal={a}
      guide={page.status_guide}
      onContinue={() => void navigate({ to: "/" })}
    />
  );
}
