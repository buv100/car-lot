import { storedAgorot, type Agorot } from "../domain/money.js";
import { err, ok, type Result } from "../domain/result.js";
import { CONDITION_GRADES, type ConditionGrade } from "../domain/sale.js";
import { checkCarMove } from "../domain/transitions.js";
import type { StaffStore } from "../repositories/staff-store.js";
import { presentCar, toCarWrite, type StaffCarView } from "./car-view.js";
import { hasOpenRental, hasOpenSale } from "./holds.js";
import { requirePermission } from "./login-staff.js";
import type { StaffActor } from "./staff-actor.js";

export type DeepTreatmentInput = {
  readonly ownersCount: number | null;
  readonly knownAccidents: string | null;
  readonly accidentsNone: boolean;
  readonly conditionGrade: ConditionGrade | null;
  readonly salePriceAgorot: Agorot | null;
  readonly completedAt: Date | null;
};

function gradeOf(value: string | null): ConditionGrade | null {
  if (value === null) return null;
  for (const grade of CONDITION_GRADES) {
    if (grade === value) return grade;
  }
  return null;
}

/** Finishes deep treatment and moves the car to the sale catalog when the listing is complete. */
export async function completeDeepTreatment(
  store: StaffStore,
  actor: StaffActor,
  carId: string,
  input: DeepTreatmentInput,
  now: Date,
): Promise<Result<StaffCarView>> {
  const allowed = requirePermission(actor.role, "cars.status");
  if (!allowed.ok) return allowed;
  if (input.completedAt === null || Number.isNaN(input.completedAt.getTime())) {
    return err("SALE_NOT_READY");
  }
  const grade = gradeOf(input.conditionGrade);
  return store.transaction(async (tx) => {
    const car = await tx.findCar(carId);
    if (car === null) return err("NOT_FOUND");
    const rentals = await tx.listRentals(carId);
    const sales = await tx.listSaleOrders();
    const move = checkCarMove(car.status, "for_sale", {
      role: actor.role,
      cause: "complete_deep_treatment",
      hasOpenRental: hasOpenRental(rentals, now),
      hasOpenSaleReservation: hasOpenSale(
        sales
          .filter((sale) => sale.carId === carId)
          .map((sale) => ({ status: sale.status, holdExpiresAt: sale.holdExpiresAt })),
        now,
      ),
      hasMinAge: car.minAge !== null,
      ageBandCount: car.ageBands.length,
      listing: {
        ownersCount: input.ownersCount,
        knownAccidents: input.knownAccidents,
        accidentsNone: input.accidentsNone,
        conditionGrade: grade,
        salePriceAgorot: input.salePriceAgorot,
        photoCount: car.photos.length,
      },
    });
    if (!move.ok) return move;
    await tx.updateCar({
      ...toCarWrite(car),
      status: "for_sale",
      careReason: null,
      ownersCount: input.ownersCount,
      knownAccidents: input.accidentsNone ? null : input.knownAccidents,
      accidentsNone: input.accidentsNone,
      conditionGrade: grade,
      salePriceAgorot: input.salePriceAgorot,
      deepTreatmentCompletedAt: input.completedAt,
    });
    const updated = await tx.findCar(carId);
    if (updated === null) throw new Error("Car missing after deep treatment");
    const tags = await tx.listTags();
    return ok(presentCar(updated, tags, rentals, now));
  });
}

/** Whole shekels from the form. A missing or fractional price is not ready for sale. */
export function salePriceOrNull(wholeShekels: number | null): Agorot | null {
  if (wholeShekels === null || !Number.isInteger(wholeShekels) || wholeShekels <= 0) return null;
  return storedAgorot(wholeShekels * 100);
}
