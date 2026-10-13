import { can } from "../domain/permissions.js";
import { err, ok, type Result } from "../domain/result.js";
import { saleAlertDue } from "../domain/sale.js";
import { jerusalemDate } from "../domain/time.js";
import type { StaffStore } from "../repositories/staff-store.js";
import { listRentalDesk, type RentalDeskView } from "./rental-desk.js";
import type { StaffActor } from "./staff-actor.js";

export type ThresholdCar = {
  id: string;
  plate: string;
  make: string;
  model: string;
  currentKm: number;
  status: string;
};

export type FailedMail = {
  id: string;
  to: string;
  subject: string;
  lastError: string;
};

export type StaffBoard = {
  awaitingHandover: RentalDeskView[];
  openChecklists: RentalDeskView[];
  cancellations: RentalDeskView[];
  saleThreshold: ThresholdCar[];
  failedMail: FailedMail[];
};

/** Yard board: handovers, open checklists, cancellations, and cars still in the rental fleet past the sale threshold. */
export async function staffBoard(
  store: StaffStore,
  actor: StaffActor,
  now: Date,
): Promise<Result<StaffBoard>> {
  if (!can(actor.role, "rentals.read")) return err("FORBIDDEN");
  const rentals = await listRentalDesk(store, actor, null);
  if (!rentals.ok) return rentals;
  const today = jerusalemDate(now);
  const [cars, outbox] = await Promise.all([store.listCars(), store.listOutbox()]);
  const saleThreshold = cars
    .filter((car) => saleAlertDue(car.status, car.purchasedAt, car.currentKm, today))
    .map((car) => ({
      id: car.id,
      plate: car.plate,
      make: car.make,
      model: car.model,
      currentKm: car.currentKm,
      status: car.status,
    }));
  return ok({
    awaitingHandover: rentals.value.filter((order) => order.status === "confirmed"),
    openChecklists: rentals.value.filter((order) => order.status === "checklist"),
    cancellations: rentals.value.filter((order) => order.status === "cancelled"),
    saleThreshold,
    failedMail: outbox
      .filter((row) => row.status === "failed")
      .map((row) => ({
        id: row.id,
        to: row.to,
        subject: row.subject,
        lastError: row.lastError,
      })),
  });
}
