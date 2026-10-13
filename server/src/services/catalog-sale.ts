import { storedAgorot } from "../domain/money.js";
import { err, ok, type Result } from "../domain/result.js";
import { CONDITION_GRADES, depositAgorot, type ConditionGrade } from "../domain/sale.js";
import type { CarType } from "../domain/status.js";
import type { PublicSaleCar, StaffStore } from "../repositories/staff-store.js";
import { hasOpenRental, hasOpenSale } from "./holds.js";

export type SaleQuery = {
  maxKm: number;
  condition: ConditionGrade | "any";
  primaryType: CarType | null;
  tagId: string | null;
};

export type SaleOffer = {
  id: string;
  make: string;
  model: string;
  year: number;
  currentKm: number;
  conditionGrade: ConditionGrade;
  primaryType: string;
  tags: { id: string; name: string }[];
  photo: { id: string; alt: string } | null;
  salePriceAgorot: number;
  depositAgorot: number;
};

export type SaleDetail = SaleOffer & {
  color: string;
  seats: number;
  ownersCount: number;
  accidentsNone: boolean;
  knownAccidents: string | null;
  deepTreatmentCompletedAt: string | null;
  photos: { id: string; alt: string; sortOrder: number }[];
};

function isGrade(value: string): value is ConditionGrade {
  return (CONDITION_GRADES as readonly string[]).includes(value);
}

function offerFor(car: PublicSaleCar, query: SaleQuery, now: Date): SaleDetail | null {
  if (car.salePriceAgorot === null || car.salePriceAgorot <= 0) return null;
  if (car.conditionGrade === null || !isGrade(car.conditionGrade)) return null;
  if (car.ownersCount === null) return null;
  if (query.condition !== "any" && car.conditionGrade !== query.condition) return null;
  if (car.currentKm > query.maxKm) return null;
  if (query.tagId !== null && !car.tags.some((tag) => tag.id === query.tagId)) return null;
  if (hasOpenSale(car.sales, now)) return null;
  if (car.status === "available") {
    if (hasOpenRental(car.rentals, now)) return null;
  } else if (car.status !== "for_sale") {
    return null;
  }
  const price = storedAgorot(car.salePriceAgorot);
  const photo = [...car.photos].sort((left, right) => left.sortOrder - right.sortOrder)[0];
  return {
    id: car.id,
    make: car.make,
    model: car.model,
    year: car.year,
    currentKm: car.currentKm,
    conditionGrade: car.conditionGrade,
    primaryType: car.primaryType,
    tags: car.tags.map((tag) => ({ id: tag.id, name: tag.name })),
    photo: photo === undefined ? null : { id: photo.id, alt: photo.alt },
    salePriceAgorot: price,
    depositAgorot: depositAgorot(price),
    color: car.color,
    seats: car.seats,
    ownersCount: car.ownersCount,
    accidentsNone: car.accidentsNone,
    knownAccidents: car.knownAccidents,
    deepTreatmentCompletedAt: car.deepTreatmentCompletedAt?.toISOString() ?? null,
    photos: [...car.photos].sort((left, right) => left.sortOrder - right.sortOrder),
  };
}

function toCard(detail: SaleDetail): SaleOffer {
  return {
    id: detail.id,
    make: detail.make,
    model: detail.model,
    year: detail.year,
    currentKm: detail.currentKm,
    conditionGrade: detail.conditionGrade,
    primaryType: detail.primaryType,
    tags: detail.tags,
    photo: detail.photo,
    salePriceAgorot: detail.salePriceAgorot,
    depositAgorot: detail.depositAgorot,
  };
}

/** Cars for sale at or under the requested kilometres. A live hold hides the car. */
export async function searchSales(
  store: StaffStore,
  query: SaleQuery,
  now: Date,
): Promise<Result<SaleOffer[]>> {
  if (!Number.isInteger(query.maxKm) || query.maxKm < 1) return err("INVALID_INPUT");
  if (query.tagId !== null) {
    const tags = await store.listTags();
    const tag = tags.find((item) => item.id === query.tagId);
    if (tag === undefined || !tag.active) return ok([]);
  }
  const cars = await store.listPublicSales(query.primaryType);
  const offers = cars.flatMap((car) => {
    const detail = offerFor(car, query, now);
    return detail === null ? [] : [toCard(detail)];
  });
  offers.sort(
    (left, right) =>
      left.salePriceAgorot - right.salePriceAgorot || left.id.localeCompare(right.id),
  );
  return ok(offers);
}

/** One car for sale. The plate is not part of this object. */
export async function getSaleCar(
  store: StaffStore,
  carId: string,
  now: Date,
): Promise<Result<SaleDetail>> {
  const car = await store.findPublicSale(carId);
  if (car === null) return err("NOT_FOUND");
  const detail = offerFor(
    car,
    { maxKm: Number.MAX_SAFE_INTEGER, condition: "any", primaryType: car.primaryType, tagId: null },
    now,
  );
  if (detail === null) return err("NOT_FOUND");
  return ok(detail);
}
