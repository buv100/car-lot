import { saleAlertDue } from "../domain/sale.js";
import { HOUR_MS, jerusalemDate } from "../domain/time.js";
import {
  rentalCancelledLetters,
  rentalReminderLetter,
  saleThresholdLetter,
} from "../mail/letters.js";
import type { RentalOrderRecord, StaffStore } from "../repositories/staff-store.js";
import { pendingOutbox } from "./deliver-mail.js";

const REMINDER_WINDOW_MS = 24 * HOUR_MS;

/** Writes the cancellation letters in the caller's transaction. */
export async function queueCancellation(
  store: StaffStore,
  orderId: string,
  now: Date,
): Promise<void> {
  const order = await store.findRentalOrder(orderId);
  if (order === null || order.customerId === null) return;
  const customer = await store.findCustomerById(order.customerId);
  if (customer === null) return;
  const lot = await store.readLot();
  const letters = rentalCancelledLetters({
    number: order.number,
    percent: order.refundPercent ?? 0,
    refundAgorot: order.refundAgorot ?? 0,
    customerEmail: customer.email,
    staffEmail: lot?.staffAlertEmail ?? "",
  });
  for (const letter of letters) await store.insertOutbox(pendingOutbox(letter, now));
}

async function reminderFor(
  store: StaffStore,
  order: RentalOrderRecord,
): Promise<{ to: string; subject: string; body: string } | null> {
  if (order.customerId === null) return null;
  const [customer, car, lot] = await Promise.all([
    store.findCustomerById(order.customerId),
    store.findCar(order.carId),
    store.readLot(),
  ]);
  if (customer === null || car === null) return null;
  return rentalReminderLetter({
    number: order.number,
    plate: car.plate,
    make: car.make,
    model: car.model,
    pickupAt: order.pickupAt,
    lotAddress: lot?.address ?? "",
    customerEmail: customer.email,
  });
}

function reminderDue(order: RentalOrderRecord, now: Date): boolean {
  if (order.reminderSentAt !== null || order.status !== "confirmed") return false;
  const until = order.pickupAt.getTime() - now.getTime();
  return until > 0 && until <= REMINDER_WINDOW_MS;
}

/** Queues one reminder per confirmed rental whose pickup is inside the next 24 hours. */
export async function queueReminders(store: StaffStore, now: Date): Promise<void> {
  const orders = await store.listRentalsByStatus("confirmed");
  for (const order of orders) {
    if (!reminderDue(order, now)) continue;
    await store.transaction(async (tx) => {
      const current = await tx.findRentalOrder(order.id);
      if (current === null || !reminderDue(current, now)) return;
      const letter = await reminderFor(tx, current);
      if (letter === null) return;
      await tx.insertOutbox(pendingOutbox(letter, now));
      await tx.updateRentalOrder({ ...current, reminderSentAt: now });
    });
  }
}

/**
 * Queues the single sale-threshold letter for one car.
 * The caller runs this inside the transaction that changed the kilometres.
 */
export async function queueSaleAlertForCar(
  store: StaffStore,
  carId: string,
  now: Date,
): Promise<void> {
  const car = await store.findCar(carId);
  if (car === null || car.saleAlertSentAt !== null) return;
  if (!saleAlertDue(car.status, car.purchasedAt, car.currentKm, jerusalemDate(now))) return;
  const lot = await store.readLot();
  if (lot === null || lot.staffAlertEmail === "") return;
  await store.insertOutbox(
    pendingOutbox(
      saleThresholdLetter({
        plate: car.plate,
        make: car.make,
        model: car.model,
        currentKm: car.currentKm,
        staffEmail: lot.staffAlertEmail,
      }),
      now,
    ),
  );
  await store.markSaleAlertSent(carId, now);
}

/** Nightly scan. A car that already has saleAlertSentAt is skipped. */
export async function queueSaleAlerts(store: StaffStore, now: Date): Promise<void> {
  const cars = await store.listCars();
  for (const car of cars) {
    await store.transaction(async (tx) => {
      await queueSaleAlertForCar(tx, car.id, now);
    });
  }
}
