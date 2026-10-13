import { createServer } from "node:http";

import { describe, expect, it } from "vitest";

import { createApp } from "../app.js";
import { EARTH_RADIUS_KM } from "../domain/distance.js";
import { agorot } from "../domain/money.js";
import { expectErr, expectOk } from "../domain/testing.js";
import { instantInJerusalem } from "../domain/time.js";
import { FakeGeocoder } from "../geocoding/geocoder.js";
import { CollectingMailer } from "../mail/mailer.js";
import { FakePayments } from "../payments/fake-payments.js";
import { MemoryStaffStore } from "../repositories/memory-staff-store.js";
import type { PublicRentCar } from "../repositories/staff-store.js";
import { MemoryFileStore } from "../storage/file-store.js";
import { addCarPhoto } from "./car-photos.js";
import { changeCarStatus } from "./car-status.js";
import { createCar } from "./cars.js";
import {
  priceKnownDistance,
  quoteRentalCar,
  searchRentals,
  type RentQuery,
} from "./catalog-rent.js";
import { getFleetCar, listFleet } from "./catalog-fleet.js";
import { getSaleCar, searchSales } from "./catalog-sale.js";
import { saveAgeBands } from "./save-age-bands.js";
import type { StaffActor } from "./staff-actor.js";

const now = new Date("2026-10-08T09:00:00.000Z");
const yard: StaffActor = { id: "22222222-2222-4222-8222-222222222222", role: "yard" };
const plate = "12-345-67";
const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0x00]);

const query: RentQuery = {
  pickupAt: instantInJerusalem(2026, 10, 9, 14, 0),
  returnAt: instantInJerusalem(2026, 10, 10, 14, 0),
  age: 30,
  primaryType: "mini",
  returnMode: "address",
  returnAddress: "32.08,34.78",
  tagId: null,
};

function secretCar(): PublicRentCar {
  return {
    id: "44444444-4444-4444-8444-444444444444",
    make: "קיה",
    model: "פיקנטו",
    year: 2024,
    color: "לבן",
    primaryType: "mini",
    seats: 5,
    minAge: 21,
    status: "available",
    tags: [],
    photos: [],
    ageBands: [
      {
        id: "55555555-5555-4555-8555-555555555555",
        minAge: 21,
        maxAge: null,
        weekdayDailyAgorot: 10000,
        weekendDailyAgorot: 14000,
        holidayDailyAgorot: 18000,
      },
    ],
    rentals: [],
  };
}

async function lotWithCar(): Promise<{ store: MemoryStaffStore; carId: string }> {
  const store = new MemoryStaffStore();
  const files = new MemoryFileStore();
  await store.writeLot({
    name: "המגרש",
    address: "32.07,34.78",
    latitude: 32.07,
    longitude: 34.78,
    phone: "03-5555555",
    publicEmail: "hello@lot.test",
    staffAlertEmail: "desk@lot.test",
    kmPerDay: 250,
    excessKmPriceAgorot: 200,
    fuelShortagePricePerLiterAgorot: 800,
  });
  await store.insertInsurance({
    id: "66666666-6666-4666-8666-666666666666",
    name: "בסיסי",
    description: "כלול",
    dailyPriceAgorot: 0,
    includedInBase: true,
    active: true,
    sortOrder: 0,
  });
  const created = expectOk(
    await createCar(
      store,
      yard,
      {
        plate,
        vin: "VINSECRET12345678",
        make: "יונדאי",
        model: "i10",
        year: 2024,
        color: "לבן",
        primaryType: "mini",
        seats: 5,
        currentKm: 1200,
        purchasedAt: "2024-03-01",
        minAge: null,
        internalNotes: "הערה פנימית",
        tagIds: [],
      },
      now,
    ),
  );
  expectOk(await addCarPhoto(store, files, yard, created.id, "חזית", jpeg, now));
  expectOk(
    await saveAgeBands(store, yard, created.id, 21, [
      {
        minAge: 21,
        maxAge: null,
        weekdayDailyAgorot: agorot(100),
        weekendDailyAgorot: agorot(140),
        holidayDailyAgorot: agorot(180),
      },
    ]),
  );
  expectOk(await changeCarStatus(store, yard, created.id, { to: "available" }, now));
  return { store, carId: created.id };
}

