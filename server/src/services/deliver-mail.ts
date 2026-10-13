import { randomUUID } from "node:crypto";

import { can } from "../domain/permissions.js";
import { err, ok, type Result } from "../domain/result.js";
import type { Mailer } from "../mail/mailer.js";
import type { OutboxRecord, StaffStore } from "../repositories/staff-store.js";
import type { StaffActor } from "./staff-actor.js";

/** A new outbox row waits for delivery after the order transaction commits. */
export function pendingOutbox(
  letter: { to: string; subject: string; body: string },
  now: Date,
): OutboxRecord {
  return {
    id: randomUUID(),
    to: letter.to,
    subject: letter.subject,
    body: letter.body,
    status: "pending",
    attempts: 0,
    lastError: "",
    createdAt: now,
    sentAt: null,
  };
}

function mailFailure(error: unknown): string {
  const message = error instanceof Error ? error.message : "send failed";
  return message.slice(0, 500);
}

async function sendRow(
  store: StaffStore,
  mailer: Mailer,
  row: OutboxRecord,
  now: Date,
): Promise<"sent" | "failed"> {
  try {
    await mailer.send({ to: row.to, subject: row.subject, text: row.body });
    await store.updateOutbox({
      ...row,
      status: "sent",
      sentAt: now,
      attempts: row.attempts + 1,
      lastError: "",
    });
    return "sent";
  } catch (error: unknown) {
    // The order is already committed. A refused mailbox only marks this row failed.
    await store.updateOutbox({
      ...row,
      status: "failed",
      attempts: row.attempts + 1,
      lastError: mailFailure(error),
    });
    return "failed";
  }
}

/** Sends every pending row. Failed rows stay failed until a person retries them. */
export async function deliverPending(store: StaffStore, mailer: Mailer, now: Date): Promise<void> {
  const rows = await store.listOutbox();
  for (const row of rows) {
    if (row.status !== "pending") continue;
    await sendRow(store, mailer, row, now);
  }
}

/** Staff board retry. Only a failed row is sent again. */
export async function retryOutbox(
  store: StaffStore,
  mailer: Mailer,
  actor: StaffActor,
  id: string,
  now: Date,
): Promise<Result<{ status: "sent" | "failed" }>> {
  if (!can(actor.role, "rentals.read")) return err("FORBIDDEN");
  const row = (await store.listOutbox()).find((item) => item.id === id);
  if (row === undefined || row.status !== "failed") return err("NOT_FOUND");
  const status = await sendRow(store, mailer, row, now);
  return ok({ status });
}
