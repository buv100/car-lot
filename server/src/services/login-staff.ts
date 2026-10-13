import { can, type Permission } from "../domain/permissions.js";
import { normalizeEmail } from "../domain/settings-fields.js";
import { err, ok, type Result } from "../domain/result.js";
import type { StaffStore } from "../repositories/staff-store.js";
import { passwordMatches } from "./passwords.js";
import type { StaffPublic } from "./staff-actor.js";

/** Wrong email, wrong password, and a deactivated employee all look the same. */
export async function loginStaff(
  store: StaffStore,
  email: string,
  password: string,
): Promise<Result<StaffPublic>> {
  const normalized = normalizeEmail(email);
  if (normalized === null || password.length === 0) return err("INVALID_CREDENTIALS");
  const staff = await store.findStaffByEmail(normalized);
  if (staff === null || !staff.active) return err("INVALID_CREDENTIALS");
  if (!(await passwordMatches(password, staff.passwordHash))) return err("INVALID_CREDENTIALS");
  return ok({
    id: staff.id,
    fullName: staff.fullName,
    email: staff.email,
    role: staff.role,
    active: staff.active,
  });
}

/** Loads the row behind a staff token. An inactive employee is signed out. */
export async function loadStaff(store: StaffStore, staffId: string): Promise<Result<StaffPublic>> {
  const staff = await store.findStaffById(staffId);
  if (staff === null || !staff.active) return err("UNAUTHENTICATED");
  return ok({
    id: staff.id,
    fullName: staff.fullName,
    email: staff.email,
    role: staff.role,
    active: staff.active,
  });
}

/** Refuses the action when this role does not have the key. The database role is passed in. */
export function requirePermission(role: StaffPublic["role"], key: Permission): Result<void> {
  if (!can(role, key)) return err("FORBIDDEN");
  return ok(undefined);
}
