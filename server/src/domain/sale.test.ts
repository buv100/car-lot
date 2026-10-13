import { describe, expect, it } from "vitest";

import { agorot, agorotFromRounded } from "./money.js";
import {
  depositAgorot,
  saleAlertDue,
  isSaleListingReady,
  saleThresholdReached,
  type SaleListing,
} from "./sale.js";

const purchased = { year: 2024, month: 2, day: 29 };
const youngPurchase = { year: 2026, month: 10, day: 8 };

function listing(overrides: Partial<SaleListing> = {}): SaleListing {
  return {
    ownersCount: 2,
    knownAccidents: null,
    accidentsNone: true,
    conditionGrade: "good",
    salePriceAgorot: agorot(40000),
    photoCount: 4,
    ...overrides,
  };
}

describe("sale threshold and deposit", () => {
  it("acceptance 13: 100000 km or three calendar years, without a new status", () => {
    expect(saleThresholdReached(youngPurchase, 100_000, youngPurchase)).toBe(true);
    expect(saleThresholdReached(youngPurchase, 99_999, youngPurchase)).toBe(false);
    expect(saleThresholdReached(purchased, 0, { year: 2027, month: 2, day: 27 })).toBe(false);
    expect(saleThresholdReached(purchased, 0, { year: 2027, month: 2, day: 28 })).toBe(true);
    expect(
      saleThresholdReached({ year: 2023, month: 10, day: 8 }, 10, {
        year: 2026,
        month: 10,
        day: 7,
      }),
    ).toBe(false);
    expect(
      saleThresholdReached({ year: 2023, month: 10, day: 8 }, 10, {
        year: 2026,
        month: 10,
        day: 8,
      }),
    ).toBe(true);

    expect(saleAlertDue("available", youngPurchase, 100_000, youngPurchase)).toBe(true);
    expect(saleAlertDue("preparing", purchased, 0, { year: 2027, month: 2, day: 28 })).toBe(true);
    expect(saleAlertDue("in_care", youngPurchase, 100_000, youngPurchase)).toBe(true);
    expect(saleAlertDue("for_sale", youngPurchase, 100_000, youngPurchase)).toBe(false);
    expect(saleAlertDue("deep_treatment", youngPurchase, 100_000, youngPurchase)).toBe(false);
    expect(saleAlertDue("sold", purchased, 200_000, { year: 2030, month: 1, day: 1 })).toBe(false);
  });

  it("rounds a 10 percent deposit half an agora up", () => {
    expect(depositAgorot(agorot(1000))).toBe(agorot(100));
    expect(depositAgorot(agorotFromRounded(15))).toBe(2);
    expect(depositAgorot(agorotFromRounded(105))).toBe(11);
  });

  it("requires hand, accidents, grade, price, and four photos before sale", () => {
    expect(isSaleListingReady(listing())).toBe(true);
    expect(
      isSaleListingReady(listing({ knownAccidents: "front panel", accidentsNone: false })),
    ).toBe(true);
    expect(isSaleListingReady(listing({ ownersCount: null }))).toBe(false);
    expect(isSaleListingReady(listing({ accidentsNone: false, knownAccidents: "  " }))).toBe(false);
    expect(isSaleListingReady(listing({ conditionGrade: null }))).toBe(false);
    expect(isSaleListingReady(listing({ salePriceAgorot: agorot(0) }))).toBe(false);
    expect(isSaleListingReady(listing({ photoCount: 3 }))).toBe(false);
  });
});
