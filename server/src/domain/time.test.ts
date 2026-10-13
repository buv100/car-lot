import { describe, expect, it } from "vitest";

import {
  ageMatchesSearch,
  ageOn,
  instantInJerusalem,
  jerusalemDate,
  rentalDurationHours,
} from "./time.js";
import { expectErr, expectOk } from "./testing.js";

describe("Jerusalem time and age", () => {
  it("reads the calendar date in Asia/Jerusalem, not the host zone", () => {
    const instant = new Date("2026-10-07T21:30:00.000Z");
    expect(jerusalemDate(instant)).toEqual({ year: 2026, month: 10, day: 8, weekday: 4 });
  });

  it("builds instants for Israel daylight and winter offsets", () => {
    expect(instantInJerusalem(2026, 10, 8, 10, 0).toISOString()).toBe("2026-10-08T07:00:00.000Z");
    expect(instantInJerusalem(2026, 1, 8, 10, 0).toISOString()).toBe("2026-01-08T08:00:00.000Z");
    expect(jerusalemDate(instantInJerusalem(2026, 10, 8, 0, 0))).toMatchObject({
      year: 2026,
      month: 10,
      day: 8,
      weekday: 4,
    });
  });

  it("counts the birthday itself, and a missing Feb 29 on the last day of February", () => {
    expect(ageOn({ year: 2000, month: 10, day: 8 }, { year: 2026, month: 10, day: 8 })).toBe(26);
    expect(ageOn({ year: 2000, month: 10, day: 8 }, { year: 2026, month: 10, day: 7 })).toBe(25);
    expect(ageOn({ year: 2004, month: 2, day: 29 }, { year: 2027, month: 2, day: 28 })).toBe(23);
    expect(ageOn({ year: 2004, month: 2, day: 29 }, { year: 2027, month: 2, day: 27 })).toBe(22);
    expect(ageOn({ year: 2004, month: 2, day: 29 }, { year: 2028, month: 2, day: 29 })).toBe(24);
    expect(ageOn({ year: 2004, month: 2, day: 29 }, { year: 2028, month: 2, day: 28 })).toBe(23);
  });

  it("matches search age only to the age on the pickup date", () => {
    const birth = { year: 2000, month: 10, day: 8 };
    const pickup = { year: 2026, month: 10, day: 8 };
    expect(ageMatchesSearch(26, birth, pickup)).toBe(true);
    expect(ageMatchesSearch(25, birth, pickup)).toBe(false);
  });

  it("requires 24 hours and a 60 minute lead", () => {
    const pickup = instantInJerusalem(2026, 10, 8, 10, 0);
    const dayLater = instantInJerusalem(2026, 10, 9, 10, 0);
    const almostDay = new Date(dayLater.getTime() - 1);
    const onTime = new Date(pickup.getTime() - 60 * 60 * 1000);
    const tooSoon = new Date(onTime.getTime() + 1);

    expect(expectOk(rentalDurationHours(pickup, dayLater, onTime))).toBe(24);
    expectErr(rentalDurationHours(pickup, almostDay, onTime), "RENTAL_TOO_SHORT");
    expectErr(rentalDurationHours(pickup, dayLater, tooSoon), "PICKUP_TOO_SOON");
  });
});
