import { type Agorot, agorotFromRounded } from "./money.js";

/** Lot-initiated cancel always refunds the full amount paid. */
export const YARD_REFUND_PERCENT = 100;

/** Customer cancel rate. Exactly 48 hours is 50 percent, not a full refund. */
export function refundPercent(hoursUntilPickup: number): 0 | 10 | 25 | 50 | 100 {
  if (!Number.isFinite(hoursUntilPickup)) {
    throw new Error("Hours until pickup must be finite");
  }
  // Strictly more than 48 hours is a full refund. Exactly 48 hours falls in the 50 percent band.
  if (hoursUntilPickup > 48) return 100;
  if (hoursUntilPickup >= 24) return 50;
  if (hoursUntilPickup >= 18) return 25;
  if (hoursUntilPickup >= 12) return 10;
  return 0;
}

/** Applies a refund percent to the amount paid, rounded to the nearest agora. */
export function refundAgorot(total: Agorot, percent: number): Agorot {
  if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
    throw new Error("Refund percent must be between 0 and 100");
  }
  return agorotFromRounded((total * percent) / 100);
}

/** Full refund when the lot cancels, at any hour. */
export function yardRefundAgorot(amountPaid: Agorot): Agorot {
  return refundAgorot(amountPaid, YARD_REFUND_PERCENT);
}
