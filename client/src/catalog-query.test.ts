import { describe, expect, it } from "vitest";

import { readRentSearch, readSaleSearch, saleSearchParams } from "./catalog-query";

describe("catalog search params", () => {
  it("does not accept a rental search that is missing a field", () => {
    expect(
      readRentSearch(
        new URLSearchParams({
          pickup: "2026-10-09T14:00",
          returnAt: "2026-10-10T14:00",
          primaryType: "mini",
          returnMode: "lot",
        }),
      ),
    ).toBeNull();
    expect(
      readRentSearch(
        new URLSearchParams({
          pickup: "2026-10-09T14:00",
          returnAt: "2026-10-10T14:00",
          age: "30",
          primaryType: "mini",
          returnMode: "address",
        }),
      ),
    ).toBeNull();
  });

  it("accepts a rental search with every car type", () => {
    expect(
      readRentSearch(
        new URLSearchParams({
          pickup: "2026-10-09T14:00",
          returnAt: "2026-10-10T14:00",
          age: "30",
          returnMode: "lot",
        }),
      )?.primaryType,
    ).toBe("");
  });

  it("accepts a sale search with every car type", () => {
    expect(
      readSaleSearch(new URLSearchParams({ maxKm: "80000", condition: "any" }))?.primaryType,
    ).toBe("");
  });

  it("keeps a kilometre limit when condition was left blank", () => {
    const search = readSaleSearch(
      saleSearchParams({ maxKm: "10000", condition: "", primaryType: "" }),
    );
    expect(search).toEqual({
      maxKm: "10000",
      condition: "any",
      primaryType: "",
      tagId: "",
    });
  });

  it("does not accept a sale search that is missing a field", () => {
    expect(
      readSaleSearch(new URLSearchParams({ condition: "good", primaryType: "family" })),
    ).toBeNull();
    expect(
      readSaleSearch(new URLSearchParams({ maxKm: "0", condition: "any", primaryType: "family" })),
    ).toBeNull();
  });
});
