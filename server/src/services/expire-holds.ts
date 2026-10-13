import { isOpenRental, isOpenSale } from "../domain/offer.js";
import type { StaffStore } from "../repositories/staff-store.js";
import {
  RENTAL_STATUSES,
  SALE_STATUSES,
  type RentalStatus,
  type SaleStatus,
} from "../domain/status.js";

function rentalStatus(value: string): RentalStatus {
  for (const status of RENTAL_STATUSES) {
    if (status === value) return status;
  }
  throw new Error(`Unexpected rental status ${value}`);
}

function saleStatus(value: string): SaleStatus {
  for (const status of SALE_STATUSES) {
    if (status === value) return status;
  }
  throw new Error(`Unexpected sale status ${value}`);
}

/** Pending holds whose clock has run out become expired, so the car can be taken again. */
export async function expireHolds(store: StaffStore, now: Date): Promise<void> {
  const [rentals, sales] = await Promise.all([
    store.listRentalsByStatus("pending_payment"),
    store.listSalesByStatus("pending_payment"),
  ]);
  for (const rental of rentals) {
    if (isOpenRental(rentalStatus(rental.status), rental.holdExpiresAt, now)) continue;
    await store.updateRentalOrder({ ...rental, status: "expired" });
  }
  for (const sale of sales) {
    if (isOpenSale(saleStatus(sale.status), sale.holdExpiresAt, now)) continue;
    await store.updateSaleOrder({ ...sale, status: "expired" });
  }
}
