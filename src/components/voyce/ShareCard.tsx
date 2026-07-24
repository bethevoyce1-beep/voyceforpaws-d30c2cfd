import type { Assessment } from "@/lib/analyze.functions";
import type { MissionId } from "@/lib/missions";
import { RescueCard } from "@/components/voyce/RescueCard";

// ShareCard is now a thin wrapper over the unified RescueCard. It's the
// post-send confirmation view (reached after "Send to rescuers"), so it renders
// the same merged card without a "Send" button. The old separate share-card
// design is gone — there is only one card now.
export function ShareCard(props: {
  image: string;
  data: Assessment;
  mission: MissionId;
  location?: { lat: number; lon: number; label: string } | null;
  onContinue: () => void;
}) {
  return (
    <RescueCard
      image={props.image}
      data={props.data}
      mission={props.mission}
      location={props.location}
      onContinue={props.onContinue}
    />
  );
}
