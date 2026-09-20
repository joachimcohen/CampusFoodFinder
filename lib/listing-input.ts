import type { DietaryTag, FoodType, ScheduleType, Weekday } from "@/lib/types";
import { DIETARY_TAGS, WEEKDAYS } from "@/lib/types";

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
  pickup_location: string | null;
  price: number | null;
  photo_url: string | null;
  starts_at: string | null;
  expires_at: string | null;
  recurrence_days: Weekday[] | null;
  recurrence_time_start: string | null;
  recurrence_time_end: string | null;
  recurrence_valid_until: string | null;
  dietary_tags: DietaryTag[] | null;
  queue_enabled: boolean;
  queue_batch_size: number;
  queue_no_show_minutes: number;
  queue_capacity_cap: number | null;
  queue_waiting_message: string | null;
  queue_served_message: string | null;
  queue_waiting_message_url: string | null;
  queue_served_message_url: string | null;
}

/** A bare `http(s)://` prefix check — enough to stop obviously-broken input (javascript:, plain text) without a full URL-parsing dependency. */
function validateOptionalUrl(value: unknown, label: string): { error: string } | { url: string | null } {
  if (typeof value !== "string" || !value.trim()) return { url: null };
  const trimmed = value.trim();
  if (!/^https?:\/\//i.test(trimmed)) {
    return { error: `${label} must be a full web address starting with http:// or https://.` };
  }
  return { url: trimmed };
}

/** Validates the optional virtual-queue config fields. Returns an error string, or the parsed fields. */
export function validateQueueConfig(
  b: Record<string, unknown>
):
  | { error: string }
  | {
      queue_enabled: boolean;
      queue_batch_size: number;
      queue_no_show_minutes: number;
      queue_capacity_cap: number | null;
      queue_waiting_message: string | null;
      queue_served_message: string | null;
      queue_waiting_message_url: string | null;
      queue_served_message_url: string | null;
    } {
  const queue_enabled = b.queue_enabled === true;

  if (!queue_enabled) {
    return {
      queue_enabled: false,
      queue_batch_size: 10,
      queue_no_show_minutes: 5,
      queue_capacity_cap: null,
      queue_waiting_message: null,
      queue_served_message: null,
      queue_waiting_message_url: null,
      queue_served_message_url: null,
    };
  }

  const batchSize = Number(b.queue_batch_size);
  if (!Number.isInteger(batchSize) || batchSize < 1) {
    return { error: "Queue batch size must be a whole number of at least 1." };
  }

  const noShowMinutes = Number(b.queue_no_show_minutes);
  if (!Number.isInteger(noShowMinutes) || noShowMinutes < 1) {
    return { error: "Queue no-show window must be a whole number of minutes, at least 1." };
  }

  let capacityCap: number | null = null;
  if (b.queue_capacity_cap !== null && b.queue_capacity_cap !== undefined && b.queue_capacity_cap !== "") {
    capacityCap = Number(b.queue_capacity_cap);
    if (!Number.isInteger(capacityCap) || capacityCap < 1) {
      return { error: "Queue capacity must be a whole number of at least 1, or left blank for no cap." };
    }
  }

  const queue_waiting_message =
    typeof b.queue_waiting_message === "string" && b.queue_waiting_message.trim()
      ? b.queue_waiting_message.trim()
      : null;
  const queue_served_message =
    typeof b.queue_served_message === "string" && b.queue_served_message.trim()
      ? b.queue_served_message.trim()
      : null;

  const waitingUrlResult = validateOptionalUrl(b.queue_waiting_message_url, "Waiting message link");
  if ("error" in waitingUrlResult) return waitingUrlResult;

  const servedUrlResult = validateOptionalUrl(b.queue_served_message_url, "Served message link");
  if ("error" in servedUrlResult) return servedUrlResult;

  return {
    queue_enabled: true,
    queue_batch_size: batchSize,
    queue_no_show_minutes: noShowMinutes,
    queue_capacity_cap: capacityCap,
    queue_waiting_message,
    queue_served_message,
    queue_waiting_message_url: waitingUrlResult.url,
    queue_served_message_url: servedUrlResult.url,
  };
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
  const rawPrice = b.price === null || b.price === undefined || b.price === "" ? null : Number(b.price);
  if (rawPrice !== null && (Number.isNaN(rawPrice) || rawPrice < 0)) {
    return { error: "Price must be a positive number." };
  }
  // Round to the nearest cent so floating-point noise (e.g. 4.999999999999998)
  // never causes the stored price to drift from what was entered.
  const price = rawPrice === null ? null : Math.round(rawPrice * 100) / 100;

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

  let dietary_tags: DietaryTag[] | null = null;
  if (b.dietary_tags !== undefined && b.dietary_tags !== null) {
    if (!Array.isArray(b.dietary_tags) || !b.dietary_tags.every((t) => DIETARY_TAGS.includes(t as DietaryTag))) {
      return { error: "Invalid dietary tag selected." };
    }
    dietary_tags = b.dietary_tags.length > 0 ? (b.dietary_tags as DietaryTag[]) : null;
  }

  const queueConfig = validateQueueConfig(b);
  if ("error" in queueConfig) return queueConfig;

  return {
    input: {
      food_type: b.food_type as FoodType,
      schedule_type: scheduleType,
      title: b.title.trim(),
      description: typeof b.description === "string" && b.description.trim() ? b.description.trim() : null,
      pickup_location:
        typeof b.pickup_location === "string" && b.pickup_location.trim() ? b.pickup_location.trim() : null,
      price,
      photo_url: typeof b.photo_url === "string" && b.photo_url ? b.photo_url : null,
      starts_at,
      expires_at,
      recurrence_days,
      recurrence_time_start,
      recurrence_time_end,
      recurrence_valid_until,
      dietary_tags,
      ...queueConfig,
    },
  };
}
