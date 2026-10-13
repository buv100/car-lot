import { createHash, randomBytes } from "node:crypto";

/** A hold token is a random secret. Only its hash is stored. */
export function newHoldToken(): { raw: string; hash: string } {
  const raw = randomBytes(32).toString("hex");
  return { raw, hash: hashHoldToken(raw) };
}

/** Same hash the hold row stores, so the header can be checked without storing the raw token. */
export function hashHoldToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}
