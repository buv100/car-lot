import { randomUUID } from "node:crypto";

import { err, ok, type Result } from "../domain/result.js";
import type { Mailer } from "../mail/mailer.js";
import type { StaffStore } from "../repositories/staff-store.js";
import { presentCar, toCarWrite, type StaffCarView } from "./car-view.js";
import { deliverPending } from "./deliver-mail.js";
import { requirePermission } from "./login-staff.js";
import { queueSaleAlertForCar } from "./order-mail.js";
import type { StaffActor } from "./staff-actor.js";

/** Manager correction of the odometer, including a decrease, with a required reason. */
export async function adjustKm(
  store: StaffStore,
  actor: StaffActor,
  carId: string,
  nextKm: number,
  reason: string,
  now: Date,
  mailer: Mailer,
): Promise<Result<StaffCarView>> {
  const allowed = requirePermission(actor.role, "settings.write");
  if (!allowed.ok) return allowed;
  const note = reason.trim();
  if (!Number.isInteger(nextKm) || nextKm < 0 || note.length < 2 || note.length > 500) {
    return err("INVALID_INPUT");
  }
  const saved = await store.transaction(async (tx) => {
    const car = await tx.findCar(carId);
    if (car === null) return err("NOT_FOUND");
    await tx.insertKmAdjustment({
      id: randomUUID(),
      carId,
      staffId: actor.id,
      previousKm: car.currentKm,
      nextKm,
      reason: note,
      createdAt: now,
    });
    await tx.updateCar({ ...toCarWrite(car), currentKm: nextKm });
    await queueSaleAlertForCar(tx, carId, now);
    const updated = await tx.findCar(carId);
    if (updated === null) throw new Error("Car missing after kilometre correction");
    const tags = await tx.listTags();
    const rentals = await tx.listRentals(carId);
    return ok(presentCar(updated, tags, rentals, now));
  });
  if (saved.ok) await deliverPending(store, mailer, now);
  return saved;
}
