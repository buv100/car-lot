import { refundAgorot, refundPercent, yardRefundAgorot } from "../domain/cancellation.js";
import { storedAgorot } from "../domain/money.js";
import { checkRentalMove } from "../domain/orders.js";
import { err, ok, type Result } from "../domain/result.js";
import { RENTAL_STATUSES, type RentalStatus } from "../domain/status.js";
import { HOUR_MS } from "../domain/time.js";
import type { Mailer } from "../mail/mailer.js";
import type { PaymentProvider } from "../payments/provider.js";
import type { RentalOrderRecord, StaffStore } from "../repositories/staff-store.js";
import { deliverPending } from "./deliver-mail.js";
import { requirePermission } from "./login-staff.js";
import { queueCancellation } from "./order-mail.js";
import type { RentalDeskView } from "./rental-desk.js";
import type { StaffActor } from "./staff-actor.js";

function asStatus(value: string): RentalStatus {
  for (const status of RENTAL_STATUSES) {
    if (status === value) return status;
  }
  throw new Error(`Unexpected stored status ${value}`);
}

async function present(store: StaffStore, order: RentalOrderRecord): Promise<RentalDeskView> {
  const car = await store.findCar(order.carId);
  return {
    id: order.id,
    number: order.number,
    carId: order.carId,
    plate: car?.plate ?? "",
    make: car?.make ?? "",
    model: car?.model ?? "",
    status: asStatus(order.status),
    pickupAt: order.pickupAt.toISOString(),
    returnAt: order.returnAt.toISOString(),
    totalAgorot: order.totalAgorot,
    kmAllowance: order.kmAllowance,
    startKm: order.startKm,
    noShow: order.noShow,
    refundPercent: order.refundPercent,
    refundAgorot: order.refundAgorot,
    yardCancelNote: order.yardCancelNote,
  };
}

async function refundPaid(
  payments: PaymentProvider,
  order: RentalOrderRecord,
  amount: number,
): Promise<void> {
  if (amount === 0) return;
  if (order.paymentRef === null) throw new Error("Paid order is missing a payment reference");
  await payments.refund({ providerRef: order.paymentRef, amount: storedAgorot(amount) });
}

/**
 * Customer cancel before handover. The percent follows the hours left until pickup.
 * The letter is written with the status change, and sent only after that commit.
 */
export async function cancelRentalByCustomer(
  store: StaffStore,
  payments: PaymentProvider,
  mailer: Mailer,
  input: { orderId: string; customerId: string; now: Date },
): Promise<Result<RentalDeskView>> {
  const order = await store.findRentalOrder(input.orderId);
  if (order === null || order.customerId !== input.customerId) return err("NOT_FOUND");
  const move = checkRentalMove({
    from: asStatus(order.status),
    to: "cancelled",
    cause: "customer_cancel",
    actor: { kind: "customer" },
  });
  if (!move.ok) return move;
  const hours = (order.pickupAt.getTime() - input.now.getTime()) / HOUR_MS;
  const percent = refundPercent(hours);
  const amount = refundAgorot(storedAgorot(order.totalAgorot), percent);
  await refundPaid(payments, order, amount);
  const next: RentalOrderRecord = {
    ...order,
    status: "cancelled",
    cancelledBy: "customer",
    refundPercent: percent,
    refundAgorot: amount,
  };
  await store.transaction(async (tx) => {
    await tx.updateRentalOrder(next);
    await queueCancellation(tx, next.id, input.now);
  });
  await deliverPending(store, mailer, input.now);
  return ok(await present(store, next));
}

/**
 * Yard cancel before handover refunds everything paid, at any hour.
 * The letter is written with the status change, and sent only after that commit.
 */
export async function cancelRentalByYard(
  store: StaffStore,
  payments: PaymentProvider,
  mailer: Mailer,
  actor: StaffActor,
  orderId: string,
  note: string,
  now: Date,
): Promise<Result<RentalDeskView>> {
  const allowed = requirePermission(actor.role, "rentals.cancel_yard");
  if (!allowed.ok) return allowed;
  const reason = note.trim();
  if (reason.length === 0) return err("INVALID_INPUT");
  const order = await store.findRentalOrder(orderId);
  if (order === null) return err("NOT_FOUND");
  const move = checkRentalMove({
    from: asStatus(order.status),
    to: "cancelled",
    cause: "yard_cancel",
    actor: { kind: "staff", role: actor.role },
  });
  if (!move.ok) return move;
  const amount = yardRefundAgorot(storedAgorot(order.totalAgorot));
  await refundPaid(payments, order, amount);
  const next: RentalOrderRecord = {
    ...order,
    status: "cancelled",
    cancelledBy: "yard",
    yardCancelNote: reason,
    refundPercent: 100,
    refundAgorot: amount,
  };
  await store.transaction(async (tx) => {
    await tx.updateRentalOrder(next);
    await queueCancellation(tx, next.id, now);
  });
  await deliverPending(store, mailer, now);
  return ok(await present(store, next));
}
