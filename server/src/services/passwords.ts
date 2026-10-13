import { compare, hash } from "bcryptjs";

/** bcrypt cost 12, as required for every password this system stores. */
export async function hashPassword(password: string): Promise<string> {
  return hash(password, 12);
}

/** True when the plain password matches the stored hash. */
export async function passwordMatches(password: string, passwordHash: string): Promise<boolean> {
  return compare(password, passwordHash);
}
