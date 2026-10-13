import type { Geocoder } from "../geocoding/geocoder.js";
import type { Mailer } from "../mail/mailer.js";
import type { PaymentProvider } from "../payments/provider.js";
import type { StaffStore } from "../repositories/staff-store.js";
import type { FileStore } from "../storage/file-store.js";

/** Dependencies the HTTP layer is allowed to call. Tests pass fakes here. */
export type AppContext = {
  store: StaffStore;
  files: FileStore;
  geocoder: Geocoder;
  payments: PaymentProvider;
  mailer: Mailer;
  now: () => Date;
  staffJwtSecret: string;
  customerJwtSecret: string;
  clientOrigin: string;
  appUrl: string;
  secureCookies: boolean;
  jobSecret: string;
};
