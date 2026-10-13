import { randomUUID } from "node:crypto";

import { can } from "../domain/permissions.js";
import { err, ok, type Result } from "../domain/result.js";
import { parseHoliday } from "../domain/settings-fields.js";
import type { HolidayRecord, StaffStore } from "../repositories/staff-store.js";
import { asDuplicate } from "./duplicate.js";
import type { StaffActor } from "./staff-actor.js";

/** Holiday dates are manager data. A yard employee is refused before the list is read. */
export async function listHolidays(
  store: StaffStore,
  actor: StaffActor,
): Promise<Result<HolidayRecord[]>> {
  if (!can(actor.role, "settings.write")) return err("FORBIDDEN");
  return ok(await store.listHolidays());
}

/** One calendar day, one name. A repeated date is DUPLICATE. */
export async function addHoliday(
  store: StaffStore,
  actor: StaffActor,
  name: string,
  date: string,
): Promise<Result<HolidayRecord>> {
  if (!can(actor.role, "settings.write")) return err("FORBIDDEN");
  const parsed = parseHoliday(name, date);
  if (!parsed.ok) return parsed;
  const holiday = { id: randomUUID(), name: parsed.value.name, date: parsed.value.date };
  const saved = await asDuplicate(() => store.insertHoliday(holiday));
  if (!saved.ok) return saved;
  return ok(holiday);
}

/** Removes one holiday. Pricing of orders already paid is not recalculated here. */
export async function removeHoliday(
  store: StaffStore,
  actor: StaffActor,
  holidayId: string,
): Promise<Result<void>> {
  if (!can(actor.role, "settings.write")) return err("FORBIDDEN");
  const removed = await store.deleteHoliday(holidayId);
  if (!removed) return err("NOT_FOUND");
  return ok(undefined);
}
