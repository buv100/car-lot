import type { Agorot } from "../domain/money.js";

/** A signed provider event. The order id is the one stored on the checkout. */
export type PaymentEvent = {
  readonly providerEventId: string;
  readonly orderId: string;
  readonly outcome: "paid" | "failed" | "ignored";
  readonly providerRef: string | null;
};

/** Checkout, refund, and signed webhooks. Business code never imports Stripe. */
export interface PaymentProvider {
  readonly name: "stripe";
  createCheckout(input: {
    orderId: string;
    amount: Agorot;
    currency: "ILS";
    customerEmail: string;
    description: string;
    successUrl: string;
    cancelUrl: string;
  }): Promise<{ redirectUrl: string; providerRef: string }>;
  refund(input: { providerRef: string; amount: Agorot }): Promise<{ refundRef: string }>;
  parseWebhook(rawBody: string, signature: string): Promise<PaymentEvent>;
}

/** Local checkout when no Stripe test key is set. It never calls Stripe. */
export class LocalTestPayments implements PaymentProvider {
  readonly name = "stripe" as const;

  createCheckout(input: {
    orderId: string;
    amount: Agorot;
    currency: "ILS";
    customerEmail: string;
    description: string;
    successUrl: string;
    cancelUrl: string;
  }): Promise<{ redirectUrl: string; providerRef: string }> {
    return Promise.resolve({
      redirectUrl: input.successUrl,
      providerRef: `local_${input.orderId}`,
    });
  }

  refund(input: { providerRef: string; amount: Agorot }): Promise<{ refundRef: string }> {
    return Promise.resolve({ refundRef: `re_${input.providerRef}` });
  }

  parseWebhook(): Promise<PaymentEvent> {
    return Promise.reject(new Error("Stripe test key is not configured"));
  }
}
