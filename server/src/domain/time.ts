import { err, ok, type Result } from "./result.js";

/** A calendar day with no clock and no timezone. */
export type CivilDate = {
  readonly year: number;
  readonly month: number;
  readonly day: number;
};

export type JerusalemDate = CivilDate & { readonly weekday: number };

/** One hour in milliseconds. Rental slices use this, not the host locale. */
export const HOUR_MS = 3_600_000;

const MIN_RENTAL_MS = 24 * HOUR_MS;
const MIN_LEAD_MS = 60 * 60 * 1000;

/** Parses `YYYY-MM-DD`. Anything that is not a real calendar day is null. */
export function parseCivilDate(value: string): CivilDate | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match === null) return null;
  const yearText = match[1];
  const monthText = match[2];
  const dayText = match[3];
  if (yearText === undefined || monthText === undefined || dayText === undefined) return null;
  const date = { year: Number(yearText), month: Number(monthText), day: Number(dayText) };
  if (!Number.isInteger(date.year) || date.month < 1 || date.month > 12) return null;
  const last = daysInMonth(date.year, date.month);
  if (date.day < 1 || date.day > last) return null;
  return date;
}

/** `YYYY-MM-DD` key used to match a holiday list. */
export function civilDateKey(date: CivilDate): string {
  const month = String(date.month).padStart(2, "0");
  const day = String(date.day).padStart(2, "0");
  return `${String(date.year)}-${month}-${day}`;
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function assertCivilDate(date: CivilDate): void {
  if (
    !Number.isInteger(date.year) ||
    !Number.isInteger(date.month) ||
    !Number.isInteger(date.day)
  ) {
    throw new Error("Civil date fields must be integers");
  }
  if (date.month < 1 || date.month > 12) throw new Error("Month must be 1-12");
  const last = daysInMonth(date.year, date.month);
  if (date.day < 1 || date.day > last) throw new Error("Day is outside the month");
}

/** Negative when left is earlier. Zero when the calendar days match. */
export function compareCivilDates(left: CivilDate, right: CivilDate): number {
  if (left.year !== right.year) return left.year - right.year;
  if (left.month !== right.month) return left.month - right.month;
  return left.day - right.day;
}

/** Adds calendar years. Feb 29 lands on Feb 28 when the target year has no 29th. */
export function addCalendarYears(date: CivilDate, years: number): CivilDate {
  assertCivilDate(date);
  if (!Number.isInteger(years)) throw new Error("Years must be an integer");
  const year = date.year + years;
  const day = Math.min(date.day, daysInMonth(year, date.month));
  return { year, month: date.month, day };
}

/** Completed years on a calendar day. The birthday itself already counts. */
export function ageOn(birthDate: CivilDate, onDate: CivilDate): number {
  assertCivilDate(birthDate);
  assertCivilDate(onDate);
  let age = onDate.year - birthDate.year;
  const anniversary: CivilDate = {
    year: onDate.year,
    month: birthDate.month,
    day: Math.min(birthDate.day, daysInMonth(onDate.year, birthDate.month)),
  };
  if (compareCivilDates(onDate, anniversary) < 0) age -= 1;
  return age;
}

/** Search age must equal the age on the pickup day, or payment is refused. */
export function ageMatchesSearch(
  searchAge: number,
  birthDate: CivilDate,
  pickupDate: CivilDate,
): boolean {
  if (!Number.isInteger(searchAge)) throw new Error("Search age must be an integer");
  return searchAge === ageOn(birthDate, pickupDate);
}

function jerusalemParts(instant: Date): Map<string, string> {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jerusalem",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const bag = new Map<string, string>();
  for (const part of parts) {
    if (part.type !== "literal") bag.set(part.type, part.value);
  }
  return bag;
}

function requirePart(bag: Map<string, string>, key: string): string {
  const value = bag.get(key);
  if (value === undefined) throw new Error(`Missing Jerusalem date part ${key}`);
  return value;
}

function wallClock(instant: Date): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
} {
  const bag = jerusalemParts(instant);
  let year = Number(requirePart(bag, "year"));
  let month = Number(requirePart(bag, "month"));
  let day = Number(requirePart(bag, "day"));
  let hour = Number(requirePart(bag, "hour"));
  const minute = Number(requirePart(bag, "minute"));
  const second = Number(requirePart(bag, "second"));
  if (hour === 24) {
    hour = 0;
    const next = new Date(Date.UTC(year, month - 1, day + 1));
    year = next.getUTCFullYear();
    month = next.getUTCMonth() + 1;
    day = next.getUTCDate();
  }
  return { year, month, day, hour, minute, second };
}

/** Calendar date and weekday in Asia/Jerusalem. Friday is 5 and Saturday is 6. */
export function jerusalemDate(instant: Date): JerusalemDate {
  if (Number.isNaN(instant.getTime())) throw new Error("Invalid date");
  const wall = wallClock(instant);
  // Weekday of that Jerusalem calendar day. UTC noon is not the host getDay().
  const weekday = new Date(Date.UTC(wall.year, wall.month - 1, wall.day, 12)).getUTCDay();
  return { year: wall.year, month: wall.month, day: wall.day, weekday };
}

function jerusalemOffsetMs(instant: Date): number {
  const wall = wallClock(instant);
  const asUtc = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, wall.second);
  return asUtc - instant.getTime();
}

/** Builds a UTC instant from a Jerusalem wall-clock time, including DST. */
export function instantInJerusalem(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second = 0,
): Date {
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, second);
  const firstOffset = jerusalemOffsetMs(new Date(utcGuess));
  let instant = new Date(utcGuess - firstOffset);
  const secondOffset = jerusalemOffsetMs(instant);
  if (secondOffset !== firstOffset) instant = new Date(utcGuess - secondOffset);
  return instant;
}

/** Rejects rentals shorter than 24 hours or pickups sooner than 60 minutes. */
export function rentalDurationHours(pickup: Date, returnAt: Date, now: Date): Result<number> {
  for (const value of [pickup, returnAt, now]) {
    if (Number.isNaN(value.getTime())) throw new Error("Invalid date");
  }
  const durationMs = returnAt.getTime() - pickup.getTime();
  if (durationMs < MIN_RENTAL_MS) return err("RENTAL_TOO_SHORT");
  if (pickup.getTime() < now.getTime() + MIN_LEAD_MS) return err("PICKUP_TOO_SOON");
  return ok(durationMs / HOUR_MS);
}
