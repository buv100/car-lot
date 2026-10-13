import { storedAgorot } from "../domain/money.js";
import { canOfferForRent } from "../domain/offer.js";
import { quoteRental, type DayKind } from "../domain/rental.js";
import { err, ok, type Result } from "../domain/result.js";
import { bufferKm, deliveryFeeAgorot, haversineKm } from "../domain/distance.js";
import { RENTAL_STATUSES, type CarType, type RentalStatus } from "../domain/status.js";
import { civilDateKey, rentalDurationHours } from "../domain/time.js";
import type { Geocoder } from "../geocoding/geocoder.js";
import type { InsuranceRecord, PublicRentCar, StaffStore } from "../repositories/staff-store.js";

export type RentQuery = {
  pickupAt: Date;
  returnAt: Date;
  age: number;
  primaryType: CarType | null;
  returnMode: "lot" | "address";
  returnAddress: string;
  tagId: string | null;
};

export type RentOffer = {
  id: string;
  make: string;
  model: string;
  year: number;
  color: string;
  primaryType: string;
  seats: number;
  minAge: number;
  tags: { id: string; name: string }[];
  photo: { id: string; alt: string } | null;
  totalAgorot: number;
  rentalAgorot: number;
  insuranceAgorot: number;
  deliveryFeeAgorot: number;
  kmAllowance: number;
};

export type RentDetail = RentOffer & {
  photos: { id: string; alt: string; sortOrder: number }[];
  lines: { start: string; hours: number; dayKind: DayKind; agorot: number }[];
  packages: {
    id: string;
    name: string;
    description: string;
    dailyPriceAgorot: number;
    includedInBase: boolean;
  }[];
  selectedPackageId: string;
  returnMode: "lot" | "address";
  returnAddress: string;
  straightLineKm: number;
  billedKm: number;
};

export type PriceContext = {
  holidays: string[];
  kmPerDay: number;
  straightLineKm: number;
  returnLat: number | null;
  returnLng: number | null;
  insurance: InsuranceRecord;
  packages: InsuranceRecord[];
};

function rentalStatus(value: string): RentalStatus {
  for (const status of RENTAL_STATUSES) {
    if (status === value) return status;
  }
  throw new Error(`Unexpected rental status ${value}`);
}

function cover(car: PublicRentCar): { id: string; alt: string } | null {
  const photo = [...car.photos].sort((left, right) => left.sortOrder - right.sortOrder)[0];
  return photo === undefined ? null : { id: photo.id, alt: photo.alt };
}

/** Shared checks for a rental search and a single-car quote, including the return fee. */
export async function priceContext(
  store: StaffStore,
  geocoder: Geocoder,
  query: RentQuery,
  now: Date,
  insurancePackageId: string | null,
): Promise<Result<PriceContext>> {
  if (!Number.isInteger(query.age) || query.age < 16 || query.age > 99) return err("INVALID_INPUT");
  if (query.returnMode === "address" && query.returnAddress.trim().length === 0) {
    return err("INVALID_INPUT");
  }
  const duration = rentalDurationHours(query.pickupAt, query.returnAt, now);
  if (!duration.ok) return duration;
  const lot = await store.readLot();
  if (lot === null) return err("LOT_NOT_READY");
  let straightLineKm = 0;
  let returnLat: number | null = null;
  let returnLng: number | null = null;
  if (query.returnMode === "address") {
    if (lot.latitude === null || lot.longitude === null) return err("LOT_NOT_READY");
    const trimmed = query.returnAddress.trim();
    const address = trimmed.includes("ישראל") ? trimmed : `${trimmed}, ישראל`;
    const point = await geocoder.geocode(address);
    if (point === null || point.countryCode !== "IL") return err("ADDRESS_NOT_FOUND");
    straightLineKm = haversineKm(
      { latitude: lot.latitude, longitude: lot.longitude },
      { latitude: point.lat, longitude: point.lng },
    );
    returnLat = point.lat;
    returnLng = point.lng;
  }
  const billed = query.returnMode === "lot" ? 0 : bufferKm(straightLineKm);
  const fee = deliveryFeeAgorot(query.returnMode, billed);
  if (!fee.ok) return fee;
  const [holidays, packages] = await Promise.all([store.listHolidays(), store.listInsurance()]);
  const active = packages.filter((pack) => pack.active);
  const base = active.find((pack) => pack.includedInBase);
  if (base === undefined) throw new Error("Base insurance is missing");
  const selected =
    insurancePackageId === null ? base : active.find((pack) => pack.id === insurancePackageId);
  if (selected === undefined) return err("INVALID_INPUT");
  return ok({
    holidays: holidays.map((holiday) => civilDateKey(holiday.date)),
    kmPerDay: lot.kmPerDay,
    straightLineKm,
    returnLat,
    returnLng,
    insurance: selected,
    packages: active,
  });
}

