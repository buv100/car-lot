import { type Agorot, agorotFromRounded } from "./money.js";
import { addCalendarYears, type CivilDate, compareCivilDates } from "./time.js";
import type { CarStatus } from "./status.js";

/** Public condition score shown on a car for sale. */
export const CONDITION_GRADES = ["excellent", "good", "fair"] as const;

export type ConditionGrade = (typeof CONDITION_GRADES)[number];

export type SaleListing = {
  readonly ownersCount: number | null;
  readonly knownAccidents: string | null;
  readonly accidentsNone: boolean;
  readonly conditionGrade: ConditionGrade | null;
  readonly salePriceAgorot: Agorot | null;
  readonly photoCount: number;
};

/** Ten percent of the listed price, rounded to the nearest agora. */
export function depositAgorot(listPrice: Agorot): Agorot {
  return agorotFromRounded(listPrice * 0.1);
}

/** Owners, accidents, grade, price, and at least four photos are required before sale. */
export function isSaleListingReady(listing: SaleListing): boolean {
  const accidentsRecorded =
    listing.accidentsNone ||
    (listing.knownAccidents !== null && listing.knownAccidents.trim().length > 0);
  return (
    listing.ownersCount !== null &&
    Number.isInteger(listing.ownersCount) &&
    listing.ownersCount >= 1 &&
    accidentsRecorded &&
    listing.conditionGrade !== null &&
    listing.salePriceAgorot !== null &&
    listing.salePriceAgorot > 0 &&
    Number.isInteger(listing.photoCount) &&
    listing.photoCount >= 4
  );
}

/** True at 100,000 km or three calendar years after purchase. Does not change status. */
export function saleThresholdReached(
  purchasedAt: CivilDate,
  currentKm: number,
  today: CivilDate,
): boolean {
  if (!Number.isInteger(currentKm) || currentKm < 0) {
    throw new Error("currentKm must be a non-negative integer");
  }
  const due = addCalendarYears(purchasedAt, 3);
  if (currentKm >= 100_000) return true;
  return compareCivilDates(due, today) <= 0;
}

const RENTAL_FLEET: readonly CarStatus[] = ["preparing", "available", "in_care"];

/** Staff alert while the car is still in the rental fleet. Sale status is a separate step. */
export function saleAlertDue(
  status: CarStatus,
  purchasedAt: CivilDate,
  currentKm: number,
  today: CivilDate,
): boolean {
  return RENTAL_FLEET.includes(status) && saleThresholdReached(purchasedAt, currentKm, today);
}
