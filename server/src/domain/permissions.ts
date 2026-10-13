/** Staff abilities. Yard and manager differ only by this map, not by scattered role checks. */
export const PERMISSIONS = [
  "cars.write",
  "cars.price",
  "cars.status",
  "checklist.complete",
  "rentals.read",
  "rentals.handover",
  "rentals.cancel_yard",
  "sales.read",
  "sales.handover",
  "sales.refund",
  "sales.early_move",
  "customers.block",
  "settings.write",
  "staff.write",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export type StaffRole = "yard" | "manager";

const GRANTS = {
  yard: {
    "cars.write": true,
    "cars.price": true,
    "cars.status": true,
    "checklist.complete": true,
    "rentals.read": true,
    "rentals.handover": true,
    "rentals.cancel_yard": true,
    "sales.read": true,
    "sales.handover": true,
    "sales.refund": false,
    "sales.early_move": false,
    "customers.block": false,
    "settings.write": false,
    "staff.write": false,
  },
  manager: {
    "cars.write": true,
    "cars.price": true,
    "cars.status": true,
    "checklist.complete": true,
    "rentals.read": true,
    "rentals.handover": true,
    "rentals.cancel_yard": true,
    "sales.read": true,
    "sales.handover": true,
    "sales.refund": true,
    "sales.early_move": true,
    "customers.block": true,
    "settings.write": true,
    "staff.write": true,
  },
} as const satisfies Record<StaffRole, Record<Permission, boolean>>;

/** Parses a role sent on a form. Authorization still goes through `can`. */
export function parseStaffRole(value: string): StaffRole | null {
  if (value === "yard" || value === "manager") return value;
  return null;
}

/** True when this role may perform the action. The database role wins over the JWT claim. */
export function can(role: StaffRole, key: Permission): boolean {
  return GRANTS[role][key];
}

/** Keys this role may use. The screen hides the rest; the service still checks `can`. */
export function grantedPermissions(role: StaffRole): Permission[] {
  return PERMISSIONS.filter((key) => can(role, key));
}

/** True when this edit would leave the yard with no active manager. */
export function removesLastManager(
  staff: readonly { id: string; role: StaffRole; active: boolean }[],
  targetId: string,
  next: { role: StaffRole; active: boolean },
): boolean {
  const activeManagers = staff.filter((person) => person.role === "manager" && person.active);
  const targetIsOnlyManager = activeManagers.length === 1 && activeManagers[0]?.id === targetId;
  if (!targetIsOnlyManager) return false;
  return !(next.role === "manager" && next.active);
}
