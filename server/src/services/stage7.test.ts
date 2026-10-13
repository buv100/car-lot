import { createServer, type Server } from "node:http";
import { mkdtemp, readdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { createApp } from "../app.js";
import { bootProblem } from "../boot.js";
import { canOfferForRent } from "../domain/offer.js";
import { agorot } from "../domain/money.js";
import { expectOk } from "../domain/testing.js";
import { HOUR_MS } from "../domain/time.js";
import { FakeGeocoder } from "../geocoding/geocoder.js";
import { CollectingMailer, LogMailer, ResendMailer } from "../mail/mailer.js";
import type { Mailer } from "../mail/mailer.js";
import { FakePayments } from "../payments/fake-payments.js";
import { MemoryStaffStore } from "../repositories/memory-staff-store.js";
import type { RentalOrderRecord } from "../repositories/staff-store.js";
import { MemoryFileStore } from "../storage/file-store.js";
import { addCarPhoto } from "./car-photos.js";
import { changeCarStatus } from "./car-status.js";
import { createCar } from "./cars.js";
import { confirmPayment } from "./confirm-payment.js";
import { retryOutbox } from "./deliver-mail.js";
import { cancelRentalByCustomer } from "./rental-cancel.js";
import { saveAgeBands } from "./save-age-bands.js";
import { adjustKm } from "./adjust-km.js";
import { queueSaleAlerts } from "./order-mail.js";
import { tickJobs } from "./tick-jobs.js";
import type { StaffActor } from "./staff-actor.js";

const now = new Date("2026-10-10T09:00:00.000Z");
const yard: StaffActor = { id: "22222222-2222-4222-8222-222222222222", role: "yard" };
const manager: StaffActor = { id: "11111111-1111-4111-8111-111111111111", role: "manager" };
const customerId = "33333333-3333-4333-8333-333333333333";
const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0x00]);

class FailingMailer implements Mailer {
  send(): Promise<void> {
    return Promise.reject(new Error("mailbox refused"));
  }
}

async function lot(): Promise<MemoryStaffStore> {
  const store = new MemoryStaffStore();
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
  await store.insertCustomer({
    id: customerId,
    fullName: "דנה לוי",
    phone: "+972501234567",
    email: "dana@lot.test",
    birthDate: { year: 1996, month: 1, day: 1 },
    passwordHash: "hash",
    blocked: false,
    blockReason: null,
    blockNote: "",
    blockedAt: null,
    blockedByStaffId: null,
    unblockedAt: null,
    unblockedByStaffId: null,
  });
  return store;
}

async function availableCar(
  store: MemoryStaffStore,
  input: { plate: string; currentKm: number; purchasedAt: string },
): Promise<string> {
  const created = expectOk(
    await createCar(
      store,
      yard,
      {
        plate: input.plate,
        vin: null,
        make: "יונדאי",
        model: "i10",
        year: 2024,
        color: "לבן",
        primaryType: "mini",
        seats: 5,
        currentKm: input.currentKm,
        purchasedAt: input.purchasedAt,
        internalNotes: "",
        tagIds: [],
        minAge: 21,
      },
      now,
    ),
  );
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
  return created.id;
}

