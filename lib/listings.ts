import type { ListingWithRelations, Weekday } from "./types";
import { WEEKDAYS } from "./types";
import { getMelbourneParts } from "./melbourne-time";

function weekdayIndex(day: Weekday): number {
  return WEEKDAYS.indexOf(day);
}

function timeStringToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/** Recurring listings still "in scope" — not past their optional end date. */
export function isRecurringInScope(
  listing: ListingWithRelations,
  now: Date = new Date()
): boolean {
  if (listing.schedule_type !== "recurring") return false;
  if (!listing.is_active) return false;
  if (!listing.recurrence_valid_until) return true;
  const today = getMelbourneParts(now).dateStr;
  return listing.recurrence_valid_until >= today;
}

/** Is this listing visible in the "Happening Now" section right now? */
export function isHappeningNow(
  listing: ListingWithRelations,
  now: Date = new Date()
): boolean {
  if (!listing.is_active) return false;

  if (listing.schedule_type === "one_time") {
    if (!listing.starts_at || !listing.expires_at) return false;
    const start = new Date(listing.starts_at).getTime();
    const end = new Date(listing.expires_at).getTime();
    return now.getTime() >= start && now.getTime() <= end;
  }

  if (!isRecurringInScope(listing, now)) return false;
  if (!listing.recurrence_days || !listing.recurrence_time_start || !listing.recurrence_time_end) {
    return false;
  }

  const { weekday: today, minutesSinceMidnight: nowMinutes } = getMelbourneParts(now);
  if (!listing.recurrence_days.includes(today)) return false;

  const startMinutes = timeStringToMinutes(listing.recurrence_time_start);
  const endMinutes = timeStringToMinutes(listing.recurrence_time_end);
  return nowMinutes >= startMinutes && nowMinutes <= endMinutes;
}

/** Minutes until a one-time listing expires, or a recurring listing's current window ends. */
function minutesRemaining(listing: ListingWithRelations, now: Date): number | null {
  if (listing.schedule_type === "one_time") {
    if (!listing.expires_at) return null;
    return Math.round((new Date(listing.expires_at).getTime() - now.getTime()) / 60000);
  }
  if (!listing.recurrence_time_end) return null;
  const endMinutes = timeStringToMinutes(listing.recurrence_time_end);
  return endMinutes - getMelbourneParts(now).minutesSinceMidnight;
}

/** Minutes until a recurring listing's *next* occurrence begins (0 if active now). */
function minutesUntilNextOccurrence(listing: ListingWithRelations, now: Date): number {
  if (
    !listing.recurrence_days ||
    listing.recurrence_days.length === 0 ||
    !listing.recurrence_time_start
  ) {
    return Infinity;
  }
  if (isHappeningNow(listing, now)) return 0;

  const { weekday: today, minutesSinceMidnight: nowMinutes } = getMelbourneParts(now);
  const nowDayIdx = weekdayIndex(today);
  const startMinutes = timeStringToMinutes(listing.recurrence_time_start);

  let best = Infinity;
  for (const day of listing.recurrence_days) {
    const dayIdx = weekdayIndex(day);
    let daysAhead = (dayIdx - nowDayIdx + 7) % 7;
    if (daysAhead === 0 && nowMinutes >= startMinutes) daysAhead = 7;
    const candidate = daysAhead * 1440 + startMinutes - nowMinutes;
    if (candidate < best) best = candidate;
  }
  return best;
}

/** Sort key for the "Happening Now" section — soonest-expiring first. */
export function happeningNowSortKey(listing: ListingWithRelations, now: Date): number {
  return minutesRemaining(listing, now) ?? Infinity;
}

/** Sort key for the "Weekly & Recurring" section — soonest-upcoming first. */
export function weeklyRecurringSortKey(listing: ListingWithRelations, now: Date): number {
  return minutesUntilNextOccurrence(listing, now);
}

function formatClockTime(hours: number, minutes: number): string {
  const period = hours >= 12 ? "pm" : "am";
  const h12 = hours % 12 === 0 ? 12 : hours % 12;
  return minutes === 0 ? `${h12}${period}` : `${h12}:${String(minutes).padStart(2, "0")}${period}`;
}

function formatTimeString(time: string): string {
  const [h, m] = time.split(":").map(Number);
  return formatClockTime(h, m);
}

/** "Ends in 40 min" / "Ends in 2h 15m" / "Today until 6pm" style label. */
export function getTimeRemainingLabel(listing: ListingWithRelations, now: Date = new Date()): string {
  const remaining = minutesRemaining(listing, now);
  if (remaining === null) return "";
  if (remaining <= 0) return "Ending now";

  if (remaining <= 60) {
    return `Ends in ${remaining} min`;
  }

  if (listing.schedule_type === "one_time" && listing.expires_at) {
    const end = new Date(listing.expires_at);
    return `Today until ${formatClockTime(end.getHours(), end.getMinutes())}`;
  }

  if (listing.recurrence_time_end) {
    return `Today until ${formatTimeString(listing.recurrence_time_end)}`;
  }

  const hours = Math.floor(remaining / 60);
  const mins = remaining % 60;
  return mins > 0 ? `Ends in ${hours}h ${mins}m` : `Ends in ${hours}h`;
}

const WEEKDAY_LABELS: Record<Weekday, string> = {
  monday: "Mon",
  tuesday: "Tue",
  wednesday: "Wed",
  thursday: "Thu",
  friday: "Fri",
  saturday: "Sat",
  sunday: "Sun",
};

/** "Wed 7:30–9:30am" style label for the Weekly & Recurring card. */
export function getRecurrenceScheduleLabel(listing: ListingWithRelations): string {
  if (!listing.recurrence_days || !listing.recurrence_time_start || !listing.recurrence_time_end) {
    return "";
  }
  const days = listing.recurrence_days.map((d) => WEEKDAY_LABELS[d]).join(", ");
  const start = formatTimeString(listing.recurrence_time_start);
  const end = formatTimeString(listing.recurrence_time_end);
  return `${days} · ${start}–${end}`;
}

export function formatPrice(price: number | null): string {
  if (price === null || price === undefined) return "FREE";
  return `$${price.toFixed(2)}`;
}
