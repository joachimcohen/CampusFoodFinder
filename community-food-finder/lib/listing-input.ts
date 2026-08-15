import type { ListingType, Weekday } from "@/lib/types";
import { WEEKDAYS } from "@/lib/types";

const LISTING_TYPES: ListingType[] = ["every_week", "special_event"];

export interface ListingInput {
  listing_type: ListingType;
  title: string;
  description: string | null;
  pickup_location: string | null;
  price: number | null;
  photo_url: string | null;
  lat: number | null;
  lng: number | null;
  starts_at: string | null;
  expires_at: string | null;
  recurrence_days: Weekday[] | null;
  recurrence_time_start: string | null;
  recurrence_time_end: string | null;
  recurrence_valid_until: string | null;
  queue_enabled: boolean;
}

/** Validates a raw listing payload from the client. Returns an error string, or null if valid. */
export function validateListingInput(body: unknown): { input: ListingInput } | { error: string } {
  if (typeof body !== "object" || body === null) return { error: "Invalid request body." };
  const b = body as Record<string, unknown>;

  if (typeof b.title !== "string" || b.title.trim().length === 0) {
    return { error: "Title is required." };
  }
  if (typeof b.listing_type !== "string" || !LISTING_TYPES.includes(b.listing_type as ListingType)) {
    return { error: "Invalid listing type." };
  }

  const listingType = b.listing_type as ListingType;
  const rawPrice = b.price === null || b.price === undefined || b.price === "" ? null : Number(b.price);
  if (rawPrice !== null && (Number.isNaN(rawPrice) || rawPrice < 0)) {
    return { error: "Price must be a positive number." };
  }
  // Round to the nearest cent so floating-point noise never causes the
  // stored price to drift from what was entered.
  const price = rawPrice === null ? null : Math.round(rawPrice * 100) / 100;

  const rawLat = b.lat === null || b.lat === undefined || b.lat === "" ? null : Number(b.lat);
  const rawLng = b.lng === null || b.lng === undefined || b.lng === "" ? null : Number(b.lng);
  if ((rawLat !== null && Number.isNaN(rawLat)) || (rawLng !== null && Number.isNaN(rawLng))) {
    return { error: "Invalid map location." };
  }

  let starts_at: string | null = null;
  let expires_at: string | null = null;
  let recurrence_days: Weekday[] | null = null;
  let recurrence_time_start: string | null = null;
  let recurrence_time_end: string | null = null;
  let recurrence_valid_until: string | null = null;

  if (listingType === "special_event") {
    if (typeof b.starts_at !== "string" || typeof b.expires_at !== "string") {
      return { error: "Start and end time are required for a special event." };
    }
    starts_at = b.starts_at;
    expires_at = b.expires_at;
    if (new Date(expires_at).getTime() <= new Date(starts_at).getTime()) {
      return { error: "End time must be after start time." };
    }
  } else {
    if (
      !Array.isArray(b.recurrence_days) ||
      b.recurrence_days.length === 0 ||
      !b.recurrence_days.every((d) => WEEKDAYS.includes(d as Weekday))
    ) {
      return { error: "Select at least one valid day for an every-week listing." };
    }
    if (typeof b.recurrence_time_start !== "string" || typeof b.recurrence_time_end !== "string") {
      return { error: "Start and end time are required for an every-week listing." };
    }
    recurrence_days = b.recurrence_days as Weekday[];
    recurrence_time_start = b.recurrence_time_start;
    recurrence_time_end = b.recurrence_time_end;
    recurrence_valid_until = typeof b.recurrence_valid_until === "string" ? b.recurrence_valid_until : null;
  }

  return {
    input: {
      listing_type: listingType,
      title: b.title.trim(),
      description: typeof b.description === "string" && b.description.trim() ? b.description.trim() : null,
      pickup_location:
        typeof b.pickup_location === "string" && b.pickup_location.trim() ? b.pickup_location.trim() : null,
      price,
      photo_url: typeof b.photo_url === "string" && b.photo_url ? b.photo_url : null,
      lat: rawLat,
      lng: rawLng,
      starts_at,
      expires_at,
      recurrence_days,
      recurrence_time_start,
      recurrence_time_end,
      recurrence_valid_until,
      queue_enabled: b.queue_enabled === true,
    },
  };
}
