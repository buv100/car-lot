import { randomUUID } from "node:crypto";

import { formatOrderNumber } from "../domain/order-number.js";
import { isOpenRental } from "../domain/offer.js";
import { quoteRental } from "../domain/rental.js";
import { err, ok, type Result } from "../domain/result.js";
import { RENTAL_STATUSES, type RentalStatus } from "../domain/status.js";
import { jerusalemDate } from "../domain/time.js";
import { storedAgorot } from "../domain/money.js";
import type { Geocoder } from "../geocoding/geocoder.js";
import {
  DuplicateRecord,
  type PublicRentCar,
  type RentalOrderRecord,
  type StaffStore,
} from "../repositories/staff-store.js";
import { priceContext, type RentQuery } from "./catalog-rent-price.js";
import { expireHolds } from "./expire-holds.js";
import { newHoldToken } from "./hold-token.js";

const HOLD_MS = 15 * 60 * 1000;

function rentalStatus(value: string): RentalStatus {
  for (const status of RENTAL_STATUSES) {
    if (status === value) return status;
  }
  throw new Error(`Unexpected rental status ${value}`);
}

/** Another customer's open rental still blocks this car. Our own hold does not. */
function blockedBySomeoneElse(car: PublicRentCar, orderId: string, now: Date): boolean {
  return car.rentals.some((rental) => {
    if (rental.id === orderId) return false;
    return isOpenRental(rentalStatus(rental.status), rental.holdExpiresAt, now);
  });
}

/** Prices a car we already hold, ignoring that hold so a tariff change can be seen. */
export async function repriceHeldRental(
  store: StaffStore,
  geocoder: Geocoder,
  order: RentalOrderRecord,
  now: Date,
): Promise<Result<RentalOrderRecord>> {
  const query: RentQuery = {
    pickupAt: order.pickupAt,
    returnAt: order.returnAt,
    age: order.searchAge,
    primaryType: "mini",
    returnMode: order.returnMode,
    returnAddress: order.returnAddress,
    tagId: null,
  };
  const car = await store.findPublicRental(order.carId);
  if (car === null) return err("NOT_FOUND");
  query.primaryType = car.primaryType;
  const context = await priceContext(store, geocoder, query, now, order.insurancePackageId);
  if (!context.ok) return context;
  if (
    car.status !== "available" ||
    car.minAge === null ||
    blockedBySomeoneElse(car, order.id, now)
  ) {
    return err("CAR_TAKEN");
  }
  const quoted = quoteRental({
    pickupAt: order.pickupAt,
    returnAt: order.returnAt,
    now,
    ageAtPickup: order.searchAge,
    minAge: car.minAge,
    bands: car.ageBands.map((band) => ({
      minAge: band.minAge,
      maxAge: band.maxAge,
      weekdayDailyAgorot: storedAgorot(band.weekdayDailyAgorot),
      weekendDailyAgorot: storedAgorot(band.weekendDailyAgorot),
      holidayDailyAgorot: storedAgorot(band.holidayDailyAgorot),
    })),
    holidays: context.value.holidays,
    insuranceDailyAgorot: storedAgorot(context.value.insurance.dailyPriceAgorot),
    kmPerDay: context.value.kmPerDay,
    returnMode: order.returnMode,
    straightLineKm: context.value.straightLineKm,
  });
  if (!quoted.ok) return quoted;
  const quote = quoted.value;
  return ok({
    ...order,
    rentalAgorot: quote.rentalAgorot,
    insuranceAgorot: quote.insuranceAgorot,
    deliveryFeeAgorot: quote.deliveryFeeAgorot,
    totalAgorot: quote.totalAgorot,
    kmAllowance: quote.kmAllowance,
    straightLineKm: quote.straightLineKm,
    billedKm: quote.billedKm,
    priceLines: quote.lines.map((line) => ({
      start: line.start.toISOString(),
      hours: line.hours,
      dayKind: line.dayKind,
      agorot: line.agorot,
    })),
  });
}

/** Locks a car for 15 minutes with a price snapshot and no customer yet. */
export async function holdRental(
  store: StaffStore,
  geocoder: Geocoder,
  carId: string,
  query: RentQuery,
  insurancePackageId: string | null,
  now: Date,
): Promise<Result<{ orderId: string; holdToken: string; holdExpiresAt: string }>> {
  await expireHolds(store, now);
  const context = await priceContext(store, geocoder, query, now, insurancePackageId);
  if (!context.ok) return context;
  const token = newHoldToken();
  try {
    return await store.transaction(async (tx) => {
      const car = await tx.findPublicRental(carId);
      if (car === null || car.primaryType !== query.primaryType || car.minAge === null) {
        return err("NOT_FOUND");
      }
      if (car.status !== "available" || blockedBySomeoneElse(car, "", now)) return err("CAR_TAKEN");
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
        holidays: context.value.holidays,
        insuranceDailyAgorot: storedAgorot(context.value.insurance.dailyPriceAgorot),
        kmPerDay: context.value.kmPerDay,
        returnMode: query.returnMode,
        straightLineKm: context.value.straightLineKm,
      });
      if (!quoted.ok) return quoted;
      const quote = quoted.value;
      const year = jerusalemDate(now).year;
      const sequence = await tx.allocateSequence("R", year);
      const holdExpiresAt = new Date(now.getTime() + HOLD_MS);
      const order: RentalOrderRecord = {
        id: randomUUID(),
        number: formatOrderNumber("R", year, sequence),
        carId,
        customerId: null,
        holderTokenHash: token.hash,
        pickupAt: query.pickupAt,
        returnAt: query.returnAt,
        searchAge: query.age,
        ageAtPickup: query.age,
        returnMode: query.returnMode,
        returnAddress: query.returnMode === "lot" ? "" : query.returnAddress.trim(),
        returnLat: context.value.returnLat,
        returnLng: context.value.returnLng,
        straightLineKm: quote.straightLineKm,
        billedKm: quote.billedKm,
        deliveryFeeAgorot: quote.deliveryFeeAgorot,
        insurancePackageId: context.value.insurance.id,
        rentalAgorot: quote.rentalAgorot,
        insuranceAgorot: quote.insuranceAgorot,
        totalAgorot: quote.totalAgorot,
        priceLines: quote.lines.map((line) => ({
          start: line.start.toISOString(),
          hours: line.hours,
          dayKind: line.dayKind,
          agorot: line.agorot,
        })),
        kmAllowance: quote.kmAllowance,
        status: "pending_payment",
        holdExpiresAt,
        paymentProvider: "stripe",
        paymentRef: null,
        startKm: null,
        noShow: false,
        cancelledBy: null,
        yardCancelNote: "",
        refundPercent: null,
        refundAgorot: null,
        reminderSentAt: null,
      };
      await tx.insertRentalOrder(order);
      return ok({
        orderId: order.id,
        holdToken: token.raw,
        holdExpiresAt: holdExpiresAt.toISOString(),
      });
    });
  } catch (error: unknown) {
    if (error instanceof DuplicateRecord) return err("CAR_TAKEN");
    throw error;
  }
}
