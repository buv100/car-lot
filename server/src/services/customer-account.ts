import { randomUUID } from "node:crypto";

import { normalizeEmail, normalizeFullName, normalizePhone } from "../domain/customer.js";
import { isAcceptedPassword } from "../domain/password.js";
import { err, ok, type Result } from "../domain/result.js";
import { compareCivilDates, jerusalemDate, parseCivilDate } from "../domain/time.js";
import {
  DuplicateRecord,
  type CustomerRecord,
  type StaffStore,
} from "../repositories/staff-store.js";
import { hashPassword, passwordMatches } from "./passwords.js";

export type NewCustomer = {
  fullName: string;
  phone: string;
  email: string;
  birthDate: string;
  password: string;
};

/** Opens a customer account. The birth date cannot be in the future. */
export async function registerCustomer(
  store: StaffStore,
  input: NewCustomer,
  now: Date,
): Promise<Result<{ id: string }>> {
  const fullName = normalizeFullName(input.fullName);
  const email = normalizeEmail(input.email);
  const phone = normalizePhone(input.phone);
  const birthDate = parseCivilDate(input.birthDate);
  if (fullName === null || email === null || phone === null || birthDate === null) {
    return err("INVALID_INPUT");
  }
  if (!isAcceptedPassword(input.password)) return err("INVALID_INPUT");
  if (compareCivilDates(birthDate, jerusalemDate(now)) > 0) return err("INVALID_INPUT");
  const customer: CustomerRecord = {
    id: randomUUID(),
    fullName,
    phone,
    email,
    birthDate,
    passwordHash: await hashPassword(input.password),
    blocked: false,
    blockReason: null,
    blockNote: "",
    blockedAt: null,
    blockedByStaffId: null,
    unblockedAt: null,
    unblockedByStaffId: null,
  };
  try {
    await store.insertCustomer(customer);
  } catch (error: unknown) {
    if (error instanceof DuplicateRecord) return err("DUPLICATE");
    throw error;
  }
  return ok({ id: customer.id });
}

/** Signs in a returning customer. A blocked customer can still sign in. */
export async function loginCustomer(
  store: StaffStore,
  emailInput: string,
  password: string,
): Promise<Result<{ id: string }>> {
  const email = normalizeEmail(emailInput);
  if (email === null) return err("INVALID_CREDENTIALS");
  const customer = await store.findCustomerByEmail(email);
  if (customer === null || !(await passwordMatches(password, customer.passwordHash))) {
    return err("INVALID_CREDENTIALS");
  }
  return ok({ id: customer.id });
}
