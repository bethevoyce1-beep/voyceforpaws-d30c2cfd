import type { Assessment } from "@/lib/analyze.functions";
import type { MissionId } from "@/lib/missions";
import { RescueCard } from "@/components/voyce/RescueCard";

// RescueReport is now a thin wrapper over the unified RescueCard. The old
// two-card capture flow (a long "Rescue Report" card, then a separate "Share"
// card) has been merged into ONE streamlined card. Here the report card's
// "Continue" skips the old share step and goes straight to the timeline
// (onDone), so the reporter only ever sees a single card.
export function RescueReport(props: {
  image: string;
  data: Assessment;
  mission: MissionId;
  location?: { lat: number; lon: number; label: string } | null;
  situation?: string;
  animals?: Assessment[];
  animalIndex?: number;
  onSelectAnimal?: (i: number) => void;
  onContinue: () => void;
  onDone?: () => void;
  onSend?: () => void;
  onEditDetails?: () => void;
}) {
  return <RescueCard {...props} onContinue={props.onDone ?? props.onContinue} />;
}
