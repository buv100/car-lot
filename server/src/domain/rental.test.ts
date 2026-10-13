import { describe, expect, it } from "vitest";

import { agorot, agorotFromRounded } from "./money.js";
import type { AgeBand } from "./age-bands.js";
import { dayKind, quoteRental, splitRental, type QuoteRentalInput } from "./rental.js";
import { HOUR_MS, instantInJerusalem } from "./time.js";
import { expectErr, expectOk } from "./testing.js";

const band: AgeBand = {
  minAge: 21,
  maxAge: null,
  weekdayDailyAgorot: agorot(240),
  weekendDailyAgorot: agorot(360),
  holidayDailyAgorot: agorot(480),
};

function quote(overrides: Partial<QuoteRentalInput> = {}) {
  const input: QuoteRentalInput = {
    pickupAt: instantInJerusalem(2026, 10, 8, 10, 0),
    returnAt: instantInJerusalem(2026, 10, 10, 15, 0),
    now: instantInJerusalem(2026, 10, 8, 8, 0),
    ageAtPickup: 30,
    minAge: 21,
    bands: [band],
    holidays: [],
    insuranceDailyAgorot: agorot(0),
    kmPerDay: 250,
    returnMode: "lot",
    straightLineKm: 12,
    ...overrides,
  };
  return quoteRental(input);
}

