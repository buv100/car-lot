import type { PaymentEvent, PaymentProvider } from "./provider.js";

function isEvent(value: unknown): value is PaymentEvent {
  if (typeof value !== "object" || value === null) return false;
  const event = value as Record<string, unknown>;
  const outcome = event.outcome;
  return (
    typeof event.providerEventId === "string" &&
    typeof event.orderId === "string" &&
    (outcome === "paid" || outcome === "failed" || outcome === "ignored") &&
    (event.providerRef === null || typeof event.providerRef === "string")
  );
}

/** In-memory checkout used by tests. A wrong signature never becomes an event. */
export class FakePayments implements PaymentProvider {
  readonly name = "stripe" as const;
  readonly secret = "whsec_test";
  readonly checkouts: { orderId: string; amount: number }[] = [];
  readonly refunds: { providerRef: string; amount: number }[] = [];

  createCheckout(input: {
    orderId: string;
    amount: number;
    currency: "ILS";
    customerEmail: string;
    description: string;
    successUrl: string;
    cancelUrl: string;
  }): Promise<{ redirectUrl: string; providerRef: string }> {
    this.checkouts.push({ orderId: input.orderId, amount: input.amount });
    return Promise.resolve({
      redirectUrl: `https://pay.test/${input.orderId}`,
      providerRef: `pi_${input.orderId}`,
    });
  }

  refund(input: { providerRef: string; amount: number }): Promise<{ refundRef: string }> {
    this.refunds.push(input);
    return Promise.resolve({ refundRef: `re_${input.providerRef}` });
  }

  parseWebhook(rawBody: string, signature: string): Promise<PaymentEvent> {
    if (signature !== this.secret) return Promise.reject(new Error("Invalid webhook signature"));
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      return Promise.reject(new Error("Invalid webhook signature"));
    }
    if (!isEvent(parsed)) return Promise.reject(new Error("Invalid webhook signature"));
    return Promise.resolve(parsed);
  }
}
