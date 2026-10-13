import { errorText } from "../copy";

export type ApiSuccess<T> = { ok: true; data: T };
export type ApiFailure = { ok: false; error: string };
export type ApiResult<T> = ApiSuccess<T> | ApiFailure;

export type StaffSession = {
  id: string;
  fullName: string;
  email: string;
  role: "yard" | "manager";
  permissions: string[];
};

export type Tag = { id: string; name: string; active: boolean };

export type CarPhoto = { id: string; alt: string; sortOrder: number; url: string };

export type AgeBand = {
  id: string;
  minAge: number;
  maxAge: number | null;
  weekdayShekels: number;
  weekendShekels: number;
  holidayShekels: number;
};

export type StaffCar = {
  id: string;
  plate: string;
  vin: string | null;
  make: string;
  model: string;
  year: number;
  color: string;
  primaryType: string;
  seats: number;
  currentKm: number;
  purchasedAt: string;
  minAge: number | null;
  status: string;
  careReason: string | null;
  internalNotes: string;
  tags: Tag[];
  photos: { id: string; alt: string; sortOrder: number }[];
  ageBands: {
    id: string;
    minAge: number;
    maxAge: number | null;
    weekdayDailyAgorot: number;
    weekendDailyAgorot: number;
    holidayDailyAgorot: number;
  }[];
};

export type LotSettings = {
  name: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  phone: string;
  publicEmail: string;
  staffAlertEmail: string;
  kmPerDay: number;
  excessKmShekels: number;
  fuelShekels: number;
};

export type Holiday = { id: string; name: string; date: string };

export type InsurancePackage = {
  id: string;
  name: string;
  description: string;
  dailyShekels: number;
  includedInBase: boolean;
  active: boolean;
  sortOrder: number;
};

export type StaffAccount = {
  id: string;
  fullName: string;
  email: string;
  role: "yard" | "manager";
  active: boolean;
};

export type SettingChange = {
  id: string;
  staffId: string;
  staffName?: string;
  createdAt: string;
  scope: string;
  entityId: string | null;
  previous: Record<string, string | number | boolean | null>;
  next: Record<string, string | number | boolean | null>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isResult<T>(value: unknown): value is ApiResult<T> {
  if (!isRecord(value) || typeof value.ok !== "boolean") return false;
  if (value.ok) return "data" in value;
  return typeof value.error === "string";
}

/** Sends cookies. The staff JWT stays in an httpOnly cookie. */
export async function api<T>(path: string, init?: RequestInit): Promise<ApiResult<T>> {
  const headers = new Headers(init?.headers);
  if (init?.body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  let response: Response;
  try {
    response = await fetch(path, { ...init, headers, credentials: "include" });
  } catch {
    return { ok: false, error: "INTERNAL" };
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return { ok: false, error: "INTERNAL" };
  }
  if (!isResult<T>(body)) return { ok: false, error: "INTERNAL" };
  return body;
}

export type RentalDesk = {
  id: string;
  number: string;
  carId: string;
  plate: string;
  make: string;
  model: string;
  status: string;
  pickupAt: string;
  returnAt: string;
  totalAgorot: number;
  kmAllowance: number;
  startKm: number | null;
  noShow: boolean;
  refundPercent: number | null;
  refundAgorot: number | null;
};

export type ChargePreview = {
  kmExcess: number;
  kmChargeAgorot: number;
  fuelChargeAgorot: number;
};

export type SaleDesk = {
  id: string;
  number: string;
  carId: string;
  plate: string;
  make: string;
  model: string;
  status: string;
  listPriceAgorot: number;
  depositAgorot: number;
  refundApproved: boolean | null;
  handoverAt: string | null;
};

export type StaffBoard = {
  awaitingHandover: RentalDesk[];
  openChecklists: RentalDesk[];
  cancellations: RentalDesk[];
  saleThreshold: {
    id: string;
    plate: string;
    make: string;
    model: string;
    currentKm: number;
    status: string;
  }[];
  failedMail?: { id: string; to: string; subject: string; lastError: string }[];
};

export function failureText(result: ApiFailure): string {
  return errorText(result.error);
}
