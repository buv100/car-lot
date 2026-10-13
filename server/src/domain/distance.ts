import { type Agorot, agorot } from "./money.js";
import { err, ok, type Result } from "./result.js";

/** Mean earth radius used for straight-line distance. Routes are not requested. */
export const EARTH_RADIUS_KM = 6371;

export type GeoPoint = {
  readonly latitude: number;
  readonly longitude: number;
};

function assertFinite(value: number, label: string): void {
  if (!Number.isFinite(value)) throw new Error(`${label} must be finite`);
}

/** Straight-line kilometres between the lot and a return address. */
export function haversineKm(from: GeoPoint, to: GeoPoint): number {
  assertFinite(from.latitude, "latitude");
  assertFinite(from.longitude, "longitude");
  assertFinite(to.latitude, "latitude");
  assertFinite(to.longitude, "longitude");
  const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;
  const latitude1 = toRadians(from.latitude);
  const latitude2 = toRadians(to.latitude);
  const latitudeDelta = latitude2 - latitude1;
  const longitudeDelta = toRadians(to.longitude - from.longitude);
  const chord =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(latitude1) * Math.cos(latitude2) * Math.sin(longitudeDelta / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(chord)));
}

/** Adds 10 percent because a straight line is shorter than the road. */
export function bufferKm(straightLineKm: number): number {
  if (!Number.isFinite(straightLineKm) || straightLineKm < 0) {
    throw new Error("straightLineKm must be a non-negative finite number");
  }
  return straightLineKm * 1.1;
}

/** Return fee by distance band. Above 30 billed km the address cannot be booked online. */
export function deliveryFeeAgorot(mode: "lot" | "address", billedKm: number): Result<Agorot> {
  if (mode === "lot") return ok(agorot(0));
  if (!Number.isFinite(billedKm) || billedKm < 0) {
    throw new Error("billedKm must be a non-negative finite number");
  }
  // 5.0 km is 60 shekels. 5.1 km is 120. 30.1 km cannot be booked online.
  if (billedKm <= 5) return ok(agorot(60));
  if (billedKm <= 15) return ok(agorot(120));
  if (billedKm <= 30) return ok(agorot(200));
  return err("TOO_FAR");
}
