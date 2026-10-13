import { randomUUID } from "node:crypto";

import { err, ok, type Result } from "../domain/result.js";
import { parseLotDraft, type LotDraftInput } from "../domain/settings-fields.js";
import type { Geocoder } from "../geocoding/geocoder.js";
import type {
  JsonObject,
  LotRecord,
  SettingChangeRecord,
  StaffStore,
} from "../repositories/staff-store.js";
import { requirePermission } from "./login-staff.js";
import type { StaffActor } from "./staff-actor.js";

export type SettingChangeView = SettingChangeRecord & { staffName: string };

/** Lot settings. A yard employee is refused before any row is read. */
export async function readLotSettings(
  store: StaffStore,
  actor: StaffActor,
): Promise<Result<LotRecord>> {
  const allowed = requirePermission(actor.role, "settings.write");
  if (!allowed.ok) return allowed;
  const lot = await store.readLot();
  if (lot === null) throw new Error("Lot settings are missing");
  return ok(lot);
}

async function locate(
  geocoder: Geocoder,
  input: LotDraftInput,
): Promise<Result<{ latitude: number | null; longitude: number | null }>> {
  if (input.latitude !== null && input.longitude !== null) {
    return ok({ latitude: input.latitude, longitude: input.longitude });
  }
  const trimmed = input.address.trim();
  if (trimmed.length === 0) return ok({ latitude: input.latitude, longitude: input.longitude });
  const query = trimmed.includes("ישראל") ? trimmed : `${trimmed}, ישראל`;
  const point = await geocoder.geocode(query);
  if (point === null || point.countryCode !== "IL") return err("ADDRESS_NOT_FOUND");
  return ok({ latitude: point.lat, longitude: point.lng });
}

/** Saves the lot. Missing coordinates are filled from the address, and price changes share one history row. */
export async function updateLotSettings(
  store: StaffStore,
  geocoder: Geocoder,
  actor: StaffActor,
  input: LotDraftInput,
  now: Date,
): Promise<Result<LotRecord>> {
  const allowed = requirePermission(actor.role, "settings.write");
  if (!allowed.ok) return allowed;
  const located = await locate(geocoder, input);
  if (!located.ok) return located;
  const draft = parseLotDraft({ ...input, ...located.value });
  if (!draft.ok) return draft;
  const next = draft.value;
  return store.transaction(async (tx) => {
    const previous = await tx.readLot();
    if (previous === null) throw new Error("Lot settings are missing");
    await tx.writeLot(next);
    const changed =
      previous.kmPerDay !== next.kmPerDay ||
      previous.excessKmPriceAgorot !== next.excessKmPriceAgorot ||
      previous.fuelShortagePricePerLiterAgorot !== next.fuelShortagePricePerLiterAgorot;
    if (changed) {
      const previousJson: JsonObject = {
        kmPerDay: previous.kmPerDay,
        excessKmPriceAgorot: previous.excessKmPriceAgorot,
        fuelShortagePricePerLiterAgorot: previous.fuelShortagePricePerLiterAgorot,
      };
      const nextJson: JsonObject = {
        kmPerDay: next.kmPerDay,
        excessKmPriceAgorot: next.excessKmPriceAgorot,
        fuelShortagePricePerLiterAgorot: next.fuelShortagePricePerLiterAgorot,
      };
      await tx.insertSettingChange({
        id: randomUUID(),
        staffId: actor.id,
        createdAt: now,
        scope: "fleet_prices",
        entityId: null,
        previousJson,
        nextJson,
      });
    }
    return ok(next);
  });
}

/** History of fleet prices and insurance, newest first. */
export async function listSettingHistory(
  store: StaffStore,
  actor: StaffActor,
): Promise<Result<SettingChangeView[]>> {
  const allowed = requirePermission(actor.role, "settings.write");
  if (!allowed.ok) return allowed;
  const [changes, staff] = await Promise.all([store.listSettingChanges(), store.listStaff()]);
  const names = new Map(staff.map((person) => [person.id, person.fullName]));
  return ok(
    changes.slice(0, 100).map((change) => ({
      ...change,
      staffName: names.get(change.staffId) ?? "",
    })),
  );
}
