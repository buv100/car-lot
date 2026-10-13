import { can } from "../domain/permissions.js";
import { storedAgorot } from "../domain/money.js";
import { err, ok, type Result } from "../domain/result.js";
import type { Mailer } from "../mail/mailer.js";
import { saleRefundLetter } from "../mail/letters.js";
import type { PaymentProvider } from "../payments/provider.js";
import type { StaffStore } from "../repositories/staff-store.js";
import { deliverPending, pendingOutbox } from "./deliver-mail.js";
import type { StaffActor } from "./staff-actor.js";

/** A manager approves or refuses a deposit refund. Yard staff cannot decide it. */
export async function decideSaleRefund(
  store: StaffStore,
  payments: PaymentProvider,
  actor: StaffActor,
  saleId: string,
  approved: boolean,
  now: Date,
  mailer: Mailer,
): Promise<Result<void>> {
  if (!can(actor.role, "sales.refund")) return err("FORBIDDEN");
  const sale = await store.findSaleOrder(saleId);
  if (sale === null) return err("NOT_FOUND");
  if (sale.status !== "reserved" || sale.refundDecidedAt !== null) return err("ILLEGAL_TRANSITION");
  if (sale.customerId === null || sale.paymentRef === null)
    throw new Error("Reserved sale is incomplete");
  const customer = await store.findCustomerById(sale.customerId);
  if (customer === null) throw new Error("Reserved sale is incomplete");
  if (approved) {
    await payments.refund({
      providerRef: sale.paymentRef,
      amount: storedAgorot(sale.depositAgorot),
    });
  }
  const letter = saleRefundLetter({
    approved,
    number: sale.number,
    customerEmail: customer.email,
  });
  await store.transaction(async (tx) => {
    await tx.updateSaleOrder({
      ...sale,
      status: approved ? "cancelled" : sale.status,
      refundDecidedAt: now,
      refundApproved: approved,
      refundByStaffId: actor.id,
    });
    await tx.insertOutbox(pendingOutbox(letter, now));
  });
  await deliverPending(store, mailer, now);
  return ok(undefined);
}
