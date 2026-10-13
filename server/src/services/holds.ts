import { isOpenRental, isOpenSale } from "../domain/offer.js";
import { RENTAL_STATUSES, SALE_STATUSES } from "../domain/status.js";
import type { HoldSnapshot } from "../repositories/staff-store.js";

function oneOf<T extends string>(value: string, options: readonly T[]): T {
  for (const option of options) {
    if (option === value) return option;
  }
  throw new Error(`Unexpected stored status ${value}`);
}

/** A rental row still blocks the car, including a hold that has not expired. */
export function hasOpenRental(rows: readonly HoldSnapshot[], now: Date): boolean {
  return rows.some((row) =>
    isOpenRental(oneOf(row.status, RENTAL_STATUSES), row.holdExpiresAt, now),
  );
}

/** A deposit hold or a paid reservation keeps the car off the sale catalog. */
export function hasOpenSale(rows: readonly HoldSnapshot[], now: Date): boolean {
  return rows.some((row) => isOpenSale(oneOf(row.status, SALE_STATUSES), row.holdExpiresAt, now));
}
