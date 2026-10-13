import { randomUUID } from "node:crypto";

import { isAcceptedPassword } from "../domain/password.js";
import { parseStaffRole, removesLastManager } from "../domain/permissions.js";
import { err, ok, type Result } from "../domain/result.js";
import { normalizeEmail, parsePersonName } from "../domain/settings-fields.js";
import { DuplicateRecord, type StaffStore } from "../repositories/staff-store.js";
import { requirePermission } from "./login-staff.js";
import { hashPassword } from "./passwords.js";
import type { StaffActor, StaffPublic } from "./staff-actor.js";

function withoutSecret(staff: {
  id: string;
  fullName: string;
  email: string;
  role: StaffPublic["role"];
  active: boolean;
}): StaffPublic {
  return staff;
}

/** Employees. There is no delete, only deactivation, and the last manager stays. */
export async function listEmployees(
  store: StaffStore,
  actor: StaffActor,
): Promise<Result<StaffPublic[]>> {
  const allowed = requirePermission(actor.role, "staff.write");
  if (!allowed.ok) return allowed;
  const rows = await store.listStaff();
  return ok(rows.map(withoutSecret));
}

/** Adds a yard employee or a manager. */
export async function createEmployee(
  store: StaffStore,
  actor: StaffActor,
  input: { fullName: string; email: string; password: string; role: string },
): Promise<Result<StaffPublic>> {
  const allowed = requirePermission(actor.role, "staff.write");
  if (!allowed.ok) return allowed;
  const fullName = parsePersonName(input.fullName);
  if (!fullName.ok) return fullName;
  const email = normalizeEmail(input.email);
  const role = parseStaffRole(input.role);
  if (email === null || role === null || !isAcceptedPassword(input.password))
    return err("INVALID_INPUT");
  const saved = {
    id: randomUUID(),
    fullName: fullName.value,
    email,
    passwordHash: await hashPassword(input.password),
    role,
    active: true,
  };
  try {
    await store.insertStaff(saved);
  } catch (error: unknown) {
    if (error instanceof DuplicateRecord) return err("DUPLICATE");
    throw error;
  }
  return ok(withoutSecret(saved));
}

/** Updates name, role, password, or active flag. */
export async function updateEmployee(
  store: StaffStore,
  actor: StaffActor,
  id: string,
  input: { fullName?: string; email?: string; password?: string; role?: string; active?: boolean },
): Promise<Result<StaffPublic>> {
  const allowed = requirePermission(actor.role, "staff.write");
  if (!allowed.ok) return allowed;
  return store.transaction(async (tx) => {
    const people = await tx.listStaff();
    const current = people.find((person) => person.id === id);
    if (current === undefined) return err("NOT_FOUND");
    const fullName =
      input.fullName === undefined ? ok(current.fullName) : parsePersonName(input.fullName);
    if (!fullName.ok) return fullName;
    const email = input.email === undefined ? current.email : normalizeEmail(input.email);
    const role = input.role === undefined ? current.role : parseStaffRole(input.role);
    if (email === null || role === null) return err("INVALID_INPUT");
    if (input.password !== undefined && !isAcceptedPassword(input.password))
      return err("INVALID_INPUT");
    const active = input.active ?? current.active;
    if (removesLastManager(people, id, { role, active })) return err("LAST_MANAGER");
    const saved = {
      ...current,
      fullName: fullName.value,
      email,
      role,
      active,
      passwordHash:
        input.password === undefined ? current.passwordHash : await hashPassword(input.password),
    };
    try {
      await tx.updateStaff(saved);
    } catch (error: unknown) {
      if (error instanceof DuplicateRecord) return err("DUPLICATE");
      throw error;
    }
    return ok(withoutSecret(saved));
  });
}
