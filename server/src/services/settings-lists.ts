import { randomUUID } from "node:crypto";

import { agorot } from "../domain/money.js";
import { err, ok, type Result } from "../domain/result.js";
import {
  hasSingleActiveBase,
  parseHoliday,
  parseInsuranceDraft,
  parseTagName,
} from "../domain/settings-fields.js";
import { civilDateKey } from "../domain/time.js";
import {
  DuplicateRecord,
  type InsuranceRecord,
  type StaffStore,
  type TagRecord,
} from "../repositories/staff-store.js";
import { requirePermission } from "./login-staff.js";
import type { StaffActor } from "./staff-actor.js";

export type HolidayView = { id: string; date: string; name: string };

/** Holidays are manager settings. A date can appear once. */
export async function listHolidays(
  store: StaffStore,
  actor: StaffActor,
): Promise<Result<HolidayView[]>> {
  const allowed = requirePermission(actor.role, "settings.write");
  if (!allowed.ok) return allowed;
  const rows = await store.listHolidays();
  return ok(rows.map((row) => ({ id: row.id, name: row.name, date: civilDateKey(row.date) })));
}

/** Adds one holiday. */
export async function addHoliday(
  store: StaffStore,
  actor: StaffActor,
  name: string,
  date: string,
): Promise<Result<HolidayView>> {
  const allowed = requirePermission(actor.role, "settings.write");
  if (!allowed.ok) return allowed;
  const parsed = parseHoliday(name, date);
  if (!parsed.ok) return parsed;
  const id = randomUUID();
  try {
    await store.insertHoliday({ id, name: parsed.value.name, date: parsed.value.date });
  } catch (error: unknown) {
    if (error instanceof DuplicateRecord) return err("DUPLICATE");
    throw error;
  }
  return ok({ id, name: parsed.value.name, date: civilDateKey(parsed.value.date) });
}

/** Removes one holiday. */
export async function removeHoliday(
  store: StaffStore,
  actor: StaffActor,
  id: string,
): Promise<Result<void>> {
  const allowed = requirePermission(actor.role, "settings.write");
  if (!allowed.ok) return allowed;
  const removed = await store.deleteHoliday(id);
  if (!removed) return err("NOT_FOUND");
  return ok(undefined);
}

function insuranceJson(pack: InsuranceRecord): {
  name: string;
  description: string;
  dailyPriceAgorot: number;
  includedInBase: boolean;
  active: boolean;
  sortOrder: number;
} {
  return {
    name: pack.name,
    description: pack.description,
    dailyPriceAgorot: pack.dailyPriceAgorot,
    includedInBase: pack.includedInBase,
    active: pack.active,
    sortOrder: pack.sortOrder,
  };
}

async function rememberInsurance(
  store: StaffStore,
  actor: StaffActor,
  now: Date,
  entityId: string,
  previous: InsuranceRecord | null,
  next: InsuranceRecord,
): Promise<void> {
  await store.insertSettingChange({
    id: randomUUID(),
    staffId: actor.id,
    createdAt: now,
    scope: "insurance",
    entityId,
    previousJson: previous === null ? { created: true } : insuranceJson(previous),
    nextJson: insuranceJson(next),
  });
}

/** Insurance packages. Exactly one active base package remains after the write. */
export async function saveInsurance(
  store: StaffStore,
  actor: StaffActor,
  id: string | null,
  input: {
    name: string;
    description: string;
    dailyShekels: number;
    includedInBase: boolean;
    active: boolean;
    sortOrder: number;
  },
  now: Date,
): Promise<Result<InsuranceRecord>> {
  const allowed = requirePermission(actor.role, "settings.write");
  if (!allowed.ok) return allowed;
  if (!Number.isInteger(input.dailyShekels)) return err("INVALID_INPUT");
  const draft = parseInsuranceDraft({
    ...input,
    dailyPriceAgorot: agorot(input.dailyShekels),
  });
  if (!draft.ok) return draft;
  try {
    return await store.transaction(async (tx) => {
      const current = await tx.listInsurance();
      const previous = id === null ? null : (current.find((pack) => pack.id === id) ?? null);
      if (id !== null && previous === null) return err("NOT_FOUND");
      const saved: InsuranceRecord = { id: id ?? randomUUID(), ...draft.value };
      const projected = current
        .filter((pack) => pack.id !== saved.id)
        .map((pack) =>
          saved.includedInBase && saved.active && pack.includedInBase
            ? { ...pack, includedInBase: false }
            : pack,
        )
        .concat(saved);
      if (!hasSingleActiveBase(projected)) return err("INSURANCE_INVALID");
      for (const pack of projected) {
        if (pack.id === saved.id) continue;
        const before = current.find((item) => item.id === pack.id);
        if (before !== undefined && before.includedInBase !== pack.includedInBase) {
          await tx.updateInsurance(pack);
        }
      }
      if (previous === null) await tx.insertInsurance(saved);
      else await tx.updateInsurance(saved);
      await rememberInsurance(tx, actor, now, saved.id, previous, saved);
      return ok(saved);
    });
  } catch (error: unknown) {
    if (error instanceof DuplicateRecord) return err("INSURANCE_INVALID");
    throw error;
  }
}

/** Tags the car form may offer. Yard staff can read them; only a manager edits them. */
export async function listTagsForCars(
  store: StaffStore,
  actor: StaffActor,
): Promise<Result<TagRecord[]>> {
  const allowed = requirePermission(actor.role, "cars.write");
  if (!allowed.ok) return allowed;
  return ok(await store.listTags());
}

/** Creates or renames a tag, or turns it off. */
export async function saveTag(
  store: StaffStore,
  actor: StaffActor,
  id: string | null,
  name: string,
  active: boolean,
): Promise<Result<TagRecord>> {
  const allowed = requirePermission(actor.role, "settings.write");
  if (!allowed.ok) return allowed;
  const parsed = parseTagName(name);
  if (!parsed.ok) return parsed;
  const saved: TagRecord = { id: id ?? randomUUID(), name: parsed.value, active };
  try {
    if (id === null) await store.insertTag(saved);
    else {
      const existing = (await store.listTags()).find((tag) => tag.id === id);
      if (existing === undefined) return err("NOT_FOUND");
      await store.updateTag(saved);
    }
  } catch (error: unknown) {
    if (error instanceof DuplicateRecord) return err("DUPLICATE");
    throw error;
  }
  return ok(saved);
}