function rental(carId: string, overrides: Partial<RentalOrderRecord> = {}): RentalOrderRecord {
  return {
    id: randomUUID(),
    number: "R-2026-00011",
    carId,
    customerId,
    holderTokenHash: null,
    pickupAt: new Date(now.getTime() + 20 * HOUR_MS),
    returnAt: new Date(now.getTime() + 48 * HOUR_MS),
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
    totalAgorot: 10_000,
    priceLines: [],
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

describe("stage 7 mail and jobs", () => {
  it("acceptance 13: one threshold alert, and the car stays available to rent", async () => {
    const store = await lot();
    const youngId = await availableCar(store, {
      plate: "11-111-11",
      currentKm: 1000,
      purchasedAt: "2026-01-01",
    });
    const failing = new FailingMailer();
    expectOk(await adjustKm(store, manager, youngId, 100_000, "עבר את הסף", now, failing));

    const young = await store.findCar(youngId);
    const rentals = await store.listRentals(youngId);
    expect(young?.status).toBe("available");
    expect(young?.saleAlertSentAt).not.toBeNull();
    expect(rentals).toEqual([]);
    expect(canOfferForRent({ status: "available", rentals: [], now })).toBe(true);

    const first = await store.listOutbox();
    expect(first).toHaveLength(1);
    expect(first[0]?.status).toBe("failed");
    expect(first[0]?.subject).toBe("רכב בסף מכירה");
    expect(first[0]?.body).toContain("11-111-11");
    expect(first[0]?.lastError).toBe("mailbox refused");

    await queueSaleAlerts(store, now);
    expect(await store.listOutbox()).toHaveLength(1);

    const mailer = new CollectingMailer();
    const retry = expectOk(await retryOutbox(store, mailer, yard, first[0]?.id ?? "", now));
    expect(retry.status).toBe("sent");
    expect(mailer.sent).toHaveLength(1);
    expect((await store.findCar(youngId))?.status).toBe("available");

    const oldId = await availableCar(store, {
      plate: "22-222-22",
      currentKm: 1000,
      purchasedAt: "2023-10-01",
    });
    const report = await tickJobs(store, mailer, now);
    expect(report.saleScan).toBe(true);
    const letters = await store.listOutbox();
    expect(letters.filter((letter) => letter.subject === "רכב בסף מכירה")).toHaveLength(2);
    expect(letters.some((letter) => letter.body.includes("22-222-22"))).toBe(true);
    expect((await store.findCar(oldId))?.status).toBe("available");
    expect((await store.findCar(oldId))?.saleAlertSentAt).not.toBeNull();

    await tickJobs(store, mailer, new Date(now.getTime() + 60_000));
    expect(await store.listOutbox()).toHaveLength(letters.length);
  });

  it("leaves a paid rental confirmed when the mailer fails", async () => {
    const store = await lot();
    const carId = await availableCar(store, {
      plate: "33-333-33",
      currentKm: 1000,
      purchasedAt: "2026-01-01",
    });
    const order = rental(carId, {
      status: "pending_payment",
      holdExpiresAt: new Date(now.getTime() + 60_000),
    });
    await store.insertRentalOrder(order);
    expectOk(
      await confirmPayment(
        store,
        { providerEventId: "evt_paid", orderId: order.id, outcome: "paid", providerRef: "pi_ok" },
        new FailingMailer(),
        now,
      ),
    );
    expect((await store.findRentalOrder(order.id))?.status).toBe("confirmed");
    const failed = (await store.listOutbox()).filter((letter) => letter.status === "failed");
    expect(failed.length).toBeGreaterThan(0);
    expect(failed.some((letter) => letter.body.includes("33-333-33"))).toBe(true);

    const mailer = new CollectingMailer();
    for (const letter of failed) {
      expectOk(await retryOutbox(store, mailer, yard, letter.id, now));
    }
    expect((await store.findRentalOrder(order.id))?.status).toBe("confirmed");
    expect((await store.listOutbox()).every((letter) => letter.status === "sent")).toBe(true);
  });

  it("sends one pickup reminder inside 24 hours and does not send it twice", async () => {
    const store = await lot();
    const dueCar = await availableCar(store, {
      plate: "44-444-44",
      currentKm: 1000,
      purchasedAt: "2026-01-01",
    });
    const earlyCar = await availableCar(store, {
      plate: "45-555-55",
      currentKm: 1000,
      purchasedAt: "2026-01-01",
    });
    const due = rental(dueCar, {
      number: "R-2026-00021",
      pickupAt: new Date(now.getTime() + 24 * HOUR_MS),
    });
    const early = rental(earlyCar, {
      number: "R-2026-00022",
      pickupAt: new Date(now.getTime() + 24 * HOUR_MS + 1),
    });
    await store.insertRentalOrder(due);
    await store.insertRentalOrder(early);
    const mailer = new CollectingMailer();
    const first = await tickJobs(store, mailer, now);
    expect(first.reminders).toBe(true);
    expect(mailer.sent.filter((letter) => letter.subject === "תזכורת לאיסוף")).toHaveLength(1);
    expect(mailer.sent[0]?.text).toContain("44-444-44");
    expect((await store.findRentalOrder(due.id))?.reminderSentAt).not.toBeNull();
    expect((await store.findRentalOrder(early.id))?.reminderSentAt).toBeNull();

    await tickJobs(store, mailer, new Date(now.getTime() + 30 * 60_000));
    expect(mailer.sent.filter((letter) => letter.subject === "תזכורת לאיסוף")).toHaveLength(1);
  });

  it("expires a hold on the tick and writes cancellation letters", async () => {
    const store = await lot();
    const heldCar = await availableCar(store, {
      plate: "55-555-55",
      currentKm: 1000,
      purchasedAt: "2026-01-01",
    });
    const paidCar = await availableCar(store, {
      plate: "56-666-66",
      currentKm: 1000,
      purchasedAt: "2026-01-01",
    });
    const held = rental(heldCar, {
      status: "pending_payment",
      holdExpiresAt: new Date(now.getTime() - 1000),
      number: "R-2026-00031",
    });
    await store.insertRentalOrder(held);
    const pickupAt = new Date(now.getTime() + 47 * HOUR_MS);
    const paid = rental(paidCar, { number: "R-2026-00032", pickupAt });
    await store.insertRentalOrder(paid);
    const mailer = new CollectingMailer();
    await tickJobs(store, mailer, now);
    expect((await store.findRentalOrder(held.id))?.status).toBe("expired");

    expectOk(
      await cancelRentalByCustomer(store, new FakePayments(), mailer, {
        orderId: paid.id,
        customerId,
        now,
      }),
    );
    const bodies = mailer.sent.map((letter) => letter.text);
    expect(bodies.some((text) => text.includes("50%"))).toBe(true);
    expect(mailer.sent.some((letter) => letter.subject === "השכרה בוטלה")).toBe(true);
    expect((await store.findRentalOrder(paid.id))?.status).toBe("cancelled");
  });

  it("rejects a tick without the job secret", async () => {
    const store = new MemoryStaffStore();
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
    const server: Server = createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", resolve);
    });
    const address = server.address();
    if (address === null || typeof address === "string") throw new Error("No port");
    const base = `http://127.0.0.1:${String(address.port)}`;
    try {
      const missing = await fetch(`${base}/api/jobs/tick`, { method: "POST" });
      expect(missing.status).toBe(401);
      const wrong = await fetch(`${base}/api/jobs/tick`, {
        method: "POST",
        headers: { Authorization: "Bearer other-secret" },
      });
      expect(wrong.status).toBe(401);
      const ok = await fetch(`${base}/api/jobs/tick`, {
        method: "POST",
        headers: { Authorization: "Bearer job-secret" },
      });
      expect(ok.status).toBe(200);
      expect(await ok.json()).toEqual({ ok: true, data: { reminders: true, saleScan: true } });
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error === undefined) resolve();
          else reject(error);
        });
      });
    }
  });

  it("writes a log letter to disk and hides a Resend failure", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "lot-mail-"));
    const log = new LogMailer(directory);
    await log.send({ to: "dana@lot.test", subject: "ההשכרה אושרה", text: "מספר הזמנה R-1" });
    const files = await readdir(directory);
    expect(files).toHaveLength(1);
    const file = files[0];
    if (file === undefined) throw new Error("Missing letter file");
    const text = await readFile(path.join(directory, file), "utf8");
    expect(text).toContain("dana@lot.test");
    expect(text).toContain("מספר הזמנה R-1");

    const previous = globalThis.fetch;
    globalThis.fetch = () => Promise.resolve(new Response("no", { status: 422 }));
    try {
      const resend = new ResendMailer("re_secret_key", "lot@example.com");
      await expect(
        resend.send({ to: "dana@lot.test", subject: "שלום", text: "גוף" }),
      ).rejects.toThrow("Resend returned 422");
    } finally {
      globalThis.fetch = previous;
    }
    expect(
      bootProblem({
        databaseUrl: "postgresql://lot:lot@localhost:5432/lot",
        staffJwtSecret: "staff-secret-must-be-32-characters",
        customerJwtSecret: "customer-secret-must-be-32-chars-x",
        stripeSecretKey: "sk_test_key",
        mailer: "resend",
        resendApiKey: "",
        mailFrom: "",
      }),
    ).toBe("RESEND_API_KEY and MAIL_FROM are required when MAILER=resend");
  });
});
