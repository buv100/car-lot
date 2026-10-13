import { describe, expect, it } from "vitest";

import {
  refundAgorot,
  refundPercent,
  yardRefundAgorot,
  YARD_REFUND_PERCENT,
} from "./cancellation.js";
import { agorot, agorotFromRounded } from "./money.js";
import { HOUR_MS, instantInJerusalem } from "./time.js";

describe("cancellation", () => {
  it.each([
    [48.01, 100],
    [48, 50],
    [47, 50],
    [24, 50],
    [23.99, 25],
    [18, 25],
    [17.99, 10],
    [12, 10],
    [11.99, 0],
    [0, 0],
    [-2, 0],
  ] as const)("refundPercent(%s) is %s", (hours, percent) => {
    expect(refundPercent(hours)).toBe(percent);
  });

  it("acceptance 10: 47 hours refunds 50 percent, and the yard always refunds 100", () => {
    const pickup = instantInJerusalem(2026, 10, 8, 10, 0);
    const cancelAt = new Date(pickup.getTime() - 47 * HOUR_MS);
    const hours = (pickup.getTime() - cancelAt.getTime()) / HOUR_MS;
    const paid = agorot(675);

    expect(refundPercent(hours)).toBe(50);
    expect(refundAgorot(paid, refundPercent(hours))).toBe(33_750);
    expect(YARD_REFUND_PERCENT).toBe(100);
    expect(yardRefundAgorot(paid)).toBe(paid);
    expect(refundAgorot(agorotFromRounded(1), 50)).toBe(1);
  });
});
