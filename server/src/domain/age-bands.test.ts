import { describe, it } from "vitest";

import { agorot, type Agorot } from "./money.js";
import { validateAgeBands, type AgeBand } from "./age-bands.js";
import { expectErr, expectOk } from "./testing.js";

function band(minAge: number, maxAge: number | null, price = agorot(100)): AgeBand {
  return {
    minAge,
    maxAge,
    weekdayDailyAgorot: price,
    weekendDailyAgorot: price,
    holidayDailyAgorot: price,
  };
}

describe("age bands", () => {
  it("allows a gap and an open-ended top band", () => {
    expectOk(validateAgeBands(21, [band(30, 40), band(21, 24), band(41, null)]));
  });

  it("requires the lowest band to start at the car minimum age", () => {
    expectErr(validateAgeBands(21, [band(24, 30)]), "BANDS_INVALID");
    expectErr(validateAgeBands(21, []), "BANDS_INVALID");
  });

  it("rejects an overlap, including a shared endpoint", () => {
    expectErr(validateAgeBands(21, [band(21, 25), band(25, 30)]), "BANDS_OVERLAP");
    expectErr(validateAgeBands(21, [band(21, null), band(30, 40)]), "BANDS_OVERLAP");
  });

  it("rejects a negative price or a maximum below the minimum", () => {
    // Bypasses agorot() on purpose so a negative stored price is rejected.
    const negative = -100 as Agorot;
    expectErr(validateAgeBands(21, [band(21, null, negative)]), "BANDS_INVALID");
    expectErr(validateAgeBands(21, [band(21, 20)]), "BANDS_INVALID");
  });
});
