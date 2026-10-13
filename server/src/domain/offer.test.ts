import { describe, expect, it } from "vitest";

import { canOfferForRent, canOfferForSale } from "./offer.js";

const now = new Date("2026-10-08T07:00:00.000Z");

describe("offerability", () => {
  it("acceptance 3: an open rental hides the car with no date window", () => {
    expect(canOfferForRent({ status: "available", rentals: [], now })).toBe(true);
    expect(
      canOfferForRent({
        status: "available",
        rentals: [{ status: "confirmed", holdExpiresAt: null }],
        now,
      }),
    ).toBe(false);
    expect(
      canOfferForRent({
        status: "available",
        rentals: [{ status: "checklist", holdExpiresAt: null }],
        now,
      }),
    ).toBe(false);
    expect(
      canOfferForRent({
        status: "available",
        rentals: [{ status: "active", holdExpiresAt: null }],
        now,
      }),
    ).toBe(false);
    expect(
      canOfferForRent({
        status: "available",
        rentals: [
          { status: "completed", holdExpiresAt: null },
          { status: "cancelled", holdExpiresAt: null },
        ],
        now,
      }),
    ).toBe(true);
    expect(canOfferForRent({ status: "in_care", rentals: [], now })).toBe(false);
  });

  it("treats an unexpired hold as open and an elapsed hold as free", () => {
    const later = new Date(now.getTime() + 1);
    const earlier = new Date(now.getTime() - 1);
    expect(
      canOfferForRent({
        status: "available",
        rentals: [{ status: "pending_payment", holdExpiresAt: later }],
        now,
      }),
    ).toBe(false);
    expect(
      canOfferForRent({
        status: "available",
        rentals: [{ status: "pending_payment", holdExpiresAt: now }],
        now,
      }),
    ).toBe(true);
    expect(
      canOfferForRent({
        status: "available",
        rentals: [{ status: "pending_payment", holdExpiresAt: earlier }],
        now,
      }),
    ).toBe(true);
    expect(
      canOfferForRent({
        status: "available",
        rentals: [{ status: "pending_payment", holdExpiresAt: null }],
        now,
      }),
    ).toBe(false);
  });

  it("offers a sale only while for_sale and without a live hold or reservation", () => {
    expect(canOfferForSale({ status: "for_sale", sales: [], now })).toBe(true);
    expect(canOfferForSale({ status: "available", sales: [], now })).toBe(false);
    expect(
      canOfferForSale({
        status: "for_sale",
        sales: [{ status: "reserved", holdExpiresAt: null }],
        now,
      }),
    ).toBe(false);
    expect(
      canOfferForSale({
        status: "for_sale",
        sales: [{ status: "pending_payment", holdExpiresAt: new Date(now.getTime() + 1) }],
        now,
      }),
    ).toBe(false);
    expect(
      canOfferForSale({
        status: "for_sale",
        sales: [{ status: "pending_payment", holdExpiresAt: now }],
        now,
      }),
    ).toBe(true);
    expect(
      canOfferForSale({
        status: "for_sale",
        sales: [{ status: "cancelled", holdExpiresAt: null }],
        now,
      }),
    ).toBe(true);
  });
});
