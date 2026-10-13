import { describe, expect, it } from "vitest";

import { joinMinute, monthCells, pickRentalDay, shorterThanDay } from "./rental-dates";

describe("rental date range", () => {
  it("keeps pickup and return on one calendar", () => {
    const first = pickRentalDay("", "", "2026-10-12", "10:00", "18:00");
    expect(first).toEqual({ pickup: "2026-10-12T10:00", returnAt: "" });
    const second = pickRentalDay(first.pickup, first.returnAt, "2026-10-15", "10:00", "18:00");
    expect(second).toEqual({ pickup: "2026-10-12T10:00", returnAt: "2026-10-15T18:00" });
    const restart = pickRentalDay(second.pickup, second.returnAt, "2026-11-01", "10:00", "18:00");
    expect(restart).toEqual({ pickup: "2026-11-01T10:00", returnAt: "" });
    const earlier = pickRentalDay(restart.pickup, restart.returnAt, "2026-10-20", "10:00", "18:00");
    expect(earlier.pickup).toBe("2026-10-20T10:00");
    expect(earlier.returnAt).toBe("");
  });

  it("builds a stable Sunday-first month", () => {
    const cells = monthCells(2026, 9);
    expect(cells).toHaveLength(42);
    expect(cells[4]).toEqual({ day: "2026-10-01", inMonth: true });
    expect(cells[0]?.inMonth).toBe(false);
  });

  it("flags a range shorter than a day", () => {
    expect(shorterThanDay("2026-10-12T10:00", "2026-10-13T09:00")).toBe(true);
    expect(shorterThanDay("2026-10-12T10:00", "2026-10-13T10:00")).toBe(false);
    expect(joinMinute("nope", "10:00")).toBe("");
  });
});
