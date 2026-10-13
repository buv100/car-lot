import { describe, expect, it } from "vitest";

import { agorot, agorotFromRounded } from "./money.js";

describe("money", () => {
  it("stores whole shekels as agorot", () => {
    expect(agorot(240)).toBe(24_000);
    expect(agorot(0)).toBe(0);
  });

  it("rejects fractional or negative shekels", () => {
    expect(() => agorot(1.5)).toThrow();
    expect(() => agorot(-1)).toThrow();
  });

  it("rounds half an agora up", () => {
    expect(agorotFromRounded(0.5)).toBe(1);
    expect(agorotFromRounded(1.5)).toBe(2);
    expect(agorotFromRounded(1.4)).toBe(1);
  });
});
