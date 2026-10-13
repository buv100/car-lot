import { randomUUID } from "node:crypto";

import { validateAgeBands, type AgeBand } from "../domain/age-bands.js";
import { agorot, type Agorot } from "../domain/money.js";
import { err, ok, type Result } from "../domain/result.js";
import type { StaffStore } from "../repositories/staff-store.js";
import { presentCar, toCarWrite, type StaffCarView } from "./car-view.js";
import { requirePermission } from "./login-staff.js";
import type { StaffActor } from "./staff-actor.js";

export type BandInput = {
  readonly minAge: number;
  readonly maxAge: number | null;
  readonly weekdayShekels: number;
  readonly weekendShekels: number;
  readonly holidayShekels: number;
};

function money(shekels: number): Agorot | null {
  if (!Number.isInteger(shekels) || shekels < 0) return null;
  return agorot(shekels);
}

/** Saves the age bands and the car minimum age together, so they cannot drift. */
export async function saveAgeBands(
  store: StaffStore,
  actor: StaffActor,
  carId: string,
  minAge: number,
  input: readonly BandInput[],
  now: Date,
): Promise<Result<StaffCarView>> {
  const allowed = requirePermission(actor.role, "cars.price");
  if (!allowed.ok) return allowed;
  if (!Number.isInteger(minAge) || minAge < 16 || minAge > 99) return err("INVALID_INPUT");
  const bands: AgeBand[] = [];
  for (const band of input) {
    const weekday = money(band.weekdayShekels);
    const weekend = money(band.weekendShekels);
    const holiday = money(band.holidayShekels);
    if (weekday === null || weekend === null || holiday === null) return err("INVALID_INPUT");
    if (
      !Number.isInteger(band.minAge) ||
      (band.maxAge !== null && !Number.isInteger(band.maxAge))
    ) {
      return err("INVALID_INPUT");
    }
    bands.push({
      minAge: band.minAge,
      maxAge: band.maxAge,
      weekdayDailyAgorot: weekday,
      weekendDailyAgorot: weekend,
      holidayDailyAgorot: holiday,
    });
  }
  const check = validateAgeBands(minAge, bands);
  if (!check.ok) return check;
  return store.transaction(async (tx) => {
    const car = await tx.findCar(carId);
    if (car === null) return err("NOT_FOUND");
    await tx.updateCar({ ...toCarWrite(car), minAge });
    await tx.replaceAgeBands(
      carId,
      bands.map((band) => ({
        id: randomUUID(),
        minAge: band.minAge,
        maxAge: band.maxAge,
        weekdayDailyAgorot: band.weekdayDailyAgorot,
        weekendDailyAgorot: band.weekendDailyAgorot,
        holidayDailyAgorot: band.holidayDailyAgorot,
      })),
    );
    const updated = await tx.findCar(carId);
    if (updated === null) throw new Error("Car missing after bands");
    const tags = await tx.listTags();
    const rentals = await tx.listRentals(carId);
    return ok(presentCar(updated, tags, rentals, now));
  });
}
