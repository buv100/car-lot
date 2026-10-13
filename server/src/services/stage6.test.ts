import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { canOfferForRent, canOfferForSale } from "../domain/offer.js";
import { agorot } from "../domain/money.js";
import { expectErr, expectOk } from "../domain/testing.js";
import { CollectingMailer } from "../mail/mailer.js";
import { FakePayments } from "../payments/fake-payments.js";
import { StripePayments } from "../payments/stripe.js";
import { MemoryStaffStore } from "../repositories/memory-staff-store.js";
import type { RentalOrderRecord } from "../repositories/staff-store.js";
import { MemoryFileStore } from "../storage/file-store.js";
import { addCarPhoto } from "./car-photos.js";
import { changeCarStatus } from "./car-status.js";
import { createCar } from "./cars.js";
import { completeChecklist } from "./complete-checklist.js";
import { completeDeepTreatment } from "./deep-treatment.js";
import { cancelRentalByCustomer, cancelRentalByYard } from "./rental-cancel.js";
import { handOverRental, markReturned } from "./rental-desk.js";
import { saveAgeBands } from "./save-age-bands.js";
import type { StaffActor } from "./staff-actor.js";

const now = new Date("2026-10-10T08:00:00.000Z");
const mailer = new CollectingMailer();
const yard: StaffActor = { id: "22222222-2222-4222-8222-222222222222", role: "yard" };
const manager: StaffActor = { id: "11111111-1111-4111-8111-111111111111", role: "manager" };
const customerId = "33333333-3333-4333-8333-333333333333";
const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0x00]);

const draft = {
  plate: "12-345-67",
  vin: null,
  make: "יונדאי",
  model: "i10",
  year: 2024,
  color: "לבן",
  primaryType: "mini" as const,
  seats: 5,
  currentKm: 1000,
  purchasedAt: "2026-01-01",
  internalNotes: "",
  tagIds: [] as string[],
  minAge: 21,
};

