import { returnCharges } from "./charges.js";
import type { Agorot } from "./money.js";
import { err, ok, type Result } from "./result.js";

/** Keep the saved bands, or replace them before the checklist can close. */
export type PriceDecision = "keep" | "update";

export type ChecklistDamageInput = {
  readonly description: string;
  readonly estimatedAgorot: Agorot;
  readonly photoCount: number;
};

export type ChecklistInput = {
  readonly noShow: boolean;
  readonly startKm: number;
  readonly endKm: number | null;
  readonly fuelLitersShort: number | null;
  readonly damages: readonly ChecklistDamageInput[];
  readonly washNeeded: boolean;
  readonly washDone: boolean;
  readonly treatmentNeeded: boolean;
  readonly treatmentDone: boolean;
  readonly returnPhotoCount: number;
  readonly priceDecision: PriceDecision | null;
  /** True only when new age bands were already validated for an update. */
  readonly priceUpdated: boolean;
  readonly allowanceKm: number;
  readonly excessKmPriceAgorot: Agorot;
  readonly fuelPricePerLiterAgorot: Agorot;
};

export type CompletedChecklist = {
  readonly endKm: number;
  readonly fuelLitersShort: number;
  readonly kmExcess: number;
  readonly kmChargeAgorot: Agorot;
  readonly fuelChargeAgorot: Agorot;
  readonly nextStatus: "completed" | "cancelled";
  /** A no-show records the same kilometres and does not move the car. */
  readonly updateCarKm: boolean;
};

function wholeKm(value: number): boolean {
  return Number.isInteger(value) && value >= 0;
}

function fuelOk(liters: number): boolean {
  if (!Number.isFinite(liters) || liters < 0) return false;
  const tenths = Math.round(liters * 10);
  return Math.abs(liters * 10 - tenths) <= 1e-6;
}

function damageOk(damage: ChecklistDamageInput): boolean {
  return (
    damage.description.trim().length > 0 &&
    Number.isInteger(damage.estimatedAgorot) &&
    damage.estimatedAgorot >= 0 &&
    Number.isInteger(damage.photoCount) &&
    damage.photoCount >= 0
  );
}

/**
 * Closes a checklist only when kilometres, fuel, price, and any marked wash or
 * treatment are present. Return photos and damage photos are optional.
 * Charges are stored and are not sent to the card.
 */
export function assessChecklist(input: ChecklistInput): Result<CompletedChecklist> {
  if (!wholeKm(input.startKm)) return err("CHECKLIST_INCOMPLETE");
  if (
    input.endKm === null ||
    input.fuelLitersShort === null ||
    input.priceDecision === null ||
    !wholeKm(input.endKm) ||
    !fuelOk(input.fuelLitersShort)
  ) {
    return err("CHECKLIST_INCOMPLETE");
  }
  if (input.washNeeded && !input.washDone) return err("CHECKLIST_INCOMPLETE");
  if (input.treatmentNeeded && !input.treatmentDone) return err("CHECKLIST_INCOMPLETE");
  if (input.priceDecision === "update" && !input.priceUpdated) return err("CHECKLIST_INCOMPLETE");
  if (input.damages.some((damage) => !damageOk(damage))) return err("CHECKLIST_INCOMPLETE");

  if (input.noShow) {
    if (input.endKm < input.startKm) return err("END_KM_BEFORE_START");
    // A no-show never left the lot, so the end reading stays on the start reading.
    if (input.endKm !== input.startKm || input.fuelLitersShort !== 0) {
      return err("CHECKLIST_INCOMPLETE");
    }
  }

  const charges = returnCharges({
    startKm: input.startKm,
    endKm: input.endKm,
    allowanceKm: input.allowanceKm,
    excessKmPriceAgorot: input.excessKmPriceAgorot,
    fuelLitersShort: input.fuelLitersShort,
    fuelPricePerLiterAgorot: input.fuelPricePerLiterAgorot,
  });
  if (!charges.ok) return charges;
  // A normal return has to move the odometer. Equality is only valid for a no-show.
  if (!input.noShow && charges.value.drivenKm === 0) return err("CHECKLIST_INCOMPLETE");

  return ok({
    endKm: input.endKm,
    fuelLitersShort: input.fuelLitersShort,
    kmExcess: charges.value.excessKm,
    kmChargeAgorot: charges.value.kmChargeAgorot,
    fuelChargeAgorot: charges.value.fuelChargeAgorot,
    nextStatus: input.noShow ? "cancelled" : "completed",
    updateCarKm: !input.noShow,
  });
}
