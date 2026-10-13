import { type Agorot, agorotFromRounded } from "./money.js";
import { err, ok, type Result } from "./result.js";

/** Km and fuel amounts recorded at return. The site stores them and does not charge the card. */
export type ReturnCharges = {
  readonly drivenKm: number;
  readonly excessKm: number;
  readonly kmChargeAgorot: Agorot;
  readonly fuelChargeAgorot: Agorot;
};

function litersToTenths(liters: number): number {
  if (!Number.isFinite(liters) || liters < 0) {
    throw new Error("Fuel liters short must be a non-negative finite number");
  }
  const tenths = Math.round(liters * 10);
  if (Math.abs(liters * 10 - tenths) > 1e-6) {
    throw new Error("Fuel liters short must have at most one decimal place");
  }
  return tenths;
}

/** Excess km and missing fuel. End km below the start km is rejected. */
export function returnCharges(input: {
  readonly startKm: number;
  readonly endKm: number;
  readonly allowanceKm: number;
  readonly excessKmPriceAgorot: Agorot;
  readonly fuelLitersShort: number;
  readonly fuelPricePerLiterAgorot: Agorot;
}): Result<ReturnCharges> {
  if (
    !Number.isInteger(input.startKm) ||
    !Number.isInteger(input.endKm) ||
    input.startKm < 0 ||
    input.endKm < 0
  ) {
    throw new Error("Kilometres must be non-negative integers");
  }
  if (!Number.isInteger(input.allowanceKm) || input.allowanceKm < 0) {
    throw new Error("Allowance must be a non-negative integer");
  }
  if (input.endKm < input.startKm) return err("END_KM_BEFORE_START");
  const drivenKm = input.endKm - input.startKm;
  const excessKm = Math.max(0, drivenKm - input.allowanceKm);
  const tenths = litersToTenths(input.fuelLitersShort);
  return ok({
    drivenKm,
    excessKm,
    kmChargeAgorot: agorotFromRounded(excessKm * input.excessKmPriceAgorot),
    fuelChargeAgorot: agorotFromRounded((tenths * input.fuelPricePerLiterAgorot) / 10),
  });
}
