import { err, ok, type Result } from "../domain/result.js";
import type { Geocoder } from "../geocoding/geocoder.js";
import type {
  InsuranceRecord,
  LotRecord,
  StaffStore,
  TagRecord,
} from "../repositories/staff-store.js";
import { requirePermission } from "./login-staff.js";
import { listSettingHistory, type SettingChangeView } from "./lot-settings.js";
import type { StaffActor } from "./staff-actor.js";
import { listHolidays, type HolidayView } from "./settings-lists.js";

export type { SettingChangeView };

export type SettingsBundle = {
  lot: LotRecord;
  holidays: HolidayView[];
  insurance: InsuranceRecord[];
  tags: TagRecord[];
  history: SettingChangeView[];
};

/** Suggests coordinates. The manager still saves them with the lot form. */
export async function geocodeLotAddress(
  geocoder: Geocoder,
  actor: StaffActor,
  address: string,
): Promise<Result<{ lat: number; lng: number; formattedAddress: string }>> {
  const allowed = requirePermission(actor.role, "settings.write");
  if (!allowed.ok) return allowed;
  const trimmed = address.trim();
  if (trimmed.length < 2) return err("INVALID_INPUT");
  const query = trimmed.includes("ישראל") ? trimmed : `${trimmed}, ישראל`;
  const point = await geocoder.geocode(query);
  if (point === null || point.countryCode !== "IL") return err("ADDRESS_NOT_FOUND");
  return ok({ lat: point.lat, lng: point.lng, formattedAddress: point.formattedAddress });
}

/** Manager desk: lot, holidays, insurance, tags, and price history. */
export async function readSettings(
  store: StaffStore,
  actor: StaffActor,
): Promise<Result<SettingsBundle>> {
  const history = await listSettingHistory(store, actor);
  if (!history.ok) return history;
  const holidays = await listHolidays(store, actor);
  if (!holidays.ok) return holidays;
  const lot = await store.readLot();
  if (lot === null) throw new Error("Lot settings are missing");
  const [insurance, tags] = await Promise.all([store.listInsurance(), store.listTags()]);
  return ok({ lot, holidays: holidays.value, insurance, tags, history: history.value });
}
