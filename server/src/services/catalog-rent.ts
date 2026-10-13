import { type Agorot } from "../domain/money.js";
import { err, ok, type Result } from "../domain/result.js";
import type { Geocoder } from "../geocoding/geocoder.js";
import type { PublicRentCar, StaffStore } from "../repositories/staff-store.js";
import {
  offerFor,
  priceContext,
  toCard,
  type RentDetail,
  type RentOffer,
  type RentQuery,
} from "./catalog-rent-price.js";

export type { RentDetail, RentOffer, RentQuery };

/** Prices a known straight-line distance so the fee bands can be tested without geocoding. */
export function priceKnownDistance(
  car: PublicRentCar,
  query: RentQuery,
  context: {
    holidays: readonly string[];
    kmPerDay: number;
    straightLineKm: number;
    insuranceDailyAgorot: Agorot;
  },
  now: Date,
): Result<RentOffer | null> {
  const priced = offerFor(
    car,
    query,
    {
      holidays: [...context.holidays],
      kmPerDay: context.kmPerDay,
      straightLineKm: context.straightLineKm,
      returnLat: null,
      returnLng: null,
      insurance: {
        id: "base",
        name: "",
        description: "",
        dailyPriceAgorot: context.insuranceDailyAgorot,
        includedInBase: true,
        active: true,
        sortOrder: 0,
      },
      packages: [],
    },
    now,
  );
  if (!priced.ok) return priced;
  return ok(priced.value === null ? null : toCard(priced.value));
}

/** Available cars for the search, cheapest period price first. An open rental hides the car. */
export async function searchRentals(
  store: StaffStore,
  geocoder: Geocoder,
  query: RentQuery,
  now: Date,
): Promise<Result<RentOffer[]>> {
  const context = await priceContext(store, geocoder, query, now, null);
  if (!context.ok) return context;
  if (query.tagId !== null) {
    const tags = await store.listTags();
    const tag = tags.find((item) => item.id === query.tagId);
    if (tag === undefined || !tag.active) return ok([]);
  }
  const cars = await store.listPublicRentals(query.primaryType);
  const offers: RentOffer[] = [];
  for (const car of cars) {
    const priced = offerFor(car, query, context.value, now);
    if (!priced.ok) return priced;
    if (priced.value !== null) offers.push(toCard(priced.value));
  }
  offers.sort(
    (left, right) => left.totalAgorot - right.totalAgorot || left.id.localeCompare(right.id),
  );
  return ok(offers);
}

/** One rental car with the day lines, base insurance, and the kilometre allowance. */
export async function quoteRentalCar(
  store: StaffStore,
  geocoder: Geocoder,
  carId: string,
  query: RentQuery,
  insurancePackageId: string | null,
  now: Date,
): Promise<Result<RentDetail>> {
  const context = await priceContext(store, geocoder, query, now, insurancePackageId);
  if (!context.ok) return context;
  const car = await store.findPublicRental(carId);
  if (car === null || (query.primaryType !== null && car.primaryType !== query.primaryType)) {
    return err("NOT_FOUND");
  }
  const priced = offerFor(car, query, context.value, now);
  if (!priced.ok) return priced;
  if (priced.value === null) return err("NOT_FOUND");
  return ok(priced.value);
}
