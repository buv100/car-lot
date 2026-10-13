import type { Geocoder } from "../geocoding/geocoder.js";
import type { Mailer } from "../mail/mailer.js";
import type { PaymentProvider } from "../payments/provider.js";
import type { StaffStore } from "../repositories/staff-store.js";
import type { FileStore } from "../storage/file-store.js";

/** What the process wires into Express. Tests pass an in-memory lot. */
export type AppDeps = {
  readonly store: StaffStore;
  readonly files: FileStore;
  readonly geocoder: Geocoder;
  readonly payments: PaymentProvider;
  readonly mailer: Mailer;
  readonly staffJwtSecret: string;
  readonly customerJwtSecret: string;
  readonly clientOrigin: string;
  readonly appUrl: string;
  readonly secureCookies: boolean;
  readonly jobSecret: string;
  readonly now: () => Date;
};