function matchesTag(car: PublicRentCar, tagId: string | null): boolean {
  if (tagId === null) return true;
  return car.tags.some((tag) => tag.id === tagId);
}

/** Prices one offered car. Age gaps and bad bands hide that car only. */
export function offerFor(
  car: PublicRentCar,
  query: RentQuery,
  context: PriceContext,
  now: Date,
): Result<RentDetail | null> {
  if (car.minAge === null || !matchesTag(car, query.tagId)) return ok(null);
  if (
    !canOfferForRent({
      status: car.status,
      rentals: car.rentals.map((rental) => ({
        status: rentalStatus(rental.status),
        holdExpiresAt: rental.holdExpiresAt,
      })),
      now,
    })
  ) {
    return ok(null);
  }
  const quoted = quoteRental({
    pickupAt: query.pickupAt,
    returnAt: query.returnAt,
    now,
    ageAtPickup: query.age,
    minAge: car.minAge,
    bands: car.ageBands.map((band) => ({
      minAge: band.minAge,
      maxAge: band.maxAge,
      weekdayDailyAgorot: storedAgorot(band.weekdayDailyAgorot),
      weekendDailyAgorot: storedAgorot(band.weekendDailyAgorot),
      holidayDailyAgorot: storedAgorot(band.holidayDailyAgorot),
    })),
    holidays: context.holidays,
    insuranceDailyAgorot: storedAgorot(context.insurance.dailyPriceAgorot),
    kmPerDay: context.kmPerDay,
    returnMode: query.returnMode,
    straightLineKm: context.straightLineKm,
  });
  if (!quoted.ok) {
    if (
      quoted.error.code === "AGE_NOT_OFFERED" ||
      quoted.error.code === "BANDS_INVALID" ||
      quoted.error.code === "BANDS_OVERLAP"
    ) {
      return ok(null);
    }
    return quoted;
  }
  const quote = quoted.value;
  return ok({
    id: car.id,
    make: car.make,
    model: car.model,
    year: car.year,
    color: car.color,
    primaryType: car.primaryType,
    seats: car.seats,
    minAge: car.minAge,
    tags: car.tags.map((tag) => ({ id: tag.id, name: tag.name })),
    photo: cover(car),
    photos: [...car.photos].sort((left, right) => left.sortOrder - right.sortOrder),
    totalAgorot: quote.totalAgorot,
    rentalAgorot: quote.rentalAgorot,
    insuranceAgorot: quote.insuranceAgorot,
    deliveryFeeAgorot: quote.deliveryFeeAgorot,
    kmAllowance: quote.kmAllowance,
    lines: quote.lines.map((line) => ({
      start: line.start.toISOString(),
      hours: line.hours,
      dayKind: line.dayKind,
      agorot: line.agorot,
    })),
    packages: context.packages
      .slice()
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map((pack) => ({
        id: pack.id,
        name: pack.name,
        description: pack.description,
        dailyPriceAgorot: pack.dailyPriceAgorot,
        includedInBase: pack.includedInBase,
      })),
    selectedPackageId: context.insurance.id,
    returnMode: query.returnMode,
    returnAddress: query.returnAddress,
    straightLineKm: quote.straightLineKm,
    billedKm: quote.billedKm,
  });
}

export function toCard(detail: RentDetail): RentOffer {
  return {
    id: detail.id,
    make: detail.make,
    model: detail.model,
    year: detail.year,
    color: detail.color,
    primaryType: detail.primaryType,
    seats: detail.seats,
    minAge: detail.minAge,
    tags: detail.tags,
    photo: detail.photo,
    totalAgorot: detail.totalAgorot,
    rentalAgorot: detail.rentalAgorot,
    insuranceAgorot: detail.insuranceAgorot,
    deliveryFeeAgorot: detail.deliveryFeeAgorot,
    kmAllowance: detail.kmAllowance,
  };
}
