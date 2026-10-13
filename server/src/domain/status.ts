/** Where a car sits in the yard. An open rental is tracked on the order, not here. */
export const CAR_STATUSES = [
  "preparing",
  "available",
  "in_care",
  "deep_treatment",
  "for_sale",
  "sold",
] as const;

export type CarStatus = (typeof CAR_STATUSES)[number];

/** Lifecycle of one rental, from the 15-minute hold through return or cancel. */
export const RENTAL_STATUSES = [
  "pending_payment",
  "confirmed",
  "active",
  "checklist",
  "completed",
  "cancelled",
  "expired",
] as const;

export type RentalStatus = (typeof RENTAL_STATUSES)[number];

/** Lifecycle of a 10 percent deposit. There is no expiry after it is paid. */
export const SALE_STATUSES = [
  "pending_payment",
  "reserved",
  "completed",
  "cancelled",
  "expired",
] as const;

export type SaleStatus = (typeof SALE_STATUSES)[number];

/** Why a car sits in `in_care`. This is not a checklist. */
export const CARE_REASONS = ["wash", "treatment", "other"] as const;

export type CareReason = (typeof CARE_REASONS)[number];

/** One primary body type. Electric and automatic are tags, not types. */
export const CAR_TYPES = ["mini", "family", "suv", "seven_seat", "luxury", "commercial"] as const;

export type CarType = (typeof CAR_TYPES)[number];
