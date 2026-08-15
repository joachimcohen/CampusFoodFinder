import type { Weekday } from "./types";
import { instanceConfig } from "./config";

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
  timeZone: instanceConfig.timezone,
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
 * Uses Intl's IANA tz database so daylight-saving transitions are handled
 * automatically. Deterministic regardless of the executing runtime's own
 * timezone (Vercel's server render defaults to UTC). This assumes every
 * suburb served by one instance shares a single timezone — true for any
 * single Victorian council; a fork covering multiple timezones would need
 * to make this per-suburb instead of instance-wide.
 */
export function getLocalParts(date: Date): {
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
