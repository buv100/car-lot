import { createServer, type Server } from "node:http";

import { describe, expect, it } from "vitest";

import { createApp } from "../app.js";
import { signStaffToken } from "../http/staff-token.js";
import { FakeGeocoder } from "../geocoding/geocoder.js";
import { CollectingMailer } from "../mail/mailer.js";
import { FakePayments } from "../payments/fake-payments.js";
import { MemoryStaffStore } from "../repositories/memory-staff-store.js";
import { hashPassword } from "../services/passwords.js";
import { MemoryFileStore } from "../storage/file-store.js";

const secret = "test-staff-secret-must-be-32b-long";

async function listen(): Promise<{ server: Server; base: string; store: MemoryStaffStore }> {
  const store = new MemoryStaffStore();
  const app = createApp({
    store,
    files: new MemoryFileStore(),
    geocoder: new FakeGeocoder(),
    payments: new FakePayments(),
    mailer: new CollectingMailer(),
    staffJwtSecret: secret,
    customerJwtSecret: "test-customer-secret-32-characters-x",
    clientOrigin: "http://localhost:5173",
    appUrl: "http://localhost:5173",
    secureCookies: false,
    jobSecret: "job-secret",
    now: () => new Date("2026-10-08T09:00:00.000Z"),
  });
  const server = createServer(app);
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("No port");
  return { server, base: `http://127.0.0.1:${address.port}`, store };
}

function cookieFrom(response: Response): string {
  const header = response.headers.get("set-cookie");
  if (header === null) throw new Error("Missing cookie");
  const first = header.split(";")[0];
  if (first === undefined) throw new Error("Missing cookie");
  return first;
}

describe("staff HTTP", () => {
  it("returns 403 when a yard token asks for settings, even if the token claims manager", async () => {
    const { server, base, store } = await listen();
    try {
      const yardId = "33333333-3333-4333-8333-333333333333";
      await store.insertStaff({
        id: yardId,
        fullName: "עובד",
        email: "yard@lot.test",
        passwordHash: await hashPassword("yard12345"),
        role: "yard",
        active: true,
      });
      const login = await fetch(`${base}/api/staff/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "yard@lot.test", password: "yard12345" }),
      });
      expect(login.status).toBe(200);
      const settings = await fetch(`${base}/api/staff/settings`, {
        headers: { cookie: cookieFrom(login) },
      });
      expect(settings.status).toBe(403);
      const body: unknown = await settings.json();
      expect(body).toEqual({ ok: false, error: "FORBIDDEN" });

      const forged = signStaffToken(secret, yardId, "manager");
      const direct = await fetch(`${base}/api/staff/settings`, {
        headers: { cookie: `staff_token=${forged}` },
      });
      expect(direct.status).toBe(403);
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
