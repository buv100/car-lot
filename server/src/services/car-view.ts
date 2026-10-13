import { civilDateKey } from "../domain/time.js";
import { err, ok, type Result } from "../domain/result.js";
import type { CarRecord, CarWrite, HoldSnapshot, TagRecord } from "../repositories/staff-store.js";
import { hasOpenRental } from "./holds.js";

/** Sale columns stay empty until a later stage fills them. */
export const blankSale = {
  ownersCount: null,
  knownAccidents: null,
  accidentsNone: false,
  conditionGrade: null,
  salePriceAgorot: null,
  deepTreatmentCompletedAt: null,
} as const;

/** Drops photos and bands so an update writes only the car row. */
export function toCarWrite(car: CarRecord): CarWrite {
  return {
    id: car.id,
    plate: car.plate,
    vin: car.vin,
    make: car.make,
    model: car.model,
    year: car.year,
    color: car.color,
    primaryType: car.primaryType,
    seats: car.seats,
    currentKm: car.currentKm,
    purchasedAt: car.purchasedAt,
    minAge: car.minAge,
    ownersCount: car.ownersCount,
    knownAccidents: car.knownAccidents,
    accidentsNone: car.accidentsNone,
    conditionGrade: car.conditionGrade,
    salePriceAgorot: car.salePriceAgorot,
    deepTreatmentCompletedAt: car.deepTreatmentCompletedAt,
    status: car.status,
    careReason: car.careReason,
    internalNotes: car.internalNotes,
    tagIds: [...car.tagIds],
  };
}

/** Inactive tags can stay on a car that already has them, but cannot be newly added. */
export function assignableTags(
  tags: readonly TagRecord[],
  requested: readonly string[],
  already: readonly string[],
): Result<void> {
  const byId = new Map(tags.map((tag) => [tag.id, tag]));
  for (const id of requested) {
    const tag = byId.get(id);
    if (tag === undefined) return err("INVALID_INPUT");
    if (!tag.active && !already.includes(id)) return err("INACTIVE_TAG");
  }
  return ok(undefined);
}

export type StaffCarView = {
  id: string;
  plate: string;
  vin: string | null;
  make: string;
  model: string;
  year: number;
  color: string;
  primaryType: string;
  seats: number;
  currentKm: number;
  purchasedAt: string;
  minAge: number | null;
  status: string;
  careReason: string | null;
  internalNotes: string;
  openRental: boolean;
  tags: { id: string; name: string; active: boolean }[];
  photos: { id: string; alt: string; sortOrder: number }[];
  ageBands: {
    id: string;
    minAge: number;
    maxAge: number | null;
    weekdayDailyAgorot: number;
    weekendDailyAgorot: number;
    holidayDailyAgorot: number;
  }[];
};

/** Staff view of one car, including the plate. The public catalog uses a different shape. */
export function presentCar(
  car: CarRecord,
  tags: readonly TagRecord[],
  rentals: readonly HoldSnapshot[],
  now: Date,
): StaffCarView {
  const byId = new Map(tags.map((tag) => [tag.id, tag]));
  return {
    id: car.id,
    plate: car.plate,
    vin: car.vin,
    make: car.make,
    model: car.model,
    year: car.year,
    color: car.color,
    primaryType: car.primaryType,
    seats: car.seats,
    currentKm: car.currentKm,
    purchasedAt: civilDateKey(car.purchasedAt),
    minAge: car.minAge,
    status: car.status,
    careReason: car.careReason,
    internalNotes: car.internalNotes,
    openRental: hasOpenRental(rentals, now),
    tags: car.tagIds.flatMap((id) => {
      const tag = byId.get(id);
      return tag === undefined ? [] : [{ id: tag.id, name: tag.name, active: tag.active }];
    }),
    photos: car.photos.map((photo) => ({ ...photo })),
    ageBands: car.ageBands.map((band) => ({ ...band })),
  };
}
