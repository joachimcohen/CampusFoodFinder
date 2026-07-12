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
  price: number | null;
  photo_url: string | null;
  starts_at: string | null;
  expires_at: string | null;
  recurrence_days: Weekday[] | null;
  recurrence_time_start: string | null;
  recurrence_time_end: string | null;
  recurrence_valid_until: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ListingWithRelations extends Listing {
  vendor: Pick<Vendor, "id" | "name" | "slug">;
  campus: Pick<Campus, "id" | "name" | "slug">;
}

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
// design-system/MASTER.md commits to. free_giveaway/discounted at their base
// hue measure ~3.3:1 / ~2.8:1 (fail); these darker variants measure ~5:1+.
// The base FOOD_TYPE_COLORS stay unchanged for icons/tints, which aren't
// held to text-contrast rules.
export const FOOD_TYPE_BADGE_COLORS: Record<FoodType, string> = {
  free_giveaway: "var(--color-food-free-badge)",
  discounted: "var(--color-food-discounted-badge)",
  daily_special: "var(--color-food-special)",
  recurring_event: "var(--color-food-recurring)",
  one_off_event: "var(--color-food-oneoff)",
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
