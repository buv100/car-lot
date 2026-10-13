import path from "node:path";
import { fileURLToPath } from "node:url";

import { createApp } from "./app.js";
import { bootProblem } from "./boot.js";
import { geocoderFromEnv } from "./geocoding/geocoder.js";
import { mailerFromEnv } from "./mail/mailer.js";
import { LocalTestPayments } from "./payments/provider.js";
import { StripePayments } from "./payments/stripe.js";
import { database } from "./repositories/database.js";
import { PrismaStaffStore } from "./repositories/prisma-staff-store.js";
import { DiskFileStore } from "./storage/file-store.js";

const staffJwtSecret = process.env.STAFF_JWT_SECRET ?? "";
const customerJwtSecret = process.env.CUSTOMER_JWT_SECRET ?? "";
const stripeSecretKey = process.env.STRIPE_SECRET_KEY ?? "";
const mailerMode = process.env.MAILER ?? "log";
const problem = bootProblem({
  databaseUrl: process.env.DATABASE_URL,
  staffJwtSecret,
  customerJwtSecret,
  stripeSecretKey,
  mailer: mailerMode,
  resendApiKey: process.env.RESEND_API_KEY ?? "",
  mailFrom: process.env.MAIL_FROM ?? "",
});
if (problem !== null) {
  console.error(problem);
  process.exit(1);
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

createApp({
  store: new PrismaStaffStore(database),
  files: new DiskFileStore(path.join(root, "uploads")),
  geocoder: geocoderFromEnv(),
  payments: stripeSecretKey.startsWith("sk_test_")
    ? new StripePayments(stripeSecretKey, process.env.STRIPE_WEBHOOK_SECRET ?? "")
    : new LocalTestPayments(),
  mailer: mailerFromEnv(path.join(root, "tmp", "mail"), {
    mailer: mailerMode,
    resendApiKey: process.env.RESEND_API_KEY ?? "",
    mailFrom: process.env.MAIL_FROM ?? "",
  }),
  now: () => new Date(),
  staffJwtSecret,
  customerJwtSecret,
  clientOrigin: process.env.CLIENT_ORIGIN ?? "http://localhost:5173",
  appUrl: process.env.APP_URL ?? "http://localhost:5173",
  secureCookies: process.env.NODE_ENV === "production",
  jobSecret: process.env.JOB_SECRET ?? "",
}).listen(4000);
