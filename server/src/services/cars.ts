import { randomUUID } from "node:crypto";

import { parseCarDraft, parseMinAge, type CarDraftInput } from "../domain/car-fields.js";
import { err, ok, type Result } from "../domain/result.js";
import type { StaffStore } from "../repositories/staff-store.js";
import { asDuplicate } from "./duplicate.js";
import { requirePermission } from "./login-staff.js";
import type { StaffActor } from "./staff-actor.js";
import {
  assignableTags,
  blankSale,
  presentCar,
  toCarWrite,
  type StaffCarView,
} from "./car-view.js";

async function viewOf(store: StaffStore, id: string, now: Date): Promise<StaffCarView | null> {
  const car = await store.findCar(id);
  if (car === null) return null;
  const [tags, rentals] = await Promise.all([store.listTags(), store.listRentals(id)]);
  return presentCar(car, tags, rentals, now);
}

/** Cars for the yard desk, newest identity fields included. */
export async function listStaffCars(
  store: StaffStore,
  actor: StaffActor,
  now: Date,
): Promise<Result<StaffCarView[]>> {
  const allowed = requirePermission(actor.role, "cars.write");
  if (!allowed.ok) return allowed;
  const [cars, tags] = await Promise.all([store.listCars(), store.listTags()]);
  const views: StaffCarView[] = [];
  for (const car of cars) {
    views.push(presentCar(car, tags, await store.listRentals(car.id), now));
  }
  return ok(views);
}

/** One car for editing. Missing cars are not found. */
export async function getStaffCar(
  store: StaffStore,
  actor: StaffActor,
  id: string,
  now: Date,
): Promise<Result<StaffCarView>> {
  const allowed = requirePermission(actor.role, "cars.write");
  if (!allowed.ok) return allowed;
  const view = await viewOf(store, id, now);
  if (view === null) return err("NOT_FOUND");
  return ok(view);
}

/** Creates a car in preparation. Kilometres after this go through a manager correction. */
export async function createCar(
  store: StaffStore,
  actor: StaffActor,
  input: CarDraftInput & { minAge?: number | null },
  now: Date,
): Promise<Result<StaffCarView>> {
  const allowed = requirePermission(actor.role, "cars.write");
  if (!allowed.ok) return allowed;
  const minAge = parseMinAge(input.minAge ?? null);
  if (!minAge.ok) return minAge;
  const draft = parseCarDraft(input, now);
  if (!draft.ok) return draft;
  const tags = await store.listTags();
  const tagCheck = assignableTags(tags, draft.value.tagIds, []);
  if (!tagCheck.ok) return tagCheck;
  const id = randomUUID();
  const saved = await asDuplicate(async () => {
    await store.insertCar({
      id,
      plate: draft.value.plate,
      vin: draft.value.vin,
      make: draft.value.make,
      model: draft.value.model,
      year: draft.value.year,
      color: draft.value.color,
      primaryType: draft.value.primaryType,
      seats: draft.value.seats,
      currentKm: draft.value.currentKm,
      purchasedAt: draft.value.purchasedAt,
      minAge: minAge.value,
      status: "preparing",
      careReason: null,
      internalNotes: draft.value.internalNotes,
      tagIds: [...draft.value.tagIds],
      ...blankSale,
    });
    return id;
  });
  if (!saved.ok) return saved;
  const view = await viewOf(store, id, now);
  if (view === null) throw new Error("Car missing after insert");
  return ok(view);
}

/** Updates identity fields. Current kilometres stay until `adjustKm`. */
export async function updateCar(
  store: StaffStore,
  actor: StaffActor,
  id: string,
  input: CarDraftInput & { minAge?: number | null },
  now: Date,
): Promise<Result<StaffCarView>> {
  const allowed = requirePermission(actor.role, "cars.write");
  if (!allowed.ok) return allowed;
  const draft = parseCarDraft(input, now);
  if (!draft.ok) return draft;
  const existing = await store.findCar(id);
  if (existing === null) return err("NOT_FOUND");
  const minAge = input.minAge === undefined ? ok(existing.minAge) : parseMinAge(input.minAge);
  if (!minAge.ok) return minAge;
  const tags = await store.listTags();
  const tagCheck = assignableTags(tags, draft.value.tagIds, existing.tagIds);
  if (!tagCheck.ok) return tagCheck;
  const saved = await asDuplicate(async () => {
    await store.updateCar({
      ...toCarWrite(existing),
      plate: draft.value.plate,
      vin: draft.value.vin,
      make: draft.value.make,
      model: draft.value.model,
      year: draft.value.year,
      color: draft.value.color,
      primaryType: draft.value.primaryType,
      seats: draft.value.seats,
      purchasedAt: draft.value.purchasedAt,
      internalNotes: draft.value.internalNotes,
      tagIds: [...draft.value.tagIds],
      minAge: minAge.value,
      currentKm: existing.currentKm,
    });
  });
  if (!saved.ok) return saved;
  const view = await viewOf(store, id, now);
  if (view === null) throw new Error("Car missing after update");
  return ok(view);
}
