import type { DietaryTag, FoodStorage, FoodType, ScheduleType, VoucherDiscountType, Weekday } from "@/lib/types";
import { DIETARY_TAGS, FOOD_STORAGES, WEEKDAYS } from "@/lib/types";

const FOOD_TYPES: FoodType[] = [
  "free_giveaway",
  "discounted",
  "daily_special",
  "recurring_event",
  "one_off_event",
  "discount_voucher",
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
  food_safety_enabled: boolean;
  food_storage: FoodStorage | null;
  food_eat_within_hours: number | null;
  food_reheat_instructions: string | null;
  food_allergens: string | null;
  food_donor_declared_at: string | null;
  limit_one_per_week: boolean;
  voucher_discount_type: VoucherDiscountType | null;
  voucher_discount_value: number | null;
  voucher_total: number | null;
  voucher_conditions: string | null;
  voucher_reserved_message: string | null;
  voucher_used_message: string | null;
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

function optionalText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

/**
 * Validates the food safety label fields. When enabled, the vendor must
 * choose a storage option and tick the donor declaration — under the
 * Wrongs Act 1958 (Vic) Part VIB a donor is expected to pass on handling
 * requirements and any time limit, so those are what the label carries.
 */
export function validateFoodSafety(
  b: Record<string, unknown>
):
  | { error: string }
  | {
      food_safety_enabled: boolean;
      food_storage: FoodStorage | null;
      food_eat_within_hours: number | null;
      food_reheat_instructions: string | null;
      food_allergens: string | null;
      food_donor_declared_at: string | null;
    } {
  if (b.food_safety_enabled !== true) {
    return {
      food_safety_enabled: false,
      food_storage: null,
      food_eat_within_hours: null,
      food_reheat_instructions: null,
      food_allergens: null,
      food_donor_declared_at: null,
    };
  }

  if (typeof b.food_storage !== "string" || !FOOD_STORAGES.includes(b.food_storage as FoodStorage)) {
    return { error: "Choose how students should store this food." };
  }

  let eatWithin: number | null = null;
  if (b.food_eat_within_hours !== null && b.food_eat_within_hours !== undefined && b.food_eat_within_hours !== "") {
    eatWithin = Number(b.food_eat_within_hours);
    if (!Number.isInteger(eatWithin) || eatWithin < 1 || eatWithin > 168) {
      return { error: "\"Eat within\" must be a whole number of hours between 1 and 168." };
    }
  }

  if (b.food_donor_declaration !== true) {
    return { error: "Please tick the donor declaration to add a food safety label." };
  }

  return {
    food_safety_enabled: true,
    food_storage: b.food_storage as FoodStorage,
    food_eat_within_hours: eatWithin,
    food_reheat_instructions: optionalText(b.food_reheat_instructions, 500),
    food_allergens: optionalText(b.food_allergens, 200),
    food_donor_declared_at: new Date().toISOString(),
  };
}

const NO_VOUCHER = {
  voucher_discount_type: null,
  voucher_discount_value: null,
  voucher_total: null,
  voucher_conditions: null,
  voucher_reserved_message: null,
  voucher_used_message: null,
} as const;

/**
 * Validates the discount voucher fields. Only used when the food type is
 * "discount_voucher": a dollar or percentage discount, and how many
 * numbered vouchers are available in total for the listing.
 */
export function validateVoucher(
  b: Record<string, unknown>
):
  | { error: string }
  | {
      voucher_discount_type: VoucherDiscountType | null;
      voucher_discount_value: number | null;
      voucher_total: number | null;
      voucher_conditions: string | null;
      voucher_reserved_message: string | null;
      voucher_used_message: string | null;
    } {
  if (b.food_type !== "discount_voucher") return { ...NO_VOUCHER };

  if (b.voucher_discount_type !== "amount" && b.voucher_discount_type !== "percent") {
    return { error: "Choose whether the voucher is a dollar amount or a percentage." };
  }
  const value = Number(b.voucher_discount_value);
  if (!Number.isFinite(value) || value <= 0) {
    return { error: "Enter how much the voucher takes off." };
  }
  if (b.voucher_discount_type === "percent" && value > 100) {
    return { error: "A percentage discount can't be more than 100%." };
  }
  const total = Number(b.voucher_total);
  if (!Number.isInteger(total) || total < 1 || total > 100000) {
    return { error: "Enter how many vouchers are available, as a whole number of at least 1." };
  }

  return {
    voucher_discount_type: b.voucher_discount_type,
    voucher_discount_value: Math.round(value * 100) / 100,
    voucher_total: total,
    voucher_conditions: optionalText(b.voucher_conditions, 200),
    voucher_reserved_message: optionalText(b.voucher_reserved_message, 300),
    voucher_used_message: optionalText(b.voucher_used_message, 300),
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

  const foodSafety = validateFoodSafety(b);
  if ("error" in foodSafety) return foodSafety;

  const voucher = validateVoucher(b);
  if ("error" in voucher) return voucher;

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
      ...foodSafety,
      ...voucher,
      // A voucher's value is its discount, not a price.
      ...(b.food_type === "discount_voucher" ? { price: null } : {}),
      limit_one_per_week: b.limit_one_per_week === true,
    },
  };
}
