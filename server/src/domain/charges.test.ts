import { describe, expect, it } from "vitest";

import { returnCharges } from "./charges.js";
import { agorot, agorotFromRounded } from "./money.js";
import { expectErr, expectOk } from "./testing.js";

describe("return charges", () => {
  it("bills kilometres over the saved allowance and short fuel, without collecting them here", () => {
    const charges = expectOk(
      returnCharges({
        startKm: 1000,
        endKm: 1600,
        allowanceKm: 552,
        excessKmPriceAgorot: agorot(2),
        fuelLitersShort: 1.5,
        fuelPricePerLiterAgorot: agorot(8),
      }),
    );
    expect(charges).toEqual({
      drivenKm: 600,
      excessKm: 48,
      kmChargeAgorot: 9600,
      fuelChargeAgorot: 1200,
    });
  });

  it("treats a no-show as zero distance and rounds half an agora of fuel up", () => {
    const charges = expectOk(
      returnCharges({
        startKm: 400,
        endKm: 400,
        allowanceKm: 250,
        excessKmPriceAgorot: agorot(2),
        fuelLitersShort: 0.5,
        fuelPricePerLiterAgorot: agorotFromRounded(1),
      }),
    );
    expect(charges.drivenKm).toBe(0);
    expect(charges.excessKm).toBe(0);
    expect(charges.fuelChargeAgorot).toBe(1);
  });

  it("rejects an ending kilometre below the start", () => {
    expectErr(
      returnCharges({
        startKm: 10,
        endKm: 9,
        allowanceKm: 0,
        excessKmPriceAgorot: agorot(2),
        fuelLitersShort: 0,
        fuelPricePerLiterAgorot: agorot(8),
      }),
      "END_KM_BEFORE_START",
    );
  });
});
