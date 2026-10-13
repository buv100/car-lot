import { randomUUID } from "node:crypto";

import { isUuid } from "../domain/car-fields.js";
import { detectPhotoKind, MAX_PHOTO_BYTES, MAX_PHOTOS_PER_CAR } from "../domain/photo.js";
import { err, ok, type Result } from "../domain/result.js";
import type { StaffStore } from "../repositories/staff-store.js";
import type { FileStore } from "../storage/file-store.js";
import { presentCar, type StaffCarView } from "./car-view.js";
import { requirePermission } from "./login-staff.js";
import type { StaffActor } from "./staff-actor.js";

/** Decodes one uploaded image. The kind is decided from the bytes, not the name. */
export function decodePhoto(contentBase64: string): Result<Uint8Array> {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(contentBase64)) return err("INVALID_PHOTO");
  const bytes = new Uint8Array(Buffer.from(contentBase64, "base64"));
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_PHOTO_BYTES) return err("INVALID_PHOTO");
  if (detectPhotoKind(bytes) === null) return err("INVALID_PHOTO");
  return ok(bytes);
}

/** Adds a photo. A car cannot pass twenty images. */
export async function addCarPhoto(
  store: StaffStore,
  files: FileStore,
  actor: StaffActor,
  carId: string,
  alt: string,
  bytes: Uint8Array,
  now: Date = new Date(),
): Promise<Result<StaffCarView>> {
  const allowed = requirePermission(actor.role, "cars.write");
  if (!allowed.ok) return allowed;
  const text = alt.trim();
  if (!isUuid(carId) || text.length < 1 || text.length > 120) return err("INVALID_INPUT");
  if (
    bytes.byteLength === 0 ||
    bytes.byteLength > MAX_PHOTO_BYTES ||
    detectPhotoKind(bytes) === null
  ) {
    return err("INVALID_PHOTO");
  }
  const car = await store.findCar(carId);
  if (car === null) return err("NOT_FOUND");
  if (car.photos.length >= MAX_PHOTOS_PER_CAR) return err("TOO_MANY_PHOTOS");
  const photoId = randomUUID();
  const sortOrder = car.photos.reduce((max, photo) => Math.max(max, photo.sortOrder), -1) + 1;
  await files.saveCarPhoto(carId, photoId, bytes);
  try {
    await store.addPhoto(carId, { id: photoId, alt: text, sortOrder });
  } catch (error: unknown) {
    await files.deleteCarPhoto(carId, photoId);
    throw error;
  }
  const updated = await store.findCar(carId);
  if (updated === null) throw new Error("Car missing after photo");
  const tags = await store.listTags();
  const rentals = await store.listRentals(carId);
  return ok(presentCar(updated, tags, rentals, now));
}

/** Removes a photo. An available car must keep at least one. */
export async function removeCarPhoto(
  store: StaffStore,
  files: FileStore,
  actor: StaffActor,
  carId: string,
  photoId: string,
  now: Date,
): Promise<Result<StaffCarView>> {
  const allowed = requirePermission(actor.role, "cars.write");
  if (!allowed.ok) return allowed;
  const car = await store.findCar(carId);
  if (car === null) return err("NOT_FOUND");
  if (!car.photos.some((photo) => photo.id === photoId)) return err("NOT_FOUND");
  if (car.status !== "preparing" && car.photos.length <= 1) return err("CAR_NOT_READY");
  if (car.status === "for_sale" && car.photos.length <= 4) return err("SALE_NOT_READY");
  await store.deletePhoto(carId, photoId);
  await files.deleteCarPhoto(carId, photoId);
  const updated = await store.findCar(carId);
  if (updated === null) throw new Error("Car missing after photo delete");
  const tags = await store.listTags();
  const rentals = await store.listRentals(carId);
  return ok(presentCar(updated, tags, rentals, now));
}
