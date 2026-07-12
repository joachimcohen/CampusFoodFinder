import type { FoodType, ScheduleType, Weekday } from "@/lib/types";
import { WEEKDAYS } from "@/lib/types";

const FOOD_TYPES: FoodType[] = [
  "free_giveaway",
  "discounted",
  "daily_special",
  "recurring_event",
  "one_off_event",
];
const SCHEDULE_TYPES: ScheduleType[] = ["one_time", "recurring"];

export interface ListingInput {
  food_type: FoodType;
  schedule_type: ScheduleType;
  title: string;
  description: string | null;
  price: number | null;
  photo_url: string | null;
  starts_at: string | null;
  expires_at: string | null;
  recurrence_days: Weekday[] | null;
  recurrence_time_start: string | null;
  recurrence_time_end: string | null;
  recurrence_valid_until: string | null;
}

/** Validates a raw listing payload from the client. Returns an error string, or null if valid. */
export function validateListingInput(body: unknown): { input: ListingInput } | { error: string } {
  if (typeof body !== "object" || body === null) return { error: "Invalid request body." };
  const b = body as Record<string, unknown>;

  if (typeof b.title !== "string" || b.title.trim().length === 0) {
    return { error: "Title is required." };
  }
  if (typeof b.food_type !== "string" || !FOOD_TYPES.includes(b.food_type as FoodType)) {
    return { error: "Invalid food type." };
  }
  if (typeof b.schedule_type !== "string" || !SCHEDULE_TYPES.includes(b.schedule_type as ScheduleType)) {
    return { error: "Invalid schedule type." };
  }

  const scheduleType = b.schedule_type as ScheduleType;
  const price = b.price === null || b.price === undefined || b.price === "" ? null : Number(b.price);
  if (price !== null && (Number.isNaN(price) || price < 0)) {
    return { error: "Price must be a positive number." };
  }

  let starts_at: string | null = null;
  let expires_at: string | null = null;
  let recurrence_days: Weekday[] | null = null;
  let recurrence_time_start: string | null = null;
  let recurrence_time_end: string | null = null;
  let recurrence_valid_until: string | null = null;

  if (scheduleType === "one_time") {
    if (typeof b.starts_at !== "string" || typeof b.expires_at !== "string") {
      return { error: "Start and end time are required for a one-time listing." };
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
      return { error: "Select at least one valid day for a recurring listing." };
    }
    if (typeof b.recurrence_time_start !== "string" || typeof b.recurrence_time_end !== "string") {
      return { error: "Start and end time are required for a recurring listing." };
    }
    recurrence_days = b.recurrence_days as Weekday[];
    recurrence_time_start = b.recurrence_time_start;
    recurrence_time_end = b.recurrence_time_end;
    recurrence_valid_until = typeof b.recurrence_valid_until === "string" ? b.recurrence_valid_until : null;
  }

  return {
    input: {
      food_type: b.food_type as FoodType,
      schedule_type: scheduleType,
      title: b.title.trim(),
      description: typeof b.description === "string" && b.description.trim() ? b.description.trim() : null,
      price,
      photo_url: typeof b.photo_url === "string" && b.photo_url ? b.photo_url : null,
      starts_at,
      expires_at,
      recurrence_days,
      recurrence_time_start,
      recurrence_time_end,
      recurrence_valid_until,
    },
  };
}
