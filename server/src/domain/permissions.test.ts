import { describe, expect, it } from "vitest";

import { PERMISSIONS, can, type Permission } from "./permissions.js";

const YARD_DENIED: readonly Permission[] = [
  "sales.refund",
  "sales.early_move",
  "customers.block",
  "settings.write",
  "staff.write",
];

describe("permissions", () => {
  it("acceptance 16: a yard employee is denied block, settings, deposit refund, and early sale", () => {
    expect(can("yard", "customers.block")).toBe(false);
    expect(can("yard", "settings.write")).toBe(false);
    expect(can("yard", "sales.refund")).toBe(false);
    expect(can("yard", "sales.early_move")).toBe(false);
    expect(can("manager", "customers.block")).toBe(true);
    expect(can("manager", "settings.write")).toBe(true);
    expect(can("manager", "sales.refund")).toBe(true);
    expect(can("manager", "sales.early_move")).toBe(true);
  });

  it("maps every spec key and no others", () => {
    expect(PERMISSIONS).toHaveLength(14);
    for (const key of PERMISSIONS) {
      expect(can("manager", key)).toBe(true);
      expect(can("yard", key)).toBe(!YARD_DENIED.includes(key));
    }
  });
});
