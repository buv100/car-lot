import type { Request, Response } from "express";

import type { ErrorCode, Result } from "../domain/result.js";
import { civilDateKey } from "../domain/time.js";
import type {
  HolidayRecord,
  InsuranceRecord,
  JsonObject,
  LotRecord,
  SettingChangeRecord,
  TagRecord,
  CarRecord,
} from "../repositories/staff-store.js";
import type { StaffPublic } from "../services/staff-actor.js";
import type { StaffCarView } from "../services/car-view.js";

/** Business failures use 400, except the codes the build spec calls out. */
export function httpStatus(code: ErrorCode): number {
  if (code === "FORBIDDEN") return 403;
  if (code === "CAR_TAKEN") return 409;
  if (code === "UNAUTHENTICATED" || code === "INVALID_CREDENTIALS") return 401;
  if (code === "INTERNAL") return 500;
  return 400;
}

export function sendError(res: Response, code: ErrorCode): void {
  res.status(httpStatus(code)).json({ ok: false, error: code });
}

export function sendData<T>(
  res: Response,
  result: Result<T>,
  present: (value: T) => unknown,
): void {
  if (!result.ok) {
    sendError(res, result.error.code);
    return;
  }
  res.status(200).json({ ok: true, data: present(result.value) });
}

/** Express types the parsed JSON body as any. Callers validate it with Zod. */
export function requestBody(req: Request): unknown {
  return req.body as unknown;
}

export function routeId(value: string | string[] | undefined): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function wholeShekels(agorot: number): number {
  if (!Number.isInteger(agorot) || agorot < 0 || agorot % 100 !== 0) {
    throw new Error("Stored staff price is not a whole number of shekels");
  }
  return agorot / 100;
}

export function viewJson(car: StaffCarView): unknown {
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
    status: car.status,
    careReason: car.careReason,
    internalNotes: car.internalNotes,
    tags: car.tags,
    photos: car.photos.map((photo) => ({
      id: photo.id,
      alt: photo.alt,
      sortOrder: photo.sortOrder,
      url: `/media/cars/${car.id}/${photo.id}`,
    })),
    bands: car.ageBands.map((band) => ({
      id: band.id,
      minAge: band.minAge,
      maxAge: band.maxAge,
      weekdayShekels: wholeShekels(band.weekdayDailyAgorot),
      weekendShekels: wholeShekels(band.weekendDailyAgorot),
      holidayShekels: wholeShekels(band.holidayDailyAgorot),
    })),
  };
}

export function staffJson(staff: StaffPublic): StaffPublic {
  return staff;
}

export function carJson(car: CarRecord, tags: readonly TagRecord[]): unknown {
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
    tags: car.tagIds.map((tagId) => {
      const tag = tags.find((item) => item.id === tagId);
      return { id: tagId, name: tag?.name ?? "", active: tag?.active ?? false };
    }),
    photos: car.photos.map((photo) => ({
      id: photo.id,
      alt: photo.alt,
      sortOrder: photo.sortOrder,
      url: `/media/cars/${car.id}/${photo.id}`,
    })),
    bands: car.ageBands.map((band) => ({
      id: band.id,
      minAge: band.minAge,
      maxAge: band.maxAge,
      weekdayShekels: wholeShekels(band.weekdayDailyAgorot),
      weekendShekels: wholeShekels(band.weekendDailyAgorot),
      holidayShekels: wholeShekels(band.holidayDailyAgorot),
    })),
  };
}

export function lotJson(lot: LotRecord): unknown {
  return {
    name: lot.name,
    address: lot.address,
    latitude: lot.latitude,
    longitude: lot.longitude,
    phone: lot.phone,
    publicEmail: lot.publicEmail,
    staffAlertEmail: lot.staffAlertEmail,
    kmPerDay: lot.kmPerDay,
    excessKmShekels: wholeShekels(lot.excessKmPriceAgorot),
    fuelShekels: wholeShekels(lot.fuelShortagePricePerLiterAgorot),
  };
}

export function holidayJson(holiday: HolidayRecord): unknown {
  return { id: holiday.id, name: holiday.name, date: civilDateKey(holiday.date) };
}

export function insuranceJson(pack: InsuranceRecord): unknown {
  return {
    id: pack.id,
    name: pack.name,
    description: pack.description,
    dailyShekels: wholeShekels(pack.dailyPriceAgorot),
    includedInBase: pack.includedInBase,
    active: pack.active,
    sortOrder: pack.sortOrder,
  };
}

function historyValue(scope: string, json: JsonObject): JsonObject {
  if (json.none === true) return { none: true };
  if (scope === "fleet_prices" || scope === "fleetPrices") {
    const excess = json.excessKmPriceAgorot;
    const fuel = json.fuelShortagePricePerLiterAgorot;
    return {
      kmPerDay: typeof json.kmPerDay === "number" ? json.kmPerDay : null,
      excessKmShekels: typeof excess === "number" ? wholeShekels(excess) : null,
      fuelShekels: typeof fuel === "number" ? wholeShekels(fuel) : null,
    };
  }
  const daily = json.dailyPriceAgorot;
  return {
    name: json.name ?? null,
    description: json.description ?? null,
    dailyShekels: typeof daily === "number" ? wholeShekels(daily) : null,
    includedInBase: json.includedInBase ?? null,
    active: json.active ?? null,
    sortOrder: json.sortOrder ?? null,
  };
}

/** Shekels for the settings desk. Stored rows stay in agorot. */
export function historyJson(change: SettingChangeRecord & { staffName?: string }): {
  id: string;
  staffId: string;
  staffName: string;
  createdAt: string;
  scope: string;
  entityId: string | null;
  previous: JsonObject;
  next: JsonObject;
} {
  const scope = change.scope === "fleetPrices" ? "fleet_prices" : change.scope;
  return {
    id: change.id,
    staffId: change.staffId,
    staffName: change.staffName ?? "",
    createdAt: change.createdAt.toISOString(),
    scope,
    entityId: change.entityId,
    previous: historyValue(scope, change.previousJson),
    next: historyValue(scope, change.nextJson),
  };
}
