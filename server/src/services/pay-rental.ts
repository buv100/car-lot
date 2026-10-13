import { storedAgorot } from "../domain/money.js";
import { ageOn, jerusalemDate } from "../domain/time.js";
import { err, ok, type Result } from "../domain/result.js";
import type { Geocoder } from "../geocoding/geocoder.js";
import type { PaymentProvider } from "../payments/provider.js";
import type { StaffStore } from "../repositories/staff-store.js";
import { expireHolds } from "./expire-holds.js";
import { hashHoldToken } from "./hold-token.js";
import { repriceHeldRental } from "./hold-rental.js";

/** Charges the held snapshot, unless the customer is blocked, the age disagrees, or the price moved. */
export async function payRental(
  store: StaffStore,
  geocoder: Geocoder,
  payments: PaymentProvider,
  input: {
    orderId: string;
    customerId: string;
    holdToken: string;
    acceptPrice: boolean;
    successUrl: string;
    cancelUrl: string;
  },
  now: Date,
): Promise<Result<{ redirectUrl: string }>> {
  await expireHolds(store, now);
  const order = await store.findRentalByHoldHash(hashHoldToken(input.holdToken));
  if (order === null || order.id !== input.orderId || order.status !== "pending_payment") {
    return err("CAR_TAKEN");
  }
  const customer = await store.findCustomerById(input.customerId);
  if (customer === null) return err("UNAUTHENTICATED");
  if (customer.blocked) {
    await store.updateRentalOrder({ ...order, status: "expired" });
    return err("CUSTOMER_BLOCKED");
  }
  const age = ageOn(customer.birthDate, jerusalemDate(order.pickupAt));
  if (age !== order.searchAge) {
    await store.updateRentalOrder({ ...order, status: "expired" });
    return err("AGE_MISMATCH");
  }
  const repriced = await repriceHeldRental(store, geocoder, order, now);
  if (!repriced.ok) return repriced;
  const next = repriced.value;
  if (next.totalAgorot !== order.totalAgorot && !input.acceptPrice) return err("PRICE_CHANGED");
  const checkout = await payments.createCheckout({
    orderId: order.id,
    amount: storedAgorot(next.totalAgorot),
    currency: "ILS",
    customerEmail: customer.email,
    description: `השכרה ${order.number}`,
    successUrl: input.successUrl,
    cancelUrl: input.cancelUrl,
  });
  await store.updateRentalOrder({
    ...next,
    customerId: customer.id,
    ageAtPickup: age,
    paymentRef: checkout.providerRef,
  });
  return ok({ redirectUrl: checkout.redirectUrl });
}
