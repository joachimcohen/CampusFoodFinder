import { LISTING_TYPE_LABELS, type ListingType } from "@/lib/types";

export default function ListingTypeBadge({ listingType }: { listingType: ListingType }) {
  const bg =
    listingType === "every_week" ? "var(--color-badge-every-week)" : "var(--color-badge-special-event)";
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-white"
      style={{ backgroundColor: bg }}
    >
      {LISTING_TYPE_LABELS[listingType]}
    </span>
  );
}
