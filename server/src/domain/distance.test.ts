import { describe, expect, it } from "vitest";

import { bufferKm, deliveryFeeAgorot, haversineKm } from "./distance.js";
import { agorot } from "./money.js";
import { expectErr, expectOk } from "./testing.js";

describe("return distance", () => {
  it("uses a 6371 km earth and bills 1.1 times the straight line", () => {
    expect(haversineKm({ latitude: 32, longitude: 34 }, { latitude: 32, longitude: 34 })).toBe(0);
    expect(haversineKm({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 1 })).toBeCloseTo(
      (6371 * Math.PI) / 180,
      6,
    );
    expect(bufferKm(10)).toBe(11);
  });

  it("acceptance 5: 5.0 is 60, 5.1 is 120, 30 is 200, and 30.1 is blocked", () => {
    expect(expectOk(deliveryFeeAgorot("address", 0))).toBe(agorot(60));
    expect(expectOk(deliveryFeeAgorot("address", 5))).toBe(agorot(60));
    expect(expectOk(deliveryFeeAgorot("address", 5.1))).toBe(agorot(120));
    expect(expectOk(deliveryFeeAgorot("address", 15))).toBe(agorot(120));
    expect(expectOk(deliveryFeeAgorot("address", 15.1))).toBe(agorot(200));
    expect(expectOk(deliveryFeeAgorot("address", 30))).toBe(agorot(200));
    expectErr(deliveryFeeAgorot("address", 30.1), "TOO_FAR");
  });

  it("charges nothing for a return at the lot and stores no distance", () => {
    expect(expectOk(deliveryFeeAgorot("lot", 30))).toBe(0);
  });
});
