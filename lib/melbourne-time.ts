import type { Weekday } from "./types";

const WEEKDAY_FROM_SHORT: Record<string, Weekday> = {
  Mon: "monday",
  Tue: "tuesday",
  Wed: "wednesday",
  Thu: "thursday",
  Fri: "friday",
  Sat: "saturday",
  Sun: "sunday",
};

const formatter = new Intl.DateTimeFormat("en-AU", {
  timeZone: "Australia/Melbourne",
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  hourCycle: "h23", // avoids the h24 quirk ("24:00" instead of "00:00" at midnight)
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/**
 * All four seeded campuses are in Victoria, so a single hardcoded timezone is
 * correct here. Uses Intl's IANA tz database (bundled with Node/browsers) so
 * AEST/AEDT daylight-saving transitions are handled automatically — no
 * hardcoded UTC offset to go stale. Deterministic regardless of the
 * executing runtime's own timezone (fixes a bug where Vercel's server
 * render, which defaults to UTC, disagreed with a Melbourne browser).
 */
export function getMelbourneParts(date: Date): {
  weekday: Weekday;
  minutesSinceMidnight: number;
  dateStr: string;
} {
  const parts = formatter.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";

  const weekday = WEEKDAY_FROM_SHORT[get("weekday")];
  const hour = Number(get("hour"));
  const minute = Number(get("minute"));
  const year = get("year");
  const month = get("month");
  const day = get("day");

  return {
    weekday,
    minutesSinceMidnight: hour * 60 + minute,
    dateStr: `${year}-${month}-${day}`,
  };
}
