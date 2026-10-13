import { err, ok, type Result } from "./result.js";
import { CAR_TYPES, type CarType } from "./status.js";
import { jerusalemDate, parseCivilDate, type CivilDate } from "./time.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Identity fields an employee may set. Kilometres after creation are a separate correction. */
export type CarDraft = {
  readonly plate: string;
  readonly vin: string | null;
  readonly make: string;
  readonly model: string;
  readonly year: number;
  readonly color: string;
  readonly primaryType: CarType;
  readonly seats: number;
  readonly currentKm: number;
  readonly purchasedAt: CivilDate;
  readonly internalNotes: string;
  readonly tagIds: readonly string[];
};

export type CarDraftInput = {
  readonly plate: string;
  readonly vin: string | null;
  readonly make: string;
  readonly model: string;
  readonly year: number;
  readonly color: string;
  readonly primaryType: string;
  readonly seats: number;
  readonly currentKm: number;
  readonly purchasedAt: string;
  readonly internalNotes: string;
  readonly tagIds: readonly string[];
};

function trimmed(value: string, max: number): string | null {
  const text = value.trim();
  if (text.length === 0 || text.length > max) return null;
  return text;
}

function isCarType(value: string): value is CarType {
  for (const type of CAR_TYPES) {
    if (type === value) return true;
  }
  return false;
}

/** True for the ids this service generates. Rejects anything that could change a file path. */
export function isUuid(value: string): boolean {
  return UUID.test(value);
}

/** Checks the car form. The year window follows the Jerusalem calendar, not the host clock. */
export function parseCarDraft(input: CarDraftInput, now: Date): Result<CarDraft> {
  const plate = trimmed(input.plate, 16);
  const make = trimmed(input.make, 40);
  const model = trimmed(input.model, 40);
  const color = trimmed(input.color, 40);
  const purchasedAt = parseCivilDate(input.purchasedAt);
  const notes = input.internalNotes.trim();
  const vinText = input.vin?.trim() ?? "";
  if (
    plate === null ||
    make === null ||
    model === null ||
    color === null ||
    purchasedAt === null ||
    notes.length > 2000 ||
    vinText.length > 17
  ) {
    return err("INVALID_INPUT");
  }
  if (!isCarType(input.primaryType)) return err("INVALID_INPUT");
  const latestYear = jerusalemDate(now).year + 1;
  if (!Number.isInteger(input.year) || input.year < 1990 || input.year > latestYear) {
    return err("INVALID_INPUT");
  }
  if (!Number.isInteger(input.seats) || input.seats < 2 || input.seats > 9) {
    return err("INVALID_INPUT");
  }
  if (!Number.isInteger(input.currentKm) || input.currentKm < 0) return err("INVALID_INPUT");
  if (input.tagIds.length > 20 || input.tagIds.some((tagId) => !isUuid(tagId))) {
    return err("INVALID_INPUT");
  }
  return ok({
    plate,
    vin: vinText.length === 0 ? null : vinText,
    make,
    model,
    year: input.year,
    color,
    primaryType: input.primaryType,
    seats: input.seats,
    currentKm: input.currentKm,
    purchasedAt,
    internalNotes: notes,
    tagIds: input.tagIds,
  });
}

/** Minimum driving age on a car, or null while the car is still being prepared. */
export function parseMinAge(value: number | null): Result<number | null> {
  if (value === null) return ok(null);
  if (!Number.isInteger(value) || value < 16 || value > 99) return err("INVALID_INPUT");
  return ok(value);
}
