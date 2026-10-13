import { type Agorot } from "./money.js";
import { err, ok, type Result } from "./result.js";
import { parseCivilDate, type CivilDate } from "./time.js";

/** Lot record the manager edits. Fleet prices stay in agorot. */
export type LotDraft = {
  readonly name: string;
  readonly address: string;
  readonly latitude: number | null;
  readonly longitude: number | null;
  readonly phone: string;
  readonly publicEmail: string;
  readonly staffAlertEmail: string;
  readonly kmPerDay: number;
  readonly excessKmPriceAgorot: Agorot;
  readonly fuelShortagePricePerLiterAgorot: Agorot;
};

export type LotDraftInput = {
  readonly name: string;
  readonly address: string;
  readonly latitude: number | null;
  readonly longitude: number | null;
  readonly phone: string;
  readonly publicEmail: string;
  readonly staffAlertEmail: string;
  readonly kmPerDay: number;
  readonly excessKmPriceAgorot: Agorot;
  readonly fuelShortagePricePerLiterAgorot: Agorot;
};

/** Stored lowercase. Null when the address is not an email. */
export function normalizeEmail(email: string): string | null {
  const value = email.trim().toLowerCase();
  if (value.length > 200 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return null;
  return value;
}

function optionalEmail(email: string): string | null {
  const trimmed = email.trim();
  if (trimmed.length === 0) return "";
  return normalizeEmail(trimmed);
}

function coordinatePair(latitude: number | null, longitude: number | null): boolean {
  if (latitude === null && longitude === null) return true;
  if (latitude === null || longitude === null) return false;
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

/** Manager settings form. An empty name is allowed and the site then shows «המגרש». */
export function parseLotDraft(input: LotDraftInput): Result<LotDraft> {
  const name = input.name.trim();
  const address = input.address.trim();
  const phone = input.phone.trim();
  const publicEmail = optionalEmail(input.publicEmail);
  const staffAlertEmail = optionalEmail(input.staffAlertEmail);
  if (
    name.length > 80 ||
    address.length > 200 ||
    phone.length > 30 ||
    publicEmail === null ||
    staffAlertEmail === null ||
    !coordinatePair(input.latitude, input.longitude) ||
    !Number.isInteger(input.kmPerDay) ||
    input.kmPerDay < 1 ||
    !Number.isInteger(input.excessKmPriceAgorot) ||
    input.excessKmPriceAgorot < 0 ||
    !Number.isInteger(input.fuelShortagePricePerLiterAgorot) ||
    input.fuelShortagePricePerLiterAgorot < 0
  ) {
    return err("INVALID_INPUT");
  }
  return ok({
    name,
    address,
    latitude: input.latitude,
    longitude: input.longitude,
    phone,
    publicEmail,
    staffAlertEmail,
    kmPerDay: input.kmPerDay,
    excessKmPriceAgorot: input.excessKmPriceAgorot,
    fuelShortagePricePerLiterAgorot: input.fuelShortagePricePerLiterAgorot,
  });
}

/** Holiday name and a unique Jerusalem calendar date. */
export function parseHoliday(
  name: string,
  date: string,
): Result<{ name: string; date: CivilDate }> {
  const trimmed = name.trim();
  const civil = parseCivilDate(date);
  if (trimmed.length < 2 || trimmed.length > 80 || civil === null) return err("INVALID_INPUT");
  return ok({ name: trimmed, date: civil });
}

/** Tag name. Inactive tags stay on cars that already have them. */
export function parseTagName(name: string): Result<string> {
  const trimmed = name.trim();
  if (trimmed.length < 2 || trimmed.length > 40) return err("INVALID_INPUT");
  return ok(trimmed);
}

export type InsuranceDraft = {
  readonly name: string;
  readonly description: string;
  readonly dailyPriceAgorot: Agorot;
  readonly includedInBase: boolean;
  readonly active: boolean;
  readonly sortOrder: number;
};

/** One insurance package. The base package is free and there can be only one active base. */
export function parseInsuranceDraft(input: {
  readonly name: string;
  readonly description: string;
  readonly dailyPriceAgorot: Agorot;
  readonly includedInBase: boolean;
  readonly active: boolean;
  readonly sortOrder: number;
}): Result<InsuranceDraft> {
  const name = input.name.trim();
  const description = input.description.trim();
  if (name.length < 1 || name.length > 80 || description.length > 400) return err("INVALID_INPUT");
  if (!Number.isInteger(input.dailyPriceAgorot) || input.dailyPriceAgorot < 0) {
    return err("INVALID_INPUT");
  }
  if (!Number.isInteger(input.sortOrder) || input.sortOrder < 0 || input.sortOrder > 1000) {
    return err("INVALID_INPUT");
  }
  if (input.includedInBase && (input.dailyPriceAgorot !== 0 || !input.active)) {
    return err("INSURANCE_INVALID");
  }
  return ok({
    name,
    description,
    dailyPriceAgorot: input.dailyPriceAgorot,
    includedInBase: input.includedInBase,
    active: input.active,
    sortOrder: input.sortOrder,
  });
}

/** After a write there is still exactly one active base package. */
export function hasSingleActiveBase(
  packages: readonly { readonly includedInBase: boolean; readonly active: boolean }[],
): boolean {
  return packages.filter((item) => item.includedInBase && item.active).length === 1;
}

/** Staff display name. Email and password are checked separately. */
export function parsePersonName(name: string): Result<string> {
  const trimmed = name.trim();
  if (trimmed.length < 2 || trimmed.length > 80) return err("INVALID_INPUT");
  return ok(trimmed);
}
