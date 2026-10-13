import { randomUUID } from "node:crypto";

import { err, ok, type Result } from "../domain/result.js";
import type { Mailer } from "../mail/mailer.js";
import { rentalConfirmedLetters, saleReservedLetters } from "../mail/letters.js";
import type { PaymentEvent } from "../payments/provider.js";
import { DuplicateRecord, type StaffStore } from "../repositories/staff-store.js";
import { deliverPending, pendingOutbox } from "./deliver-mail.js";

/** Applies one signed payment event. A repeated event id does not queue a second letter. */
export async function confirmPayment(
  store: StaffStore,
  event: PaymentEvent,
  mailer: Mailer,
  now: Date,
): Promise<Result<void>> {
  if (event.outcome === "ignored") return ok(undefined);
  if (event.orderId === "") return err("NOT_FOUND");
  const rental = await store.findRentalOrder(event.orderId);
  const sale = rental === null ? await store.findSaleOrder(event.orderId) : null;
  if (rental === null && sale === null) return err("NOT_FOUND");
  try {
    await store.transaction(async (tx) => {
      await tx.insertPaymentEvent({
        id: randomUUID(),
        provider: "stripe",
        providerEventId: event.providerEventId,
        orderKind: rental === null ? "sale" : "rental",
        orderId: event.orderId,
      });
      if (rental !== null) await applyRental(tx, rental.id, event, now);
      if (sale !== null) await applySale(tx, sale.id, event, now);
    });
  } catch (error: unknown) {
    if (error instanceof DuplicateRecord) {
      await deliverPending(store, mailer, now);
      return ok(undefined);
    }
    throw error;
  }
  await deliverPending(store, mailer, now);
  return ok(undefined);
}

async function applyRental(
  store: StaffStore,
  orderId: string,
  event: PaymentEvent,
  now: Date,
): Promise<void> {
  const order = await store.findRentalOrder(orderId);
  if (order === null || order.status !== "pending_payment") return;
  if (event.outcome === "failed") {
    await store.updateRentalOrder({ ...order, status: "expired" });
    return;
  }
  const paid = {
    ...order,
    status: "confirmed" as const,
    holdExpiresAt: null,
    paymentRef: event.providerRef ?? order.paymentRef,
  };
  await store.updateRentalOrder(paid);
  for (const letter of await rentalLetters(store, paid, now)) await store.insertOutbox(letter);
}

async function applySale(
  store: StaffStore,
  orderId: string,
  event: PaymentEvent,
  now: Date,
): Promise<void> {
  const order = await store.findSaleOrder(orderId);
  if (order === null || order.status !== "pending_payment") return;
  if (event.outcome === "failed") {
    await store.updateSaleOrder({ ...order, status: "expired" });
    return;
  }
  // A paid deposit has no end time. The car stays off the site until a manager refunds it.
  const reserved = {
    ...order,
    status: "reserved" as const,
    holdExpiresAt: null,
    paymentRef: event.providerRef ?? order.paymentRef,
  };
  await store.updateSaleOrder(reserved);
  for (const letter of await saleLetters(store, reserved, now)) await store.insertOutbox(letter);
}

async function rentalLetters(
  store: StaffStore,
  order: {
    number: string;
    carId: string;
    customerId: string | null;
    pickupAt: Date;
    returnAt: Date;
    returnMode: "lot" | "address";
    returnAddress: string;
    rentalAgorot: number;
    insuranceAgorot: number;
    deliveryFeeAgorot: number;
    totalAgorot: number;
  },
  now: Date,
) {
  const [car, customer, lot] = await Promise.all([
    store.findCar(order.carId),
    order.customerId === null ? Promise.resolve(null) : store.findCustomerById(order.customerId),
    store.readLot(),
  ]);
  if (car === null || customer === null || lot === null) return [];
  const returnAddress = order.returnMode === "lot" ? lot.address : order.returnAddress;
  return rentalConfirmedLetters({
    number: order.number,
    plate: car.plate,
    make: car.make,
    model: car.model,
    pickupAt: order.pickupAt,
    returnAt: order.returnAt,
    lotAddress: lot.address,
    returnAddress,
    rentalAgorot: order.rentalAgorot,
    insuranceAgorot: order.insuranceAgorot,
    deliveryFeeAgorot: order.deliveryFeeAgorot,
    totalAgorot: order.totalAgorot,
    customerEmail: customer.email,
    staffEmail: lot.staffAlertEmail,
  })
    .filter((letter) => letter.to !== "")
    .map((letter) => pendingOutbox(letter, now));
}

async function saleLetters(
  store: StaffStore,
  order: {
    number: string;
    carId: string;
    customerId: string | null;
    depositAgorot: number;
  },
  now: Date,
) {
  const [car, customer, lot] = await Promise.all([
    store.findCar(order.carId),
    order.customerId === null ? Promise.resolve(null) : store.findCustomerById(order.customerId),
    store.readLot(),
  ]);
  if (car === null || customer === null || lot === null) return [];
  return saleReservedLetters({
    number: order.number,
    make: car.make,
    model: car.model,
    depositAgorot: order.depositAgorot,
    customerEmail: customer.email,
    staffEmail: lot.staffAlertEmail,
  })
    .filter((letter) => letter.to !== "")
    .map((letter) => pendingOutbox(letter, now));
}
