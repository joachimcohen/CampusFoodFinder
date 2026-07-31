export type FoodType =
  | "free_giveaway"
  | "discounted"
  | "daily_special"
  | "recurring_event"
  | "one_off_event";

export type ScheduleType = "one_time" | "recurring";

export type Weekday =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

export type DietaryTag =
  | "vegetarian"
  | "vegan"
  | "gluten_free"
  | "dairy_free"
  | "halal"
  | "kosher";

export interface Campus {
  id: string;
  name: string;
  slug: string;
  created_at: string;
}

export interface Vendor {
  id: string;
  campus_id: string;
  name: string;
  slug: string;
  location: string | null;
  pin_hash: string;
  failed_attempts: number;
  locked_until: string | null;
  contact_note: string | null;
  is_active: boolean;
  created_at: string;
}

export type PublicVendor = Omit<Vendor, "pin_hash">;

export interface Listing {
  id: string;
  vendor_id: string;
  campus_id: string;
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
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ListingWithRelations extends Listing {
  vendor: Pick<Vendor, "id" | "name" | "slug" | "location">;
  campus: Pick<Campus, "id" | "name" | "slug">;
}

export const DIETARY_TAG_LABELS: Record<DietaryTag, string> = {
  vegetarian: "Vegetarian",
  vegan: "Vegan",
  gluten_free: "Gluten Free",
  dairy_free: "Dairy Free",
  halal: "Halal",
  kosher: "Kosher",
};

export const DIETARY_TAGS: DietaryTag[] = [
  "vegetarian",
  "vegan",
  "gluten_free",
  "dairy_free",
  "halal",
  "kosher",
];

export const FOOD_TYPE_LABELS: Record<FoodType, string> = {
  free_giveaway: "Free Giveaway",
  discounted: "Discounted",
  daily_special: "Daily Special",
  recurring_event: "Recurring Event",
  one_off_event: "One-off Event",
};

export const FOOD_TYPE_COLORS: Record<FoodType, string> = {
  free_giveaway: "var(--color-food-free)",
  discounted: "var(--color-food-discounted)",
  daily_special: "var(--color-food-special)",
  recurring_event: "var(--color-food-recurring)",
  one_off_event: "var(--color-food-oneoff)",
};

// Badge backgrounds need white text at ~12px to hit the 4.5:1 contrast ratio
// design-system/MASTER.md commits to. The base FOOD_TYPE_COLORS (a light
// teal-to-purple gradient used for icons/tints) don't clear that on their
// own, so every food type has a darkened badge-safe variant, all computed
// and verified at >=4.5:1 — see design-system/MASTER.md for the numbers.
export const FOOD_TYPE_BADGE_COLORS: Record<FoodType, string> = {
  free_giveaway: "var(--color-food-free-badge)",
  discounted: "var(--color-food-discounted-badge)",
  daily_special: "var(--color-food-special-badge)",
  recurring_event: "var(--color-food-recurring-badge)",
  one_off_event: "var(--color-food-oneoff-badge)",
};

export const WEEKDAYS: Weekday[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

// =========================================================
// Virtual Queue
// =========================================================

export type QueueSessionStatus = "open" | "closed";
export type QueueEntryStatus = "waiting" | "called" | "expired" | "served";

export interface QueueSession {
  id: string;
  listing_id: string;
  date: string;
  status: QueueSessionStatus;
  batch_size: number;
  no_show_window_minutes: number;
  capacity_cap: number | null;
  created_at: string;
}

/**
 * The shape returned to a student for their own ticket, or to staff for
 * everyone in the session. `anonymous_token` is deliberately never included
 * — the student already holds it locally, and staff never need to see it.
 */
export interface QueueEntry {
  id: string;
  session_id: string;
  status: QueueEntryStatus;
  joined_at: string;
  called_at: string | null;
  /** "Nth to join today" — stable for the life of the ticket, shown to both the student and staff so they can be matched up. */
  ticket_number: number;
  /** Rank among only those still waiting — omitted once called/served/expired, since it no longer applies. */
  position?: number;
}

export interface QueueTicketStatus {
  status: QueueEntryStatus;
  ticketNumber: number;
  position: number | null;
  waitMinutesLabel: string | null;
}

export interface QueueStaffSnapshot {
  session: QueueSession;
  waiting: QueueEntry[];
  called: QueueEntry[];
  servedCount: number;
  waitingCount: number;
}

// =========================================================
// Admin Alerts
// =========================================================

export type AlertSeverity = "recall" | "advisory" | "general";

export interface AdminAlert {
  id: string;
  message: string;
  severity: AlertSeverity;
  created_by: string;
  created_at: string;
  active: boolean;
}

export const ALERT_SEVERITY_LABELS: Record<AlertSeverity, string> = {
  recall: "Recall",
  advisory: "Advisory",
  general: "General notice",
};
