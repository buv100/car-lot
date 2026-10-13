import { describe, expect, it } from "vitest";

import { bootProblem } from "../boot.js";
import { agorot } from "../domain/money.js";
import { expectErr, expectOk } from "../domain/testing.js";
import { instantInJerusalem } from "../domain/time.js";
import { FakeGeocoder } from "../geocoding/geocoder.js";
import { CollectingMailer } from "../mail/mailer.js";
import { MemoryStaffStore } from "../repositories/memory-staff-store.js";
import { FakePayments } from "../payments/fake-payments.js";
import { MemoryFileStore } from "../storage/file-store.js";
import { addCarPhoto } from "./car-photos.js";
import { changeCarStatus } from "./car-status.js";
import { createCar } from "./cars.js";
import { registerCustomer } from "./customer-account.js";
import { confirmPayment } from "./confirm-payment.js";
import { expireHolds } from "./expire-holds.js";
import { holdRental } from "./hold-rental.js";
import { holdSale } from "./hold-sale.js";
import { payRental } from "./pay-rental.js";
import { paySale } from "./pay-sale.js";
import { readRentalOrder } from "./read-order.js";
import { saveAgeBands } from "./save-age-bands.js";
import { searchRentals, type RentQuery } from "./catalog-rent.js";
import { searchSales } from "./catalog-sale.js";
import { decideSaleRefund } from "./sale-refund.js";
import type { StaffActor } from "./staff-actor.js";

const now = new Date("2026-10-08T09:00:00.000Z");
const later = new Date("2026-10-08T10:00:00.000Z");
const mailer = new CollectingMailer();
const yard: StaffActor = { id: "22222222-2222-4222-8222-222222222222", role: "yard" };
const manager: StaffActor = { id: "33333333-3333-4333-8333-333333333333", role: "manager" };
const plate = "12-345-67";
const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0x00]);

const query: RentQuery = {
  pickupAt: instantInJerusalem(2026, 10, 9, 14, 0),
  returnAt: instantInJerusalem(2026, 10, 10, 14, 0),
  age: 30,
  primaryType: "mini",
  returnMode: "lot",
  returnAddress: "",
  tagId: null,
};