describe("public catalog", () => {
  it("prices a matching available car with the return tier and hides a plate", async () => {
    const { store, carId } = await lotWithCar();
    const offers = expectOk(await searchRentals(store, new FakeGeocoder(), query, now));
    expect(offers).toHaveLength(1);
    expect(offers[0]?.id).toBe(carId);
    expect(offers[0]?.deliveryFeeAgorot).toBe(6000);
    expect(offers[0]?.totalAgorot).toBe(
      (offers[0]?.rentalAgorot ?? 0) +
        (offers[0]?.insuranceAgorot ?? 0) +
        (offers[0]?.deliveryFeeAgorot ?? 0),
    );
    const detail = expectOk(
      await quoteRentalCar(store, new FakeGeocoder(), carId, query, null, now),
    );
    const json = JSON.stringify({ offers, detail });
    expect(json).not.toContain(plate);
    expect(json).not.toContain("VINSECRET12345678");
    expect(json).not.toContain("הערה פנימית");
    expect(detail.lines.length).toBeGreaterThan(0);
    expect(detail.kmAllowance).toBeGreaterThan(0);
  });

  it("hides a car with a confirmed rental or an open checklist", async () => {
    const confirmed = await lotWithCar();
    confirmed.store.seedRental(confirmed.carId, "confirmed", null);
    expect(expectOk(await searchRentals(confirmed.store, new FakeGeocoder(), query, now))).toEqual(
      [],
    );

    const checklist = await lotWithCar();
    checklist.store.seedRental(checklist.carId, "checklist", null);
    expect(expectOk(await searchRentals(checklist.store, new FakeGeocoder(), query, now))).toEqual(
      [],
    );
  });

  it("charges the stored lot distance: 60 shekels at 5.0 km, 120 at 5.1, and blocks 30.1", async () => {
    const { store } = await lotWithCar();
    const lot = await store.readLot();
    if (lot === null) throw new Error("Lot is missing");
    await store.writeLot({ ...lot, latitude: 0, longitude: 0 });
    const priced = async (billedKm: number) => {
      const straight = billedKm / 1.1;
      const latitude = (straight / EARTH_RADIUS_KM) * (180 / Math.PI);
      return searchRentals(
        store,
        new FakeGeocoder(),
        { ...query, returnMode: "address", returnAddress: `${latitude},0` },
        now,
      );
    };
    expect(expectOk(await priced(5))[0]?.deliveryFeeAgorot).toBe(6000);
    expect(expectOk(await priced(5.1))[0]?.deliveryFeeAgorot).toBe(12000);
    expectErr(await priced(30.1), "TOO_FAR");
  });

  it("charges 60 shekels at 5.0 km, 120 at 5.1, and blocks 30.1", () => {
    const priced = (billedKm: number) =>
      priceKnownDistance(
        secretCar(),
        { ...query, returnMode: "address" },
        {
          holidays: [],
          kmPerDay: 250,
          straightLineKm: billedKm / 1.1,
          insuranceDailyAgorot: agorot(0),
        },
        now,
      );
    expect(expectOk(priced(5))?.deliveryFeeAgorot).toBe(6000);
    expect(expectOk(priced(5.1))?.deliveryFeeAgorot).toBe(12000);
    expectErr(priced(30.1), "TOO_FAR");
  });

  it("lists a sale car without its plate", async () => {
    const store = new MemoryStaffStore();
    const id = "77777777-7777-4777-8777-777777777777";
    await store.insertCar({
      id,
      plate,
      vin: "VINSECRET12345678",
      make: "מאזדה",
      model: "3",
      year: 2018,
      color: "אפור",
      primaryType: "family",
      seats: 5,
      currentKm: 80000,
      purchasedAt: { year: 2022, month: 1, day: 2 },
      minAge: null,
      ownersCount: 2,
      knownAccidents: null,
      accidentsNone: true,
      conditionGrade: "good",
      salePriceAgorot: 5000000,
      deepTreatmentCompletedAt: new Date("2026-09-01T09:00:00.000Z"),
      status: "for_sale",
      careReason: null,
      internalNotes: "הערה פנימית",
      tagIds: [],
    });
    const offers = expectOk(
      await searchSales(
        store,
        { maxKm: 90000, condition: "good", primaryType: "family", tagId: null },
        now,
      ),
    );
    expect(offers[0]?.salePriceAgorot).toBe(5000000);
    expect(offers[0]?.depositAgorot).toBe(500000);
    const detail = expectOk(await getSaleCar(store, id, now));
    expect(detail.accidentsNone).toBe(true);
    const json = JSON.stringify({ offers, detail });
    expect(json).not.toContain(plate);
    expect(json).not.toContain("VINSECRET12345678");
    expect(json).not.toContain("הערה פנימית");
  });

  it("lists an available car that already has a sale price", async () => {
    const store = new MemoryStaffStore();
    const id = "99999999-9999-4999-8999-999999999999";
    await store.insertCar({
      id,
      plate,
      vin: null,
      make: "קיה",
      model: "נירו",
      year: 2022,
      color: "כחול",
      primaryType: "suv",
      seats: 5,
      currentKm: 40000,
      purchasedAt: { year: 2022, month: 1, day: 2 },
      minAge: 21,
      ownersCount: 1,
      knownAccidents: null,
      accidentsNone: true,
      conditionGrade: "excellent",
      salePriceAgorot: 11900000,
      deepTreatmentCompletedAt: null,
      status: "available",
      careReason: null,
      internalNotes: "",
      tagIds: [],
    });
    const offers = expectOk(
      await searchSales(
        store,
        { maxKm: 10000000, condition: "any", primaryType: null, tagId: null },
        now,
      ),
    );
    expect(offers.map((offer) => offer.id)).toContain(id);
  });

  it("lists every car in the buy gallery without its plate", async () => {
    const store = new MemoryStaffStore();
    const id = "88888888-8888-4888-8888-888888888888";
    await store.insertCar({
      id,
      plate,
      vin: "VINSECRET12345678",
      make: "קיה",
      model: "פיקנטו",
      year: 2021,
      color: "לבן",
      primaryType: "mini",
      seats: 4,
      currentKm: 30000,
      purchasedAt: { year: 2022, month: 1, day: 2 },
      minAge: 21,
      ownersCount: null,
      knownAccidents: null,
      accidentsNone: false,
      conditionGrade: null,
      salePriceAgorot: null,
      deepTreatmentCompletedAt: null,
      status: "preparing",
      careReason: null,
      internalNotes: "הערה פנימית",
      tagIds: [],
    });
    const cars = expectOk(await listFleet(store));
    expect(cars.map((car) => car.id)).toEqual([id]);
    const detail = expectOk(await getFleetCar(store, id));
    expect(detail.make).toBe("קיה");
    const json = JSON.stringify({ cars, detail });
    expect(json).not.toContain(plate);
    expect(json).not.toContain("VINSECRET12345678");
    expect(json).not.toContain("הערה פנימית");
    expect(json).not.toContain("preparing");
  });

  it("returns no cars when a rental search field is missing", async () => {
    const { store } = await lotWithCar();
    const app = createApp({
      store,
      files: new MemoryFileStore(),
      geocoder: new FakeGeocoder(),
      payments: new FakePayments(),
      mailer: new CollectingMailer(),
      staffJwtSecret: "test-staff-secret-must-be-32b-long",
      customerJwtSecret: "test-customer-secret-32-characters-x",
      clientOrigin: "http://localhost:5173",
      appUrl: "http://localhost:5173",
      secureCookies: false,
      jobSecret: "job-secret",
      now: () => now,
    });
    const server = createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", resolve);
    });
    const address = server.address();
    if (address === null || typeof address === "string") throw new Error("No port");
    try {
      const response = await fetch(
        `http://127.0.0.1:${address.port}/api/rent/search?pickup=2026-10-09T14:00&returnAt=2026-10-10T14:00&primaryType=mini&returnMode=lot`,
      );
      expect(response.status).toBe(400);
      const body: unknown = await response.json();
      expect(body).toEqual({ ok: false, error: "INVALID_INPUT" });
      expect(JSON.stringify(body)).not.toContain(plate);
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) reject(error);
          else resolve();
        });
      });
    }
  });
});
