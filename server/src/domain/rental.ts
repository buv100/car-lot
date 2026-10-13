import { validateAgeBands, type AgeBand } from "./age-bands.js";
import { bufferKm, deliveryFeeAgorot } from "./distance.js";
import { type Agorot, agorotFromRounded } from "./money.js";
import { err, ok, type Result } from "./result.js";
import { civilDateKey, HOUR_MS, jerusalemDate, rentalDurationHours } from "./time.js";

/** Which daily price applies. Holiday replaces both weekday and weekend. */
export type DayKind = "weekday" | "weekend" | "holiday";

export type RentalSegment = {
  readonly start: Date;
  readonly hours: number;
};

export type PriceLine = {
  readonly start: Date;
  readonly hours: number;
  readonly dayKind: DayKind;
  readonly agorot: Agorot;
};

export type RentalQuote = {
  readonly totalHours: number;
  readonly lines: readonly PriceLine[];
  readonly rentalAgorot: Agorot;
  readonly insuranceAgorot: Agorot;
  readonly deliveryFeeAgorot: Agorot;
  readonly straightLineKm: number;
  readonly billedKm: number;
  readonly totalAgorot: Agorot;
  readonly kmAllowance: number;
};

export type QuoteRentalInput = {
  readonly pickupAt: Date;
  readonly returnAt: Date;
  readonly now: Date;
  readonly ageAtPickup: number;
  readonly minAge: number;
  readonly bands: readonly AgeBand[];
  readonly holidays: readonly string[];
  readonly insuranceDailyAgorot: Agorot;
  readonly kmPerDay: number;
  readonly returnMode: "lot" | "address";
  readonly straightLineKm: number;
};

const DAY_MS = 24 * HOUR_MS;

/** Cuts the rental into 24-hour slices from pickup, then one leftover slice. */
export function splitRental(pickup: Date, returnAt: Date): RentalSegment[] {
  const startMs = pickup.getTime();
  const endMs = returnAt.getTime();
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) throw new Error("Invalid date");
  const segments: RentalSegment[] = [];
  let cursor = startMs;
  while (endMs - cursor > 0) {
    const sliceMs = Math.min(DAY_MS, endMs - cursor);
    segments.push({ start: new Date(cursor), hours: sliceMs / HOUR_MS });
    cursor += sliceMs;
  }
  return segments;
}

/** Holiday wins over Friday and Saturday. Sunday to Thursday is a weekday. */
export function dayKind(start: Date, holidays: ReadonlySet<string>): DayKind {
  const date = jerusalemDate(start);
  if (holidays.has(civilDateKey(date))) return "holiday";
  if (date.weekday === 5 || date.weekday === 6) return "weekend";
  return "weekday";
}

/** Picks the one age band that contains the driver. A gap means the car is hidden. */
function matchingBand(bands: readonly AgeBand[], age: number): Result<AgeBand> {
  const matches = bands.filter(
    (band) => age >= band.minAge && (band.maxAge === null || age <= band.maxAge),
  );
  if (matches.length > 1) return err("BANDS_OVERLAP");
  const band = matches[0];
  if (band === undefined) return err("AGE_NOT_OFFERED");
  return ok(band);
}

function dailyAgorot(band: AgeBand, kind: DayKind): Agorot {
  if (kind === "holiday") return band.holidayDailyAgorot;
  if (kind === "weekend") return band.weekendDailyAgorot;
  return band.weekdayDailyAgorot;
}

/** A full slice costs one day. A leftover slice costs hours times the daily price divided by 24. */
function segmentAgorot(hours: number, daily: Agorot): Agorot {
  if (hours === 24) return daily;
  return agorotFromRounded((hours * daily) / 24);
}

/** Full rental price: day slices, one insurance plan, and the return-distance fee. */
export function quoteRental(input: QuoteRentalInput): Result<RentalQuote> {
  if (!Number.isInteger(input.kmPerDay) || input.kmPerDay < 0) {
    throw new Error("kmPerDay must be a non-negative integer");
  }
  if (!Number.isInteger(input.ageAtPickup) || !Number.isInteger(input.minAge)) {
    throw new Error("Age must be an integer");
  }

  const duration = rentalDurationHours(input.pickupAt, input.returnAt, input.now);
  if (!duration.ok) return duration;

  const billedKm = input.returnMode === "lot" ? 0 : bufferKm(input.straightLineKm);
  const fee = deliveryFeeAgorot(input.returnMode, billedKm);
  if (!fee.ok) return fee;

  if (input.ageAtPickup < input.minAge) return err("AGE_NOT_OFFERED");
  const bands = validateAgeBands(input.minAge, input.bands);
  if (!bands.ok) return bands;
  const band = matchingBand(input.bands, input.ageAtPickup);
  if (!band.ok) return band;

  const holidays = new Set(input.holidays);
  const lines: PriceLine[] = [];
  let rentalSum = 0;
  for (const segment of splitRental(input.pickupAt, input.returnAt)) {
    // A segment is priced by the Jerusalem date it starts on, not by the
    // dates it crosses. A Thursday 22:00 segment stays a weekday even though
    // most of those 24 hours are Friday. Product spec section 11.
    const kind = dayKind(segment.start, holidays);
    const lineAgorot = segmentAgorot(segment.hours, dailyAgorot(band.value, kind));
    rentalSum += lineAgorot;
    lines.push({
      start: segment.start,
      hours: segment.hours,
      dayKind: kind,
      agorot: lineAgorot,
    });
  }

  const totalHours = duration.value;
  const rentalAgorot = agorotFromRounded(rentalSum);
  const insuranceAgorot = agorotFromRounded((input.insuranceDailyAgorot * totalHours) / 24);
  const straightLineKm = input.returnMode === "lot" ? 0 : input.straightLineKm;
  const storedBilledKm = input.returnMode === "lot" ? 0 : billedKm;
  const kmAllowance = Math.round((input.kmPerDay * totalHours) / 24);

  return ok({
    totalHours,
    lines,
    rentalAgorot,
    insuranceAgorot,
    deliveryFeeAgorot: fee.value,
    straightLineKm,
    billedKm: storedBilledKm,
    totalAgorot: agorotFromRounded(rentalAgorot + insuranceAgorot + fee.value),
    kmAllowance,
  });
}
