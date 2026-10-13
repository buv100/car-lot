import { storedAgorot } from "../domain/money.js";
import { err, ok, type Result } from "../domain/result.js";
import { CARE_REASONS, type CareReason, type CarStatus } from "../domain/status.js";
import { checkCarMove, type CarTransitionCause } from "../domain/transitions.js";
import type { StaffStore } from "../repositories/staff-store.js";
import { presentCar, toCarWrite, type StaffCarView } from "./car-view.js";
import { hasOpenRental } from "./holds.js";
import { requirePermission } from "./login-staff.js";
import type { StaffActor } from "./staff-actor.js";

function careReasonOf(value: string | undefined): CareReason | null {
  if (value === undefined) return null;
  for (const reason of CARE_REASONS) {
    if (reason === value) return reason;
  }
  return null;
}

function causeFor(from: CarStatus, to: CarStatus): CarTransitionCause | null {
  if (from === "preparing" && to === "available") return "publish";
  if (from === "in_care" && to === "available") return "finish_care";
  if (from === "available" && to === "in_care") return "start_care";
  if (from === "available" && to === "deep_treatment") return "start_deep_treatment";
  return null;
}

/** Moves a car through preparation, care, and deep treatment. Sale moves stay later. */
export async function changeCarStatus(
  store: StaffStore,
  actor: StaffActor,
  id: string,
  input: { to: CarStatus; careReason?: CareReason },
  now: Date,
): Promise<Result<StaffCarView>> {
  const allowed = requirePermission(actor.role, "cars.status");
  if (!allowed.ok) return allowed;
  return store.transaction(async (tx) => {
    const car = await tx.findCar(id);
    if (car === null) return err("NOT_FOUND");
    const cause = causeFor(car.status, input.to);
    if (cause === null) return err("ILLEGAL_TRANSITION");
    const reason = cause === "start_care" ? careReasonOf(input.careReason) : null;
    if (cause === "start_care" && reason === null) return err("INVALID_INPUT");
    const rentals = await tx.listRentals(id);
    const move = checkCarMove(car.status, input.to, {
      role: actor.role,
      cause,
      hasOpenRental: hasOpenRental(rentals, now),
      hasOpenSaleReservation: false,
      hasMinAge: car.minAge !== null,
      ageBandCount: car.ageBands.length,
      listing: {
        ownersCount: car.ownersCount,
        knownAccidents: car.knownAccidents,
        accidentsNone: car.accidentsNone,
        conditionGrade: car.conditionGrade,
        salePriceAgorot: car.salePriceAgorot === null ? null : storedAgorot(car.salePriceAgorot),
        photoCount: car.photos.length,
      },
    });
    if (!move.ok) return move;
    await tx.updateCar({
      ...toCarWrite(car),
      status: input.to,
      careReason: reason,
    });
    const updated = await tx.findCar(id);
    if (updated === null) throw new Error("Car missing after status change");
    const tags = await tx.listTags();
    return ok(presentCar(updated, tags, rentals, now));
  });
}
