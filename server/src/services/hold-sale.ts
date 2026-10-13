import { randomUUID } from "node:crypto";

import { formatOrderNumber } from "../domain/order-number.js";
import { depositAgorot } from "../domain/sale.js";
import { storedAgorot } from "../domain/money.js";
import { err, ok, type Result } from "../domain/result.js";
import { jerusalemDate } from "../domain/time.js";
import {
  DuplicateRecord,
  type SaleOrderRecord,
  type StaffStore,
} from "../repositories/staff-store.js";
import { toCarWrite } from "./car-view.js";
import { expireHolds } from "./expire-holds.js";
import { hasOpenRental, hasOpenSale } from "./holds.js";
import { newHoldToken } from "./hold-token.js";

const HOLD_MS = 15 * 60 * 1000;

function noteOk(value: string): boolean {
  return value.length <= 500;
}

/** Holds a car for sale for 15 minutes. The deposit is 10 percent of the price snapshot. */
export async function holdSale(
  store: StaffStore,
  input: {
    carId: string;
    wantsFinancing: boolean;
    financingNote: string;
    wantsTradeIn: boolean;
    tradeInNote: string;
  },
  now: Date,
): Promise<
  Result<{ orderId: string; holdToken: string; holdExpiresAt: string; depositAgorot: number }>
> {
  if (!noteOk(input.financingNote) || !noteOk(input.tradeInNote)) return err("INVALID_INPUT");
  await expireHolds(store, now);
  const token = newHoldToken();
  try {
    return await store.transaction(async (tx) => {
      const car = await tx.findPublicSale(input.carId);
      if (car === null || car.salePriceAgorot === null || car.salePriceAgorot <= 0) {
        return err("NOT_FOUND");
      }
      if (car.conditionGrade === null || car.ownersCount === null) return err("NOT_FOUND");
      if (hasOpenSale(car.sales, now)) return err("CAR_TAKEN");
      if (car.status === "available") {
        if (hasOpenRental(car.rentals, now)) return err("CAR_TAKEN");
        const full = await tx.findCar(car.id);
        if (full === null) return err("NOT_FOUND");
        await tx.updateCar({ ...toCarWrite(full), status: "for_sale", careReason: null });
      } else if (car.status !== "for_sale") {
        return err("CAR_TAKEN");
      }
      const list = storedAgorot(car.salePriceAgorot);
      const deposit = depositAgorot(list);
      const year = jerusalemDate(now).year;
      const sequence = await tx.allocateSequence("S", year);
      const holdExpiresAt = new Date(now.getTime() + HOLD_MS);
      const order: SaleOrderRecord = {
        id: randomUUID(),
        number: formatOrderNumber("S", year, sequence),
        carId: car.id,
        customerId: null,
        holderTokenHash: token.hash,
        listPriceAgorot: list,
        depositAgorot: deposit,
        status: "pending_payment",
        wantsFinancing: input.wantsFinancing,
        financingNote: input.financingNote.trim(),
        wantsTradeIn: input.wantsTradeIn,
        tradeInNote: input.tradeInNote.trim(),
        holdExpiresAt,
        paymentProvider: "stripe",
        paymentRef: null,
        refundDecidedAt: null,
        refundApproved: null,
        refundByStaffId: null,
        handoverAt: null,
        handoverByStaffId: null,
      };
      await tx.insertSaleOrder(order);
      return ok({
        orderId: order.id,
        holdToken: token.raw,
        holdExpiresAt: holdExpiresAt.toISOString(),
        depositAgorot: deposit,
      });
    });
  } catch (error: unknown) {
    if (error instanceof DuplicateRecord) return err("CAR_TAKEN");
    throw error;
  }
}
