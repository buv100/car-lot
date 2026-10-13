import { beforeAll, describe, expect, it } from "vitest";

import { agorot } from "../domain/money.js";
import { expectErr, expectOk } from "../domain/testing.js";
import { FakeGeocoder } from "../geocoding/geocoder.js";
import { CollectingMailer } from "../mail/mailer.js";
import { MemoryStaffStore } from "../repositories/memory-staff-store.js";
import { MemoryFileStore } from "../storage/file-store.js";
import { adjustKm } from "./adjust-km.js";
import { addCarPhoto } from "./car-photos.js";
import { changeCarStatus } from "./car-status.js";
import { createCar } from "./cars.js";
import { createStaffAccount, updateStaffAccount } from "./staff-accounts.js";
import { loginStaff } from "./login-staff.js";
import { listSettingHistory, readLotSettings, updateLotSettings } from "./lot-settings.js";
import { hashPassword } from "./passwords.js";
import { saveAgeBands } from "./save-age-bands.js";
import type { StaffActor } from "./staff-actor.js";
import { createTag, updateTag } from "./tags.js";

const now = new Date("2026-10-08T09:00:00.000Z");
const mailer = new CollectingMailer();
const manager: StaffActor = { id: "11111111-1111-4111-8111-111111111111", role: "manager" };
const yard: StaffActor = { id: "22222222-2222-4222-8222-222222222222", role: "yard" };
const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0x00]);

const draft = {
  plate: "12-345-67",
  vin: null,
  make: "יונדאי",
  model: "i10",
  year: 2024,
  color: "לבן",
  primaryType: "mini",
  seats: 5,
  currentKm: 1200,
  purchasedAt: "2024-03-01",
  internalNotes: "",
  tagIds: [] as string[],
};

describe("stage 3 staff desk", () => {
  let passwordHash = "";

  beforeAll(async () => {
    passwordHash = await hashPassword("manager123");
  });

  it("refuses available until there is a photo, a minimum age, and a price band", async () => {
    const store = new MemoryStaffStore();
    const files = new MemoryFileStore();
    const created = expectOk(await createCar(store, yard, { ...draft, minAge: null }, now));

    expectErr(
      await changeCarStatus(store, yard, created.id, { to: "available" }, now),
      "CAR_NOT_READY",
    );

    expectOk(await addCarPhoto(store, files, yard, created.id, "מבט קדמי", jpeg, now));
    expectErr(
      await changeCarStatus(store, yard, created.id, { to: "available" }, now),
      "CAR_NOT_READY",
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
    const published = expectOk(
      await changeCarStatus(store, yard, created.id, { to: "available" }, now),
    );
    expect(published.status).toBe("available");
  });

  it("rejects a yard employee who opens settings directly", async () => {
    const store = new MemoryStaffStore();
    const geocoder = new FakeGeocoder();
    expectErr(await readLotSettings(store, yard), "FORBIDDEN");
    expectErr(
      await updateLotSettings(
        store,
        geocoder,
        yard,
        {
          name: "המגרש",
          address: "32.07,34.78",
          latitude: null,
          longitude: null,
          phone: "03-5555555",
          publicEmail: "hello@lot.test",
          staffAlertEmail: "desk@lot.test",
          kmPerDay: 200,
          excessKmPriceAgorot: agorot(2),
          fuelShortagePricePerLiterAgorot: agorot(8),
        },
        now,
      ),
      "FORBIDDEN",
    );
    expectErr(
      await createStaffAccount(store, yard, {
        fullName: "עובד חדש",
        email: "new@lot.test",
        password: "yard12345",
        role: "yard",
      }),
      "FORBIDDEN",
    );
  });

  it("records the previous fleet prices when a manager changes them", async () => {
    const store = new MemoryStaffStore();
    const saved = expectOk(
      await updateLotSettings(
        store,
        new FakeGeocoder(),
        manager,
        {
          name: "מגרש הדקל",
          address: "32.07,34.78",
          latitude: null,
          longitude: null,
          phone: "03-5555555",
          publicEmail: "hello@lot.test",
          staffAlertEmail: "desk@lot.test",
          kmPerDay: 300,
          excessKmPriceAgorot: agorot(3),
          fuelShortagePricePerLiterAgorot: agorot(9),
        },
        now,
      ),
    );
    expect(saved.latitude).toBe(32.07);
    expect(saved.longitude).toBe(34.78);
    const history = expectOk(await listSettingHistory(store, manager));
    expect(history).toHaveLength(1);
    expect(history[0]?.previousJson).toEqual({
      kmPerDay: 250,
      excessKmPriceAgorot: 200,
      fuelShortagePricePerLiterAgorot: 800,
    });
    expect(history[0]?.staffId).toBe(manager.id);
  });

  it("keeps the last active manager and rejects a bad or inactive login", async () => {
    const store = new MemoryStaffStore();
    await store.insertStaff({
      id: manager.id,
      fullName: "מנהל",
      email: "boss@lot.test",
      passwordHash,
      role: "manager",
      active: true,
    });
    const yardAccount = expectOk(
      await createStaffAccount(store, manager, {
        fullName: "עובד מגרש",
        email: "yard@lot.test",
        password: "yard12345",
        role: "yard",
      }),
    );
    expectErr(
      await updateStaffAccount(store, manager, manager.id, {
        fullName: "מנהל",
        email: "boss@lot.test",
        role: "yard",
        active: true,
        password: null,
      }),
      "LAST_MANAGER",
    );
    expectOk(
      await updateStaffAccount(store, manager, yardAccount.id, {
        fullName: "עובד מגרש",
        email: "yard@lot.test",
        role: "yard",
        active: false,
        password: null,
      }),
    );
    expectErr(await loginStaff(store, "yard@lot.test", "yard12345"), "INVALID_CREDENTIALS");
    expectErr(await loginStaff(store, "boss@lot.test", "wrong-pass-1"), "INVALID_CREDENTIALS");
    expect(expectOk(await loginStaff(store, "boss@lot.test", "manager123")).role).toBe("manager");
  });

  it("does not let a car pick up an inactive tag", async () => {
    const store = new MemoryStaffStore();
    const tag = expectOk(await createTag(store, manager, "חשמלי"));
    expectOk(await updateTag(store, manager, tag.id, "חשמלי", false));
    const result = await createCar(store, yard, { ...draft, minAge: null, tagIds: [tag.id] }, now);
    expectErr(result, "INACTIVE_TAG");
  });

  it("blocks care while a rental is still open", async () => {
    const store = new MemoryStaffStore();
    const files = new MemoryFileStore();
    const created = expectOk(await createCar(store, yard, { ...draft, minAge: null }, now));
    expectOk(await addCarPhoto(store, files, yard, created.id, "צד", jpeg, now));
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
    store.seedRental(created.id, "confirmed", null);
    expectErr(
      await changeCarStatus(store, yard, created.id, { to: "in_care", careReason: "wash" }, now),
      "OPEN_RENTAL",
    );
  });

  it("lets only a manager correct kilometres, and keeps the reason", async () => {
    const store = new MemoryStaffStore();
    const created = expectOk(await createCar(store, yard, { ...draft, minAge: null }, now));
    expectErr(await adjustKm(store, yard, created.id, 900, "תיקון מד", now, mailer), "FORBIDDEN");
    const corrected = expectOk(
      await adjustKm(store, manager, created.id, 900, "תיקון מד", now, mailer),
    );
    expect(corrected.currentKm).toBe(900);
    expectErr(await adjustKm(store, manager, created.id, 800, "ק", now, mailer), "INVALID_INPUT");
  });
});
