import { describe, expect, it } from "vitest";

import { createApp } from "./app.js";
import { MemoryStaffStore } from "./repositories/memory-staff-store.js";
import { FakeGeocoder } from "./geocoding/geocoder.js";
import { CollectingMailer } from "./mail/mailer.js";
import { FakePayments } from "./payments/fake-payments.js";
import { MemoryFileStore } from "./storage/file-store.js";

describe("createApp", () => {
  it("returns an Express application", () => {
    const app = createApp({
      store: new MemoryStaffStore(),
      files: new MemoryFileStore(),
      geocoder: new FakeGeocoder(),
      payments: new FakePayments(),
      mailer: new CollectingMailer(),
      now: () => new Date("2026-10-07T05:00:00.000Z"),
      staffJwtSecret: "test-staff-secret-with-32-characters",
      customerJwtSecret: "test-customer-secret-32-characters-x",
      clientOrigin: "http://localhost:5173",
      appUrl: "http://localhost:5173",
      secureCookies: false,
      jobSecret: "job-secret",
    });
    expect(typeof app.disable).toBe("function");
  });
});
