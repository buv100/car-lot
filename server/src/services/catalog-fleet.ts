import { err, ok, type Result } from "../domain/result.js";
import type { PublicFleetCar, StaffStore } from "../repositories/staff-store.js";

export type FleetCar = {
  id: string;
  make: string;
  model: string;
  year: number;
  color: string;
  primaryType: string;
  seats: number;
  currentKm: number;
  tags: { id: string; name: string }[];
  photo: { id: string; alt: string } | null;
  photoCount: number;
};

export type FleetDetail = FleetCar & {
  photos: { id: string; alt: string; sortOrder: number }[];
};

function present(car: PublicFleetCar): FleetDetail {
  const photos = [...car.photos].sort((left, right) => left.sortOrder - right.sortOrder);
  const cover = photos[0];
  return {
    id: car.id,
    make: car.make,
    model: car.model,
    year: car.year,
    color: car.color,
    primaryType: car.primaryType,
    seats: car.seats,
    currentKm: car.currentKm,
    tags: car.tags.map((tag) => ({ id: tag.id, name: tag.name })),
    photo: cover === undefined ? null : { id: cover.id, alt: cover.alt },
    photoCount: photos.length,
    photos,
  };
}

/** Every car in the lot, for looking. Plate and notes are not on this object. */
export async function listFleet(store: StaffStore): Promise<Result<FleetCar[]>> {
  const cars = await store.listPublicFleet();
  return ok(
    cars.map((car) => {
      const detail = present(car);
      return {
        id: detail.id,
        make: detail.make,
        model: detail.model,
        year: detail.year,
        color: detail.color,
        primaryType: detail.primaryType,
        seats: detail.seats,
        currentKm: detail.currentKm,
        tags: detail.tags,
        photo: detail.photo,
        photoCount: detail.photoCount,
      };
    }),
  );
}

/** One car and all of its photos. A missing car is not found. */
export async function getFleetCar(store: StaffStore, carId: string): Promise<Result<FleetDetail>> {
  const car = await store.findPublicFleet(carId);
  if (car === null) return err("NOT_FOUND");
  return ok(present(car));
}