async function publishedCar(): Promise<{ store: MemoryStaffStore; carId: string }> {
  const store = new MemoryStaffStore();
  const created = expectOk(await createCar(store, yard, draft, now));
  expectOk(
    await addCarPhoto(store, new MemoryFileStore(), yard, created.id, "מבט קדמי", jpeg, now),
  );
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

function rental(carId: string, overrides: Partial<RentalOrderRecord> = {}): RentalOrderRecord {
  return {
    id: randomUUID(),
    number: `R-2026-${randomUUID().slice(0, 5)}`,
    carId,
    customerId,
    holderTokenHash: null,
    pickupAt: new Date("2026-10-12T07:00:00.000Z"),
    searchAge: 30,
    ageAtPickup: 30,
    returnMode: "lot",
    returnAddress: "",
    returnLat: null,
    returnLng: null,
    straightLineKm: 0,
    billedKm: 0,
    deliveryFeeAgorot: 0,
    insurancePackageId: "base",
    rentalAgorot: 10_000,
    insuranceAgorot: 0,
    priceLines: [],
    returnAt: new Date("2026-10-14T07:00:00.000Z"),
    totalAgorot: 10_000,
    kmAllowance: 200,
    status: "confirmed",
    holdExpiresAt: null,
    paymentProvider: "stripe",
    paymentRef: "pi_test_order",
    startKm: null,
    noShow: false,
    cancelledBy: null,
    yardCancelNote: "",
    refundPercent: null,
    refundAgorot: null,
    reminderSentAt: null,
    ...overrides,
  };
}

describe("stage 6 handover, checklist, and sale", () => {
  it("acceptance 10: 47 hours refunds half, and a yard cancel refunds the Stripe charge in full", async () => {
    const { store, carId } = await publishedCar();
    const pickupAt = new Date("2026-10-12T07:00:00.000Z");
    const fortySevenHoursBefore = new Date(pickupAt.getTime() - 47 * 60 * 60 * 1000);
    const customerOrder = rental(carId, { pickupAt, paymentRef: "pi_test_47" });
    await store.insertRentalOrder(customerOrder);

    const calls: { body: string; authorization: string }[] = [];
    const previousFetch = globalThis.fetch;
    globalThis.fetch = (_url, init) => {
      const headers = new Headers(init?.headers);
      const raw = init?.body;
      let body = "";
      if (typeof raw === "string") body = raw;
      else if (raw instanceof URLSearchParams) body = raw.toString();
      calls.push({
        body,
        authorization: headers.get("Authorization") ?? "",
      });
      return Promise.resolve(
        new Response(JSON.stringify({ id: `re_${calls.length}` }), { status: 200 }),
      );
    };
    const stripe = new StripePayments("sk_test_stage6", "whsec_test");

    let customerCancel;
    let yardCancel;
    try {
      customerCancel = expectOk(
        await cancelRentalByCustomer(store, stripe, mailer, {
          orderId: customerOrder.id,
          customerId,
          now: fortySevenHoursBefore,
        }),
      );
      expect(customerCancel.refundPercent).toBe(50);
      expect(customerCancel.refundAgorot).toBe(5_000);
      expect(calls[0]?.body).toContain("payment_intent=pi_test_47");
      expect(calls[0]?.body).toContain("amount=5000");
      expect(calls[0]?.authorization).toBe("Bearer sk_test_stage6");

      const yardOrder = rental(carId, { paymentRef: "pi_test_yard", number: "R-2026-00002" });
      await store.insertRentalOrder(yardOrder);
      yardCancel = expectOk(
        await cancelRentalByYard(store, stripe, mailer, yard, yardOrder.id, "הרכב לא מוכן", now),
      );
      expect(yardCancel.refundPercent).toBe(100);
      expect(yardCancel.refundAgorot).toBe(10_000);
      expect(calls[1]?.body).toContain("payment_intent=pi_test_yard");
      expect(calls[1]?.body).toContain("amount=10000");
    } finally {
      globalThis.fetch = previousFetch;
    }

    const hidden = await store.listRentals(carId);
    expect(
      canOfferForRent({
        status: "available",
        rentals: hidden.map((row) => ({
          status: row.status as "cancelled",
          holdExpiresAt: row.holdExpiresAt,
        })),
        now,
      }),
    ).toBe(true);
  });

  it("acceptance 11: an unfinished checklist cannot close", async () => {
    const { store, carId } = await publishedCar();
    const files = new MemoryFileStore();
    const payments = new FakePayments();
    const order = rental(carId);
    await store.insertRentalOrder(order);
    expectOk(await handOverRental(store, yard, order.id, 1000));
    expectOk(await markReturned(store, yard, order.id));
    expectErr(
      await completeChecklist(
        store,
        files,
        payments,
        yard,
        order.id,
        {
          endKm: null,
          fuelLitersShort: null,
          washNeeded: true,
          washDone: false,
          treatmentNeeded: false,
          treatmentDone: false,
          treatmentNote: "",
          priceDecision: null,
          minAge: null,
          bands: null,
          returnPhotos: [],
          damages: [],
        },
        now,
        mailer,
      ),
      "CHECKLIST_INCOMPLETE",
    );
  });

  it("acceptance 12: a finished checklist returns the car to search with the new kilometres", async () => {
    const { store, carId } = await publishedCar();
    const files = new MemoryFileStore();
    const payments = new FakePayments();
    const order = rental(carId, { kmAllowance: 500 });
    await store.insertRentalOrder(order);
    expectOk(await handOverRental(store, yard, order.id, 1000));
    expectOk(await markReturned(store, yard, order.id));
    const closed = expectOk(
      await completeChecklist(
        store,
        files,
        payments,
        yard,
        order.id,
        {
          endKm: 1300,
          fuelLitersShort: 2,
          washNeeded: false,
          washDone: false,
          treatmentNeeded: false,
          treatmentDone: false,
          treatmentNote: "",
          priceDecision: "keep",
          minAge: null,
          bands: null,
          returnPhotos: [jpeg],
          damages: [],
        },
        now,
        mailer,
      ),
    );
    expect(closed.status).toBe("completed");
    expect(closed.currentKm).toBe(1300);
    const car = await store.findCar(carId);
    const rentals = await store.listRentals(carId);
    expect(car?.status).toBe("available");
    expect(
      canOfferForRent({
        status: car?.status ?? "preparing",
        rentals: rentals.map((row) => ({
          status: row.status as "completed",
          holdExpiresAt: row.holdExpiresAt,
        })),
        now,
      }),
    ).toBe(true);
    expect(payments.refunds).toHaveLength(0);
  });

  it("acceptance 14: deep treatment without sale fields fails, and a complete listing leaves the rental fleet", async () => {
    const { store, carId } = await publishedCar();
    const files = new MemoryFileStore();
    expectOk(await changeCarStatus(store, yard, carId, { to: "deep_treatment" }, now));
    expectErr(
      await completeDeepTreatment(
        store,
        yard,
        carId,
        {
          ownersCount: null,
          knownAccidents: null,
          accidentsNone: false,
          conditionGrade: null,
          salePriceAgorot: null,
          completedAt: now,
        },
        now,
      ),
      "SALE_NOT_READY",
    );

    for (let index = 0; index < 3; index += 1) {
      expectOk(await addCarPhoto(store, files, yard, carId, `מבט ${index + 2}`, jpeg, now));
    }
    const moved = expectOk(
      await completeDeepTreatment(
        store,
        manager,
        carId,
        {
          ownersCount: 1,
          knownAccidents: null,
          accidentsNone: true,
          conditionGrade: "good",
          salePriceAgorot: agorot(40000),
          completedAt: now,
        },
        now,
      ),
    );
    expect(moved.status).toBe("for_sale");
    const car = await store.findCar(carId);
    expect(car?.currentKm).toBe(1000);
    expect(canOfferForRent({ status: "for_sale", rentals: [], now })).toBe(false);
    expect(canOfferForSale({ status: "for_sale", sales: [], now })).toBe(true);
  });
});