async function rentLot(): Promise<{ store: MemoryStaffStore; carId: string }> {
  const store = new MemoryStaffStore();
  const files = new MemoryFileStore();
  await store.writeLot({
    name: "המגרש",
    address: "רחוב המגרש 1",
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
        vin: null,
        make: "יונדאי",
        model: "i10",
        year: 2024,
        color: "לבן",
        primaryType: "mini",
        seats: 5,
        currentKm: 1200,
        purchasedAt: "2024-03-01",
        minAge: null,
        internalNotes: "",
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

async function customer(
  store: MemoryStaffStore,
  email: string,
  birthDate: string,
  blocked = false,
): Promise<string> {
  const created = expectOk(
    await registerCustomer(
      store,
      { fullName: "דנה לוי", phone: "0501234567", email, birthDate, password: "secret12" },
      now,
    ),
  );
  if (blocked) {
    const row = await store.findCustomerById(created.id);
    if (row === null) throw new Error("Customer missing");
    await store.updateCustomer({ ...row, blocked: true, blockReason: "debt" });
  }
  return created.id;
}

describe("stage 5 payments", () => {
  it("refuses a live Stripe key before the process listens", () => {
    expect(
      bootProblem({
        databaseUrl: "postgresql://lot:lot@localhost:5432/lot",
        staffJwtSecret: "staff-secret-must-be-32-characters",
        customerJwtSecret: "customer-secret-must-be-32-chars-x",
        stripeSecretKey: "sk_live_secret",
      }),
    ).toBe("STRIPE_SECRET_KEY must not be a live key");
  });

  it("keeps the price snapshot and the plate until payment is confirmed", async () => {
    const { store, carId } = await rentLot();
    const payments = new FakePayments();
    const held = expectOk(await holdRental(store, new FakeGeocoder(), carId, query, null, now));
    const customerId = await customer(store, "dana@lot.test", "1996-01-01");
    const before = expectOk(
      await readRentalOrder(store, new FakeGeocoder(), held.orderId, null, held.holdToken, now),
    );
    expect(before.plate).toBeNull();
    expect(JSON.stringify(before)).not.toContain(plate);
    const snapshot = before.totalAgorot;
    expectOk(
      await payRental(
        store,
        new FakeGeocoder(),
        payments,
        {
          orderId: held.orderId,
          customerId,
          holdToken: held.holdToken,
          acceptPrice: false,
          successUrl: "http://localhost/ok",
          cancelUrl: "http://localhost/cancel",
        },
        now,
      ),
    );
    expect(payments.checkouts).toHaveLength(1);
    expectOk(
      await confirmPayment(
        store,
        {
          providerEventId: "evt_paid",
          orderId: held.orderId,
          outcome: "paid",
          providerRef: "pi_test",
        },
        mailer,
        now,
      ),
    );
    const after = expectOk(
      await readRentalOrder(store, new FakeGeocoder(), held.orderId, customerId, null, now),
    );
    expect(after.plate).toBe(plate);
    expect(after.totalAgorot).toBe(snapshot);
    expect(after.confirming).toBe(false);
    const letters = await store.listOutbox();
    expect(letters.some((letter) => letter.body.includes(plate))).toBe(true);
    expectOk(
      await confirmPayment(
        store,
        {
          providerEventId: "evt_paid",
          orderId: held.orderId,
          outcome: "paid",
          providerRef: "pi_test",
        },
        mailer,
        now,
      ),
    );
    expect(await store.listOutbox()).toHaveLength(letters.length);
  });

  it("releases the car when payment fails or the hold expires", async () => {
    const failed = await rentLot();
    const payments = new FakePayments();
    const held = expectOk(
      await holdRental(failed.store, new FakeGeocoder(), failed.carId, query, null, now),
    );
    const customerId = await customer(failed.store, "dana@lot.test", "1996-01-01");
    expectOk(
      await payRental(
        failed.store,
        new FakeGeocoder(),
        payments,
        {
          orderId: held.orderId,
          customerId,
          holdToken: held.holdToken,
          acceptPrice: false,
          successUrl: "http://localhost/ok",
          cancelUrl: "http://localhost/cancel",
        },
        now,
      ),
    );
    expectOk(
      await confirmPayment(
        failed.store,
        {
          providerEventId: "evt_fail",
          orderId: held.orderId,
          outcome: "failed",
          providerRef: null,
        },
        mailer,
        now,
      ),
    );
    expect(
      expectOk(await searchRentals(failed.store, new FakeGeocoder(), query, now)),
    ).toHaveLength(1);

    const expired = await rentLot();
    const waiting = expectOk(
      await holdRental(expired.store, new FakeGeocoder(), expired.carId, query, null, now),
    );
    await expireHolds(expired.store, later);
    const order = await expired.store.findRentalOrder(waiting.orderId);
    expect(order?.status).toBe("expired");
    expect(
      expectOk(await searchRentals(expired.store, new FakeGeocoder(), query, later)),
    ).toHaveLength(1);
  });

  it("stops a mismatched age before checkout and releases the hold", async () => {
    const { store, carId } = await rentLot();
    const payments = new FakePayments();
    const held = expectOk(await holdRental(store, new FakeGeocoder(), carId, query, null, now));
    const customerId = await customer(store, "young@lot.test", "2000-06-01");
    expectErr(
      await payRental(
        store,
        new FakeGeocoder(),
        payments,
        {
          orderId: held.orderId,
          customerId,
          holdToken: held.holdToken,
          acceptPrice: false,
          successUrl: "http://localhost/ok",
          cancelUrl: "http://localhost/cancel",
        },
        now,
      ),
      "AGE_MISMATCH",
    );
    expect(payments.checkouts).toHaveLength(0);
    expect((await store.findRentalOrder(held.orderId))?.status).toBe("expired");
  });

  it("refuses a blocked customer for both a rental and a deposit", async () => {
    const rental = await rentLot();
    const rentalPay = new FakePayments();
    const held = expectOk(
      await holdRental(rental.store, new FakeGeocoder(), rental.carId, query, null, now),
    );
    const blockedRental = await customer(rental.store, "blocked@lot.test", "1996-01-01", true);
    expectErr(
      await payRental(
        rental.store,
        new FakeGeocoder(),
        rentalPay,
        {
          orderId: held.orderId,
          customerId: blockedRental,
          holdToken: held.holdToken,
          acceptPrice: false,
          successUrl: "http://localhost/ok",
          cancelUrl: "http://localhost/cancel",
        },
        now,
      ),
      "CUSTOMER_BLOCKED",
    );
    expect(rentalPay.checkouts).toHaveLength(0);

    const sale = new MemoryStaffStore();
    const salePay = new FakePayments();
    const carId = "77777777-7777-4777-8777-777777777777";
    await sale.insertCar({
      id: carId,
      plate: "99-999-99",
      vin: null,
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
      internalNotes: "",
      tagIds: [],
    });
    const deposit = expectOk(
      await holdSale(
        sale,
        { carId, wantsFinancing: false, financingNote: "", wantsTradeIn: false, tradeInNote: "" },
        now,
      ),
    );
    const blockedSale = await customer(sale, "blocked-sale@lot.test", "1996-01-01", true);
    expectErr(
      await paySale(
        sale,
        salePay,
        {
          orderId: deposit.orderId,
          customerId: blockedSale,
          holdToken: deposit.holdToken,
          acceptPrice: false,
          successUrl: "http://localhost/ok",
          cancelUrl: "http://localhost/cancel",
        },
        now,
      ),
      "CUSTOMER_BLOCKED",
    );
    expect(salePay.checkouts).toHaveLength(0);
  });

  it("keeps a paid deposit with no clock until a manager refunds it", async () => {
    const store = new MemoryStaffStore();
    const payments = new FakePayments();
    await store.writeLot({
      name: "המגרש",
      address: "רחוב המגרש 1",
      latitude: 32.07,
      longitude: 34.78,
      phone: "03-5555555",
      publicEmail: "hello@lot.test",
      staffAlertEmail: "desk@lot.test",
      kmPerDay: 250,
      excessKmPriceAgorot: 200,
      fuelShortagePricePerLiterAgorot: 800,
    });
    const carId = "77777777-7777-4777-8777-777777777777";
    await store.insertCar({
      id: carId,
      plate: "99-999-99",
      vin: null,
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
      internalNotes: "",
      tagIds: [],
    });
    const held = expectOk(
      await holdSale(
        store,
        { carId, wantsFinancing: false, financingNote: "", wantsTradeIn: false, tradeInNote: "" },
        now,
      ),
    );
    const customerId = await customer(store, "buyer@lot.test", "1990-01-01");
    expectOk(
      await paySale(
        store,
        payments,
        {
          orderId: held.orderId,
          customerId,
          holdToken: held.holdToken,
          acceptPrice: false,
          successUrl: "http://localhost/ok",
          cancelUrl: "http://localhost/cancel",
        },
        now,
      ),
    );
    expectOk(
      await confirmPayment(
        store,
        {
          providerEventId: "evt_sale",
          orderId: held.orderId,
          outcome: "paid",
          providerRef: "pi_sale",
        },
        mailer,
        now,
      ),
    );
    const reserved = await store.findSaleOrder(held.orderId);
    expect(reserved?.status).toBe("reserved");
    expect(reserved?.holdExpiresAt).toBeNull();
    const saleQuery = {
      maxKm: 90000,
      condition: "good" as const,
      primaryType: "family" as const,
      tagId: null,
    };
    expect(expectOk(await searchSales(store, saleQuery, later))).toHaveLength(0);
    expectErr(
      await decideSaleRefund(store, payments, yard, held.orderId, true, later, mailer),
      "FORBIDDEN",
    );
    expect((await store.findSaleOrder(held.orderId))?.status).toBe("reserved");
    expectOk(await decideSaleRefund(store, payments, manager, held.orderId, true, later, mailer));
    expect(payments.refunds).toHaveLength(1);
    expect(expectOk(await searchSales(store, saleQuery, later))).toHaveLength(1);
  });
});
