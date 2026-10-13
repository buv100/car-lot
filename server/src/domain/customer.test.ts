import { describe, expect, it } from "vitest";

import { normalizePhone } from "./customer.js";

describe("israeli mobile numbers", () => {
  it("keeps separators out of the stored number", () => {
    expect(normalizePhone("050-123-4567")).toBe("+972501234567");
    expect(normalizePhone("+972 50 123 4567")).toBe("+972501234567");
  });

  it("rejects a landline", () => {
    expect(normalizePhone("03-5551234")).toBeNull();
  });
});
