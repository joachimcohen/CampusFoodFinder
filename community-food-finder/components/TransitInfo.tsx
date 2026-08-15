import { TrainFront } from "lucide-react";
import { PTV_ATTRIBUTION } from "@/lib/ptv-attribution";

/** Nearest-stop line + required CC BY 4.0 attribution (Section 7.2). Renders nothing if no cached stop yet. */
export default function TransitInfo({
  stopName,
  walkMinutes,
}: {
  stopName: string | null;
  walkMinutes: number | null;
}) {
  if (!stopName || walkMinutes === null) return null;

  return (
    <p className="flex items-center gap-1 text-xs text-[var(--color-foreground)]/70" title={PTV_ATTRIBUTION}>
      <TrainFront size={13} strokeWidth={2} aria-hidden />
      {walkMinutes} min walk to {stopName}
    </p>
  );
}
