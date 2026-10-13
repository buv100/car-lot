import type { CarStatus, RentalStatus, SaleStatus } from "./status.js";

/** A live hold, a confirmed booking, an active rental, or an unfinished checklist. */
export function isOpenRental(status: RentalStatus, holdExpiresAt: Date | null, now: Date): boolean {
  if (status === "confirmed" || status === "active" || status === "checklist") return true;
  if (status !== "pending_payment") return false;
  if (holdExpiresAt === null) return true;
  if (Number.isNaN(holdExpiresAt.getTime()) || Number.isNaN(now.getTime())) {
    throw new Error("Invalid date");
  }
  return holdExpiresAt.getTime() > now.getTime();
}

/** A live deposit hold or a paid reservation. Paid reservations do not expire. */
export function isOpenSale(status: SaleStatus, holdExpiresAt: Date | null, now: Date): boolean {
  if (status === "reserved") return true;
  if (status !== "pending_payment") return false;
  if (holdExpiresAt === null) return true;
  if (Number.isNaN(holdExpiresAt.getTime()) || Number.isNaN(now.getTime())) {
    throw new Error("Invalid date");
  }
  return holdExpiresAt.getTime() > now.getTime();
}

/** Offered only when the car is available and has no open rental, even for other dates. */
export function canOfferForRent(input: {
  readonly status: CarStatus;
  readonly rentals: readonly {
    readonly status: RentalStatus;
    readonly holdExpiresAt: Date | null;
  }[];
  readonly now: Date;
}): boolean {
  if (input.status !== "available") return false;
  return !input.rentals.some((rental) =>
    isOpenRental(rental.status, rental.holdExpiresAt, input.now),
  );
}

/** Offered only when the car is for sale and nobody holds the deposit. */
export function canOfferForSale(input: {
  readonly status: CarStatus;
  readonly sales: readonly { readonly status: SaleStatus; readonly holdExpiresAt: Date | null }[];
  readonly now: Date;
}): boolean {
  if (input.status !== "for_sale") return false;
  return !input.sales.some((sale) => isOpenSale(sale.status, sale.holdExpiresAt, input.now));
}
