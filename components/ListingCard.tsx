"use client";

import Image from "next/image";
import { Gift, Percent, Star, Repeat, PartyPopper } from "lucide-react";
import type { ListingWithRelations } from "@/lib/types";
import { DIETARY_TAG_LABELS, FOOD_TYPE_COLORS } from "@/lib/types";
import FoodTypeBadge from "./FoodTypeBadge";
import { formatPrice, getRecurrenceScheduleLabel, getStartsLabel, getTimeRemainingLabel } from "@/lib/listings";

const FOOD_TYPE_ICONS = {
  free_giveaway: Gift,
  discounted: Percent,
  daily_special: Star,
  recurring_event: Repeat,
  one_off_event: PartyPopper,
} as const;

export default function ListingCard({
  listing,
  mode,
}: {
  listing: ListingWithRelations;
  mode: "happening-now" | "coming-up" | "weekly";
}) {
  const Icon = FOOD_TYPE_ICONS[listing.food_type];
  const timeLabel =
    mode === "happening-now"
      ? getTimeRemainingLabel(listing)
      : mode === "coming-up"
        ? getStartsLabel(listing)
        : getRecurrenceScheduleLabel(listing);
  const isUrgent = mode === "happening-now" && timeLabel.includes("min") && !timeLabel.includes("Today");
  // A listing's own pickup location (for vendors without a fixed spot) takes
  // priority over the vendor's general location when set.
  const locationLabel = listing.pickup_location ?? listing.vendor.location;

  return (
    <article className="flex gap-3 rounded-2xl border border-[var(--color-border)] bg-white p-3 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--color-primary)]/40 hover:shadow-md">
      <div
        className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl"
        style={{ backgroundColor: `color-mix(in srgb, ${FOOD_TYPE_COLORS[listing.food_type]} 15%, white)` }}
      >
        {listing.photo_url ? (
          <Image
            src={listing.photo_url}
            alt={listing.title}
            width={80}
            height={80}
            className="h-full w-full object-cover"
          />
        ) : (
          <Icon size={32} color={FOOD_TYPE_COLORS[listing.food_type]} strokeWidth={1.75} />
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-start justify-between gap-2">
          <FoodTypeBadge foodType={listing.food_type} />
          <span className="whitespace-nowrap text-sm font-bold text-[var(--color-foreground)]">
            {formatPrice(listing.price)}
          </span>
        </div>
        <h3 className="truncate font-semibold leading-tight">{listing.title}</h3>
        <p className="line-clamp-2 text-sm leading-snug text-[var(--color-foreground)]/60">
          {listing.vendor.name} · {listing.campus.name}
          {locationLabel ? ` · ${locationLabel}` : ""}
        </p>
        {timeLabel && (
          <p
            className={`text-xs font-medium ${
              isUrgent ? "animate-pulse text-[var(--color-destructive)]" : "text-[var(--color-foreground)]/70"
            }`}
          >
            {timeLabel}
          </p>
        )}
        {listing.dietary_tags && listing.dietary_tags.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-0.5">
            {listing.dietary_tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-[var(--color-border)] bg-[var(--color-muted)] px-2 py-0.5 text-[11px] font-medium text-[var(--color-foreground)]/70"
              >
                {DIETARY_TAG_LABELS[tag]}
              </span>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}
