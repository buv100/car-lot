import { randomUUID } from "node:crypto";

import { err, ok, type Result } from "../domain/result.js";
import { parseTagName } from "../domain/settings-fields.js";
import { DuplicateRecord, type StaffStore, type TagRecord } from "../repositories/staff-store.js";
import { requirePermission } from "./login-staff.js";
import type { StaffActor } from "./staff-actor.js";

/** Creates a tag. New tags start active unless the manager turns them off. */
export async function createTag(
  store: StaffStore,
  actor: StaffActor,
  name: string,
  active = true,
): Promise<Result<TagRecord>> {
  const allowed = requirePermission(actor.role, "settings.write");
  if (!allowed.ok) return allowed;
  const parsed = parseTagName(name);
  if (!parsed.ok) return parsed;
  const tag: TagRecord = { id: randomUUID(), name: parsed.value, active };
  try {
    await store.insertTag(tag);
  } catch (error: unknown) {
    if (error instanceof DuplicateRecord) return err("DUPLICATE");
    throw error;
  }
  return ok(tag);
}

/** Renames a tag or turns it off. Cars that already have it keep the mark. */
export async function updateTag(
  store: StaffStore,
  actor: StaffActor,
  id: string,
  name: string,
  active: boolean,
): Promise<Result<TagRecord>> {
  const allowed = requirePermission(actor.role, "settings.write");
  if (!allowed.ok) return allowed;
  const parsed = parseTagName(name);
  if (!parsed.ok) return parsed;
  const existing = (await store.listTags()).find((tag) => tag.id === id);
  if (existing === undefined) return err("NOT_FOUND");
  const tag: TagRecord = { id, name: parsed.value, active };
  try {
    await store.updateTag(tag);
  } catch (error: unknown) {
    if (error instanceof DuplicateRecord) return err("DUPLICATE");
    throw error;
  }
  return ok(tag);
}
