"use client";

import Image from "next/image";
import { Gift, Navigation } from "lucide-react";
import type { ListingWithRelations } from "@/lib/types";
import ListingTypeBadge from "./ListingTypeBadge";
import TransitInfo from "./TransitInfo";
import {
  formatPrice,
  getRecurrenceScheduleLabel,
  getStartsLabel,
  getTimeRemainingLabel,
} from "@/lib/listings";
import { appleMapsDirectionsUrl, googleMapsDirectionsUrl } from "@/lib/directions";

export default function ListingCard({
  listing,
  mode,
}: {
  listing: ListingWithRelations;
  mode: "happening-now" | "coming-up" | "every-week";
}) {
  const timeLabel =
    mode === "happening-now"
      ? getTimeRemainingLabel(listing)
      : mode === "coming-up"
        ? getStartsLabel(listing)
        : getRecurrenceScheduleLabel(listing);
  const isUrgent = mode === "happening-now" && timeLabel.includes("min") && !timeLabel.includes("Today");
  const locationLabel = listing.pickup_location ?? listing.organisation.location;
  const hasCoords = listing.lat !== null && listing.lng !== null;

  return (
    <article className="flex gap-3 rounded-2xl border border-[var(--color-border)] bg-white p-3 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--color-primary)]/40 hover:shadow-md">
      <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[var(--color-muted)]">
        {listing.photo_url ? (
          <Image
            src={listing.photo_url}
            alt={listing.title}
            width={80}
            height={80}
            className="h-full w-full object-cover"
          />
        ) : (
          <Gift size={32} color="var(--color-foreground)" strokeWidth={1.5} className="opacity-40" />
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-start justify-between gap-2">
          <ListingTypeBadge listingType={listing.listing_type} />
          <span className="whitespace-nowrap text-sm font-bold text-[var(--color-foreground)]">
            {formatPrice(listing.price)}
          </span>
        </div>
        <h3 className="truncate font-bold leading-tight">{listing.title}</h3>
        <p className="line-clamp-2 text-sm leading-snug text-[var(--color-foreground)]/60">
          {listing.organisation.name} · {listing.suburb.name}
          {locationLabel ? ` · ${locationLabel}` : ""}
        </p>
        {timeLabel && (
          <p
            className={`text-xs font-semibold ${
              isUrgent ? "animate-pulse text-[var(--color-destructive)]" : "text-[var(--color-foreground)]/70"
            }`}
          >
            {timeLabel}
          </p>
        )}
        <TransitInfo stopName={listing.transit_stop_name} walkMinutes={listing.transit_stop_walk_min} />

        <div className="mt-1 flex flex-wrap gap-3">
          {hasCoords && (
            <a
              href={googleMapsDirectionsUrl(listing.lat!, listing.lng!, listing.title)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-primary)] hover:underline"
            >
              <Navigation size={12} aria-hidden /> Directions
            </a>
          )}
          {hasCoords && (
            <a
              href={appleMapsDirectionsUrl(listing.lat!, listing.lng!)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-semibold text-[var(--color-foreground)]/60 hover:underline"
            >
              Apple Maps
            </a>
          )}
          {listing.queue_enabled && listing.queue_status === "open" && (
            <a
              href={`/queue/${listing.id}`}
              className="inline-flex items-center rounded-full bg-[var(--color-primary)] px-2.5 py-0.5 text-xs font-bold text-white hover:bg-[var(--color-primary-hover)]"
            >
              Secure your place
            </a>
          )}
        </div>
      </div>
    </article>
  );
}
