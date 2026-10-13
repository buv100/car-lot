import { depositAgorot } from "../domain/sale.js";
import { storedAgorot } from "../domain/money.js";
import { err, ok, type Result } from "../domain/result.js";
import type { PaymentProvider } from "../payments/provider.js";
import type { StaffStore } from "../repositories/staff-store.js";
import { expireHolds } from "./expire-holds.js";
import { hashHoldToken } from "./hold-token.js";

/** Charges only the 10 percent deposit. A blocked customer releases the hold and is not charged. */
export async function paySale(
  store: StaffStore,
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
  const order = await store.findSaleByHoldHash(hashHoldToken(input.holdToken));
  if (order === null || order.id !== input.orderId || order.status !== "pending_payment") {
    return err("CAR_TAKEN");
  }
  const customer = await store.findCustomerById(input.customerId);
  if (customer === null) return err("UNAUTHENTICATED");
  if (customer.blocked) {
    await store.updateSaleOrder({ ...order, status: "expired" });
    return err("CUSTOMER_BLOCKED");
  }
  const car = await store.findCar(order.carId);
  if (car === null || car.salePriceAgorot === null) return err("CAR_TAKEN");
  const deposit = depositAgorot(storedAgorot(car.salePriceAgorot));
  const list = car.salePriceAgorot;
  if (deposit !== order.depositAgorot && !input.acceptPrice) return err("PRICE_CHANGED");
  const checkout = await payments.createCheckout({
    orderId: order.id,
    amount: storedAgorot(deposit),
    currency: "ILS",
    customerEmail: customer.email,
    description: `מקדמה ${order.number}`,
    successUrl: input.successUrl,
    cancelUrl: input.cancelUrl,
  });
  await store.updateSaleOrder({
    ...order,
    customerId: customer.id,
    listPriceAgorot: list,
    depositAgorot: deposit,
    paymentRef: checkout.providerRef,
  });
  return ok({ redirectUrl: checkout.redirectUrl });
}