describe("rental price", () => {
  it("acceptance 4: Thursday 10:00 to Saturday 15:00 is exactly 675 shekel", () => {
    const priced = expectOk(quote());
    const pickup = instantInJerusalem(2026, 10, 8, 10, 0);

    expect(priced.totalHours).toBe(53);
    expect(priced.lines).toEqual([
      {
        start: pickup,
        hours: 24,
        dayKind: "weekday",
        agorot: agorot(240),
      },
      {
        start: new Date(pickup.getTime() + 24 * HOUR_MS),
        hours: 24,
        dayKind: "weekend",
        agorot: agorot(360),
      },
      {
        start: new Date(pickup.getTime() + 48 * HOUR_MS),
        hours: 5,
        dayKind: "weekend",
        agorot: agorot(75),
      },
    ]);
    expect(priced.rentalAgorot).toBe(agorot(675));
    expect(priced.insuranceAgorot).toBe(0);
    expect(priced.deliveryFeeAgorot).toBe(0);
    expect(priced.straightLineKm).toBe(0);
    expect(priced.billedKm).toBe(0);
    expect(priced.totalAgorot).toBe(agorot(675));
    expect(priced.kmAllowance).toBe(552);
  });

  it("prices a holiday only on segments that start that Jerusalem date", () => {
    const saturdayHoliday = expectOk(quote({ holidays: ["2026-10-10"] }));
    expect(saturdayHoliday.lines.map((line) => line.dayKind)).toEqual([
      "weekday",
      "weekend",
      "holiday",
    ]);
    expect(saturdayHoliday.lines[2]?.agorot).toBe(agorot(100));
    expect(saturdayHoliday.rentalAgorot).toBe(agorot(700));

    const fridayHoliday = expectOk(quote({ holidays: ["2026-10-09"] }));
    expect(fridayHoliday.lines.map((line) => line.dayKind)).toEqual([
      "weekday",
      "holiday",
      "weekend",
    ]);
    expect(fridayHoliday.lines[1]?.agorot).toBe(agorot(480));
    expect(fridayHoliday.lines[2]?.agorot).toBe(agorot(75));
    expect(fridayHoliday.rentalAgorot).toBe(agorot(795));
  });

  it("keeps a Thursday 22:00 segment on the weekday rate", () => {
    const priced = expectOk(
      quote({
        pickupAt: instantInJerusalem(2026, 10, 8, 22, 0),
        returnAt: instantInJerusalem(2026, 10, 9, 22, 0),
      }),
    );
    expect(priced.lines).toHaveLength(1);
    expect(priced.lines[0]?.dayKind).toBe("weekday");
    expect(priced.rentalAgorot).toBe(agorot(240));
    expect(dayKind(instantInJerusalem(2026, 10, 11, 10, 0), new Set())).toBe("weekday");
  });

  it("does not add a zero-length remainder", () => {
    const pickup = instantInJerusalem(2026, 10, 8, 10, 0);
    const segments = splitRental(pickup, new Date(pickup.getTime() + 48 * HOUR_MS));
    expect(segments.map((segment) => segment.hours)).toEqual([24, 24]);
  });

  it("rounds a fractional segment, insurance, and the kilometre allowance half up", () => {
    const cheap: AgeBand = {
      minAge: 21,
      maxAge: null,
      weekdayDailyAgorot: agorotFromRounded(1),
      weekendDailyAgorot: agorotFromRounded(1),
      holidayDailyAgorot: agorotFromRounded(1),
    };
    const priced = expectOk(
      quote({
        pickupAt: instantInJerusalem(2026, 10, 11, 10, 0),
        returnAt: instantInJerusalem(2026, 10, 12, 22, 0),
        now: instantInJerusalem(2026, 10, 11, 8, 0),
        bands: [cheap],
        insuranceDailyAgorot: agorotFromRounded(1),
        kmPerDay: 1,
      }),
    );
    expect(priced.totalHours).toBe(36);
    expect(priced.lines.map((line) => line.agorot)).toEqual([1, 1]);
    expect(priced.insuranceAgorot).toBe(2);
    expect(priced.kmAllowance).toBe(2);
  });

  it("adds one insurance package and the address delivery tier", () => {
    const priced = expectOk(
      quote({
        insuranceDailyAgorot: agorot(10),
        returnMode: "address",
        straightLineKm: 10,
      }),
    );
    expect(priced.insuranceAgorot).toBe(2208);
    expect(priced.billedKm).toBe(11);
    expect(priced.straightLineKm).toBe(10);
    expect(priced.deliveryFeeAgorot).toBe(agorot(120));
    expect(priced.totalAgorot).toBe(67500 + 2208 + 12000);
  });

  it("stops a short rental, an early pickup, a far address, and an age that is not offered", () => {
    expectErr(quote({ returnAt: instantInJerusalem(2026, 10, 9, 9, 0) }), "RENTAL_TOO_SHORT");
    expectErr(quote({ now: instantInJerusalem(2026, 10, 8, 9, 30) }), "PICKUP_TOO_SOON");
    expectErr(quote({ returnMode: "address", straightLineKm: 100 }), "TOO_FAR");
    expectErr(quote({ ageAtPickup: 20 }), "AGE_NOT_OFFERED");
  });

  it("uses the band that contains the pickup age and rejects a gap or an overlap", () => {
    const young: AgeBand = { ...band, minAge: 21, maxAge: 24 };
    const older: AgeBand = { ...band, minAge: 25, maxAge: 40, weekdayDailyAgorot: agorot(100) };
    const weekdayOnly = expectOk(
      quote({
        pickupAt: instantInJerusalem(2026, 10, 11, 10, 0),
        returnAt: instantInJerusalem(2026, 10, 12, 10, 0),
        now: instantInJerusalem(2026, 10, 11, 8, 0),
        ageAtPickup: 25,
        bands: [older, young],
      }),
    );
    expect(weekdayOnly.rentalAgorot).toBe(agorot(100));

    const gapped: AgeBand = { ...band, minAge: 30, maxAge: 40 };
    const low: AgeBand = { ...band, minAge: 21, maxAge: 23 };
    expectErr(quote({ ageAtPickup: 25, bands: [low, gapped] }), "AGE_NOT_OFFERED");

    const covering: AgeBand = { ...band, minAge: 21, maxAge: 40 };
    const inner: AgeBand = { ...band, minAge: 25, maxAge: 30 };
    expectErr(quote({ bands: [covering, inner] }), "BANDS_OVERLAP");
  });
});
