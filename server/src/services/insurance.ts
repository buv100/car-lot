import { randomUUID } from "node:crypto";

import { can } from "../domain/permissions.js";
import { err, ok, type Result } from "../domain/result.js";
import {
  hasSingleActiveBase,
  parseInsuranceDraft,
  type InsuranceDraft,
} from "../domain/settings-fields.js";
import type { InsuranceRecord, JsonObject, StaffStore } from "../repositories/staff-store.js";
import type { StaffActor } from "./staff-actor.js";

function snapshot(pack: InsuranceRecord): JsonObject {
  return {
    name: pack.name,
    description: pack.description,
    dailyPriceAgorot: pack.dailyPriceAgorot,
    includedInBase: pack.includedInBase,
    active: pack.active,
    sortOrder: pack.sortOrder,
  };
}

function createdSnapshot(): JsonObject {
  return { none: true };
}

/** Insurance is part of manager settings, so yard staff cannot list it. */
export async function listInsurance(
  store: StaffStore,
  actor: StaffActor,
): Promise<Result<InsuranceRecord[]>> {
  if (!can(actor.role, "settings.write")) return err("FORBIDDEN");
  return ok(await store.listInsurance());
}

function project(all: readonly InsuranceRecord[], next: InsuranceRecord): InsuranceRecord[] {
  const replaced = all.some((item) => item.id === next.id)
    ? all.map((item) => (item.id === next.id ? next : item))
    : [...all, next];
  if (!next.includedInBase || !next.active) return replaced;
  return replaced.map((item) => (item.id === next.id ? item : { ...item, includedInBase: false }));
}

/** Creates or updates one package and records the previous values. Exactly one active base remains. */
export async function saveInsurance(
  store: StaffStore,
  actor: StaffActor,
  packageId: string | null,
  input: InsuranceDraft,
  now: Date,
): Promise<Result<InsuranceRecord[]>> {
  if (!can(actor.role, "settings.write")) return err("FORBIDDEN");
  const parsed = parseInsuranceDraft(input);
  if (!parsed.ok) return parsed;
  return store.transaction(async (tx) => {
    const all = await tx.listInsurance();
    const current = packageId === null ? null : (all.find((item) => item.id === packageId) ?? null);
    if (packageId !== null && current === null) return err("NOT_FOUND");
    const id = packageId ?? randomUUID();
    const next: InsuranceRecord = { ...parsed.value, id };
    const projected = project(all, next);
    if (!hasSingleActiveBase(projected)) return err("INSURANCE_INVALID");
    if (next.includedInBase && next.active) {
      for (const item of all) {
        if (item.id !== id && item.includedInBase) {
          const cleared = { ...item, includedInBase: false };
          await tx.updateInsurance(cleared);
          await tx.insertSettingChange({
            id: randomUUID(),
            staffId: actor.id,
            createdAt: now,
            scope: "insurance",
            entityId: item.id,
            previousJson: snapshot(item),
            nextJson: snapshot(cleared),
          });
        }
      }
    }
    if (current === null) await tx.insertInsurance(next);
    else await tx.updateInsurance(next);
    await tx.insertSettingChange({
      id: randomUUID(),
      staffId: actor.id,
      createdAt: now,
      scope: "insurance",
      entityId: id,
      previousJson: current === null ? createdSnapshot() : snapshot(current),
      nextJson: snapshot(next),
    });
    return ok(projected.sort((left, right) => left.sortOrder - right.sortOrder));
  });
}
