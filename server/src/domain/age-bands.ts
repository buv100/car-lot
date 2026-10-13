import { type Agorot } from "./money.js";
import { err, ok, type Result } from "./result.js";

/** One age range on a single car, with a daily price for weekday, weekend, and holiday. */
export type AgeBand = {
  readonly minAge: number;
  readonly maxAge: number | null;
  readonly weekdayDailyAgorot: Agorot;
  readonly weekendDailyAgorot: Agorot;
  readonly holidayDailyAgorot: Agorot;
};

function isNonNegativeIntegerMoney(value: Agorot): boolean {
  return Number.isInteger(value) && value >= 0;
}

function rangesOverlap(bands: readonly AgeBand[]): boolean {
  const sorted = [...bands].sort((left, right) => left.minAge - right.minAge);
  let previousEnd = -1;
  for (const band of sorted) {
    if (band.minAge <= previousEnd) return true;
    previousEnd = band.maxAge === null ? Number.POSITIVE_INFINITY : band.maxAge;
  }
  return false;
}

/** Bands may leave age gaps, but they must not overlap and the lowest starts at minAge. */
export function validateAgeBands(minAge: number, bands: readonly AgeBand[]): Result<void> {
  if (!Number.isInteger(minAge) || minAge < 0) {
    throw new Error("Car minimum age must be a non-negative integer");
  }
  if (bands.length === 0) return err("BANDS_INVALID", "At least one age band is required");

  for (const band of bands) {
    if (!Number.isInteger(band.minAge) || band.minAge < 0) {
      return err("BANDS_INVALID", "Band ages must be non-negative integers");
    }
    if (band.maxAge !== null && (!Number.isInteger(band.maxAge) || band.maxAge < band.minAge)) {
      return err("BANDS_INVALID", "Band maximum age is below its minimum");
    }
    if (
      !isNonNegativeIntegerMoney(band.weekdayDailyAgorot) ||
      !isNonNegativeIntegerMoney(band.weekendDailyAgorot) ||
      !isNonNegativeIntegerMoney(band.holidayDailyAgorot)
    ) {
      return err("BANDS_INVALID", "Band prices must be non-negative integer agorot");
    }
  }

  if (rangesOverlap(bands)) return err("BANDS_OVERLAP");

  const lowest = [...bands].sort((left, right) => left.minAge - right.minAge)[0];
  if (lowest === undefined || lowest.minAge !== minAge) {
    return err("BANDS_INVALID", "Lowest band must start at the car minimum age");
  }
  return ok(undefined);
}
