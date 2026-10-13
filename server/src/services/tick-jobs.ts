import { HOUR_MS } from "../domain/time.js";
import type { Mailer } from "../mail/mailer.js";
import type { StaffStore } from "../repositories/staff-store.js";
import { deliverPending } from "./deliver-mail.js";
import { expireHolds } from "./expire-holds.js";
import { queueReminders, queueSaleAlerts } from "./order-mail.js";

const DAY_MS = 24 * HOUR_MS;

export type TickReport = {
  reminders: boolean;
  saleScan: boolean;
};

async function checkpointDue(
  store: StaffStore,
  name: string,
  now: Date,
  intervalMs: number,
): Promise<boolean> {
  const ranAt = await store.readCheckpoint(name);
  if (ranAt === null) return true;
  return now.getTime() - ranAt.getTime() >= intervalMs;
}

/**
 * Minute tick: expire holds and drain the outbox.
 * Reminders run once an hour. The sale-threshold scan runs once a day.
 */
export async function tickJobs(store: StaffStore, mailer: Mailer, now: Date): Promise<TickReport> {
  await expireHolds(store, now);
  await deliverPending(store, mailer, now);
  const reminders = await checkpointDue(store, "reminders", now, HOUR_MS);
  if (reminders) {
    await queueReminders(store, now);
    await store.writeCheckpoint("reminders", now);
    await deliverPending(store, mailer, now);
  }
  const saleScan = await checkpointDue(store, "saleThreshold", now, DAY_MS);
  if (saleScan) {
    await queueSaleAlerts(store, now);
    await store.writeCheckpoint("saleThreshold", now);
    await deliverPending(store, mailer, now);
  }
  return { reminders, saleScan };
}
