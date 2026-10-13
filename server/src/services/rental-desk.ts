import { randomUUID } from "node:crypto";

import { refundAgorot, refundPercent } from "../domain/cancellation.js";
import { storedAgorot } from "../domain/money.js";
import { checkRentalMove } from "../domain/orders.js";
import { err, ok, type Result } from "../domain/result.js";
import { RENTAL_STATUSES, type RentalStatus } from "../domain/status.js";
import { HOUR_MS } from "../domain/time.js";
import type {
  ChecklistRecord,
  RentalOrderRecord,
  StaffStore,
} from "../repositories/staff-store.js";
import { requirePermission } from "./login-staff.js";
import type { StaffActor } from "./staff-actor.js";

export type RentalDeskView = {
  id: string;
  number: string;
  carId: string;
  plate: string;
  make: string;
  model: string;
  status: RentalStatus;
  pickupAt: string;
  returnAt: string;
  totalAgorot: number;
  kmAllowance: number;
  startKm: number | null;
  noShow: boolean;
  refundPercent: number | null;
  refundAgorot: number | null;
  yardCancelNote: string;
};

function asStatus(value: string): RentalStatus {
  for (const status of RENTAL_STATUSES) {
    if (status === value) return status;
  }
  throw new Error(`Unexpected stored status ${value}`);
}

function present(
  order: RentalOrderRecord,
  car: { plate: string; make: string; model: string } | null,
): RentalDeskView {
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

async function viewOf(store: StaffStore, order: RentalOrderRecord): Promise<RentalDeskView> {
  const car = await store.findCar(order.carId);
  return present(order, car);
}

function blankChecklist(rentalOrderId: string, endKm: number | null): ChecklistRecord {
  return {
    id: randomUUID(),
    rentalOrderId,
    endKm,
    fuelLitersShort: endKm === null ? null : 0,
    fuelChargeAgorot: null,
    kmExcess: null,
    kmChargeAgorot: null,
    washNeeded: false,
    washDone: false,
    treatmentNeeded: false,
    treatmentDone: false,
    treatmentNote: "",
    priceDecision: null,
    completedAt: null,
    completedByStaffId: null,
    returnPhotoIds: [],
    damages: [],
  };
}

/** Rentals for the yard list. The optional status is a stored status, not a search. */
export async function listRentalDesk(
  store: StaffStore,
  actor: StaffActor,
  status: string | null,
): Promise<Result<RentalDeskView[]>> {
  const allowed = requirePermission(actor.role, "rentals.read");
  if (!allowed.ok) return allowed;
  const orders = await store.listRentalOrders();
  const views: RentalDeskView[] = [];
  for (const order of orders) {
    if (status !== null && order.status !== status) continue;
    views.push(await viewOf(store, order));
  }
  return ok(views);
}

/** One rental for the checklist screen. */
export async function getRentalDesk(
  store: StaffStore,
  actor: StaffActor,
  orderId: string,
): Promise<Result<RentalDeskView>> {
  const allowed = requirePermission(actor.role, "rentals.read");
  if (!allowed.ok) return allowed;
  const order = await store.findRentalOrder(orderId);
  if (order === null) return err("NOT_FOUND");
  return ok(await viewOf(store, order));
}

/** Confirmed rental leaves the lot. Start kilometres are required. */
export async function handOverRental(
  store: StaffStore,
  actor: StaffActor,
  orderId: string,
  startKm: number,
): Promise<Result<RentalDeskView>> {
  const allowed = requirePermission(actor.role, "rentals.handover");
  if (!allowed.ok) return allowed;
  return store.transaction(async (tx) => {
    const order = await tx.findRentalOrder(orderId);
    if (order === null) return err("NOT_FOUND");
    const move = checkRentalMove({
      from: asStatus(order.status),
      to: "active",
      cause: "handover",
      actor: { kind: "staff", role: actor.role },
      startKm,
    });
    if (!move.ok) return move;
    const next: RentalOrderRecord = { ...order, status: "active", startKm };
    await tx.updateRentalOrder(next);
    return ok(await viewOf(tx, next));
  });
}

/** Active rental comes back and opens an empty checklist. */
export async function markReturned(
  store: StaffStore,
  actor: StaffActor,
  orderId: string,
): Promise<Result<RentalDeskView>> {
  const allowed = requirePermission(actor.role, "rentals.handover");
  if (!allowed.ok) return allowed;
  return store.transaction(async (tx) => {
    const order = await tx.findRentalOrder(orderId);
    if (order === null) return err("NOT_FOUND");
    const move = checkRentalMove({
      from: asStatus(order.status),
      to: "checklist",
      cause: "returned",
      actor: { kind: "staff", role: actor.role },
    });
    if (!move.ok) return move;
    const next: RentalOrderRecord = { ...order, status: "checklist" };
    await tx.updateRentalOrder(next);
    const existing = await tx.findChecklist(order.id);
    if (existing === null) await tx.saveChecklist(blankChecklist(order.id, null));
    return ok(await viewOf(tx, next));
  });
}

/**
 * After pickup, a confirmed rental that nobody collected becomes a checklist.
 * The refund percent is fixed now and applied when that checklist closes.
 */
export async function markNoShow(
  store: StaffStore,
  actor: StaffActor,
  orderId: string,
  now: Date,
  flags: { washNeeded: boolean; treatmentNeeded: boolean },
): Promise<Result<RentalDeskView>> {
  const allowed = requirePermission(actor.role, "rentals.handover");
  if (!allowed.ok) return allowed;
  return store.transaction(async (tx) => {
    const order = await tx.findRentalOrder(orderId);
    if (order === null) return err("NOT_FOUND");
    const move = checkRentalMove({
      from: asStatus(order.status),
      to: "checklist",
      cause: "no_show",
      actor: { kind: "staff", role: actor.role },
      now,
      pickupAt: order.pickupAt,
    });
    if (!move.ok) return move;
    const car = await tx.findCar(order.carId);
    if (car === null) throw new Error("Car missing for no-show");
    const hours = (order.pickupAt.getTime() - now.getTime()) / HOUR_MS;
    const percent = refundPercent(hours);
    const amount = refundAgorot(storedAgorot(order.totalAgorot), percent);
    const next: RentalOrderRecord = {
      ...order,
      status: "checklist",
      noShow: true,
      startKm: car.currentKm,
      cancelledBy: "customer" as const,
      refundPercent: percent,
      refundAgorot: amount,
    };
    await tx.updateRentalOrder(next);
    const checklist = blankChecklist(order.id, car.currentKm);
    checklist.washNeeded = flags.washNeeded;
    checklist.treatmentNeeded = flags.treatmentNeeded;
    await tx.saveChecklist(checklist);
    return ok(await viewOf(tx, next));
  });
}
