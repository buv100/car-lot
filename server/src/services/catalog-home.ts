import { ok, type Result } from "../domain/result.js";
import type { StaffStore } from "../repositories/staff-store.js";

export type PublicLot = {
  name: string;
  address: string;
  phone: string;
  publicEmail: string;
};

/** Name, address, and phone for the public shell. Staff alerts stay off this payload. */
export async function publicLot(store: StaffStore): Promise<Result<PublicLot>> {
  const lot = await store.readLot();
  return ok({
    name: lot?.name ?? "",
    address: lot?.address ?? "",
    phone: lot?.phone ?? "",
    publicEmail: lot?.publicEmail ?? "",
  });
}

/** Active tags for the results filter. Inactive tags stay on cars but not in the filter. */
export async function publicTags(
  store: StaffStore,
): Promise<Result<{ id: string; name: string }[]>> {
  const tags = await store.listTags();
  return ok(tags.filter((tag) => tag.active).map((tag) => ({ id: tag.id, name: tag.name })));
}
