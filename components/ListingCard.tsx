"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Gift, Percent, Star, Repeat, PartyPopper, Navigation, ChevronDown, ChevronUp, ShieldCheck } from "lucide-react";
import type { ListingWithRelations } from "@/lib/types";
import { DIETARY_TAG_LABELS, FOOD_TYPE_COLORS } from "@/lib/types";
import FoodTypeBadge from "./FoodTypeBadge";
import QueueTicketPanel from "./QueueTicketPanel";
import FoodSafetyDialog, { type DialogMode } from "./FoodSafetyDialog";
import {
  formatPrice,
  getRecurrenceScheduleLabel,
  getStartsLabel,
  getTimeRemainingLabel,
  melbourneWeekStart,
} from "@/lib/listings";
import { loadPass, type SavedPass } from "@/lib/collect-client";

const PASS_REUSE_MS = 12 * 3_600_000;

/** A limited listing's pass counts for the whole week; others for 12 hours, so students can reopen it while eating. */
function isPassCurrent(pass: SavedPass | null, limitedWeekly: boolean, now: Date): boolean {
  if (!pass) return false;
  if (limitedWeekly) return pass.weekStart === melbourneWeekStart(now);
  return now.getTime() - new Date(pass.acknowledgedAt).getTime() < PASS_REUSE_MS;
}

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
  mode: "happening-now" | "coming-up" | "weekly" | "sold-out";
}) {
  const [expanded, setExpanded] = useState(false);
  const [dialog, setDialog] = useState<DialogMode | null>(null);
  const [pass, setPass] = useState<SavedPass | null>(null);
  const [passIsCurrent, setPassIsCurrent] = useState(false);

  useEffect(() => {
    const saved = loadPass(listing.id);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time localStorage read on mount
    setPass(saved);
    setPassIsCurrent(isPassCurrent(saved, listing.limit_one_per_week, new Date()));
  }, [listing.id, listing.limit_one_per_week]);

  function onCollected(newPass: SavedPass) {
    setPass(newPass);
    setPassIsCurrent(true);
  }

  const soldOut = mode === "sold-out";
  // Walk-up listings (no queue) that need the label, an ID check or a
  // weekly limit get a "Collect" button that produces a show-this-screen pass.
  const walkUpGate =
    !listing.queue_enabled &&
    (listing.food_safety_enabled || listing.limit_one_per_week || listing.require_student_number);
  const collectedThisWeek = listing.limit_one_per_week && passIsCurrent;
  const Icon = FOOD_TYPE_ICONS[listing.food_type];
  const timeLabel = soldOut
    ? ""
    : mode === "happening-now"
      ? getTimeRemainingLabel(listing)
      : mode === "coming-up"
        ? getStartsLabel(listing)
        : getRecurrenceScheduleLabel(listing);
  const isUrgent = mode === "happening-now" && timeLabel.includes("min") && !timeLabel.includes("Today");
  // A listing's own pickup location (for vendors without a fixed spot) takes
  // priority over the vendor's general location when set.
  const locationLabel = listing.pickup_location ?? listing.vendor.location;
  // Vendor name + location + campus gives Google Maps enough text to find
  // the right spot even without a street address on file.
  const directionsUrl = locationLabel
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
        `${listing.vendor.name}, ${locationLabel}, ${listing.campus.name} Campus`
      )}`
    : null;

  const locationLine = `${listing.vendor.name} · ${listing.campus.name}${locationLabel ? ` · ${locationLabel}` : ""}`;

  const descRef = useRef<HTMLParagraphElement>(null);
  const locationRef = useRef<HTMLParagraphElement>(null);
  const [hasMoreToShow, setHasMoreToShow] = useState(false);

  useEffect(() => {
    // Only measurable while still clamped — an expanded paragraph never
    // reports overflow, so skip re-measuring (and keep the last known
    // answer) until it's collapsed again. Re-checks on resize since the
    // feed's grid changes column width at each breakpoint, which changes
    // whether either line actually overflows two lines.
    if (expanded) return;
    const overflowing = (el: HTMLElement | null) => !!el && el.scrollHeight > el.clientHeight + 1;
    const measure = () => setHasMoreToShow(overflowing(descRef.current) || overflowing(locationRef.current));
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [expanded, listing.description, locationLine]);

  return (
    <article
      className={`flex gap-3 rounded-2xl border border-[var(--color-border)] p-3 shadow-sm transition-all duration-200 ${
        soldOut
          ? "bg-[var(--color-muted)]/60"
          : "bg-white hover:-translate-y-0.5 hover:border-[var(--color-primary)]/40 hover:shadow-md"
      }`}
    >
      <div
        className={`flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl ${soldOut ? "opacity-50 grayscale" : ""}`}
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
          {soldOut ? (
            <span className="whitespace-nowrap rounded-full bg-[var(--color-foreground)] px-2 py-0.5 text-xs font-bold text-white">
              Sold out
            </span>
          ) : (
            <span className="whitespace-nowrap text-sm font-bold text-[var(--color-foreground)]">
              {formatPrice(listing.price)}
            </span>
          )}
        </div>
        <h3 className="truncate font-semibold leading-tight">{listing.title}</h3>
        {listing.description && (
          <p
            ref={descRef}
            className={`text-sm leading-snug text-[var(--color-foreground)]/80 ${expanded ? "" : "line-clamp-2"}`}
          >
            {listing.description}
          </p>
        )}
        <p
          ref={locationRef}
          className={`text-sm leading-snug text-[var(--color-foreground)]/70 ${expanded ? "" : "line-clamp-2"}`}
        >
          {locationLine}
        </p>
        {hasMoreToShow && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            className="inline-flex w-fit items-center gap-0.5 text-xs font-semibold text-[var(--color-foreground)]/70"
          >
            {expanded ? "Show less" : "Show more"}
            {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        )}
        {directionsUrl && (
          <a
            href={directionsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-fit items-center gap-1 text-xs font-semibold underline"
            style={{ color: "var(--color-accent)" }}
          >
            <Navigation size={12} strokeWidth={2.25} />
            Directions
          </a>
        )}
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
        {listing.food_safety_enabled && (
          <button
            type="button"
            onClick={() => setDialog("view")}
            className="inline-flex min-h-8 w-fit items-center gap-1 text-xs font-semibold underline"
          >
            <ShieldCheck size={13} aria-hidden="true" />
            Food safety &amp; reheating
          </button>
        )}
        {listing.queue_enabled && !soldOut && <QueueTicketPanel listing={listing} compact />}
        {walkUpGate && (!soldOut || passIsCurrent) && (
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {passIsCurrent && (
              <button
                type="button"
                onClick={() => setDialog("pass")}
                className="inline-flex min-h-8 w-fit items-center rounded-full bg-[var(--color-accent)] px-3 text-xs font-semibold text-white"
              >
                Show my pass
              </button>
            )}
            {soldOut ? null : collectedThisWeek ? (
              <span className="text-xs text-[var(--color-foreground)]/70">Collected this week · resets Monday</span>
            ) : (
              <button
                type="button"
                onClick={() => setDialog("collect")}
                className="inline-flex min-h-8 w-fit items-center rounded-full bg-[var(--color-primary)] px-3 text-xs font-semibold text-[var(--color-on-primary)]"
              >
                {passIsCurrent ? "Collect again" : "Collect this food"}
              </button>
            )}
          </div>
        )}
        {soldOut && (
          <p className="text-xs text-[var(--color-foreground)]/70">All gone for now. Thanks for checking!</p>
        )}
      </div>
      {dialog && (
        <FoodSafetyDialog
          listing={listing}
          mode={dialog}
          initialPass={pass}
          onClose={() => setDialog(null)}
          onCollected={onCollected}
        />
      )}
    </article>
  );
}
