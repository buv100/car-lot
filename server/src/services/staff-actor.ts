import type { StaffRole } from "../domain/permissions.js";

/** The person doing the action. The role is the one stored in PostgreSQL. */
export type StaffActor = {
  readonly id: string;
  readonly role: StaffRole;
};

export type StaffPublic = {
  readonly id: string;
  readonly fullName: string;
  readonly email: string;
  readonly role: StaffRole;
  readonly active: boolean;
};
