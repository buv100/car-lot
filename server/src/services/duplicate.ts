import { DuplicateRecord } from "../repositories/staff-store.js";
import { err, ok, type Result } from "../domain/result.js";

/** Turns a unique-constraint failure into DUPLICATE and lets real faults throw. */
export async function asDuplicate<T>(work: () => Promise<T>): Promise<Result<T>> {
  try {
    return ok(await work());
  } catch (error: unknown) {
    if (error instanceof DuplicateRecord) return err("DUPLICATE");
    throw error;
  }
}
