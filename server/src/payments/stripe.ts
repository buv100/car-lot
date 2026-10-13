import { createHmac, timingSafeEqual } from "node:crypto";

import type { Agorot } from "../domain/money.js";
import type { PaymentEvent, PaymentProvider } from "./provider.js";

const TOLERANCE_SECONDS = 300;

type StripeObject = {
  id?: string;
  client_reference_id?: string | null;
  metadata?: { orderId?: string };
  payment_intent?: string | { id?: string } | null;
};

function signatureOk(rawBody: string, header: string, secret: string, nowSeconds: number): boolean {
  let timestamp = "";
  let v1 = "";
  for (const piece of header.split(",")) {
    const [key, value] = piece.split("=");
    if (key === "t" && value !== undefined) timestamp = value;
    if (key === "v1" && value !== undefined) v1 = value;
  }
  const issued = Number(timestamp);
  if (timestamp === "" || v1 === "" || !Number.isFinite(issued)) return false;
  if (Math.abs(nowSeconds - issued) > TOLERANCE_SECONDS) return false;
  const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  const left = Buffer.from(expected);
  const right = Buffer.from(v1);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function paymentRef(object: StripeObject): string | null {
  const intent = object.payment_intent;
  if (typeof intent === "string" && intent !== "") return intent;
  if (typeof intent === "object" && intent !== null && typeof intent.id === "string")
    return intent.id;
  return typeof object.id === "string" ? object.id : null;
}

function orderIdOf(object: StripeObject): string {
  if (typeof object.metadata?.orderId === "string" && object.metadata.orderId !== "") {
    return object.metadata.orderId;
  }
  return object.client_reference_id ?? "";
}

/** Stripe test keys only. The caller rejects `sk_live_` before this object is built. */
export class StripePayments implements PaymentProvider {
  readonly name = "stripe" as const;

  constructor(
    private readonly secretKey: string,
    private readonly webhookSecret: string,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async createCheckout(input: {
    orderId: string;
    amount: Agorot;
    currency: "ILS";
    customerEmail: string;
    description: string;
    successUrl: string;
    cancelUrl: string;
  }): Promise<{ redirectUrl: string; providerRef: string }> {
    if (!this.secretKey.startsWith("sk_test_")) throw new Error("Stripe test key is missing");
    const body = new URLSearchParams();
    body.set("mode", "payment");
    body.set("success_url", input.successUrl);
    body.set("cancel_url", input.cancelUrl);
    body.set("customer_email", input.customerEmail);
    body.set("client_reference_id", input.orderId);
    body.set("metadata[orderId]", input.orderId);
    body.set("line_items[0][quantity]", "1");
    body.set("line_items[0][price_data][currency]", "ils");
    body.set("line_items[0][price_data][unit_amount]", String(input.amount));
    body.set("line_items[0][price_data][product_data][name]", input.description);
    const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });
    if (!response.ok) throw new Error(`Stripe checkout failed with status ${response.status}`);
    const payload: unknown = await response.json();
    if (typeof payload !== "object" || payload === null) throw new Error("Stripe checkout failed");
    const session = payload as { id?: string; url?: string };
    if (typeof session.id !== "string" || typeof session.url !== "string") {
      throw new Error("Stripe checkout failed");
    }
    return { redirectUrl: session.url, providerRef: session.id };
  }

  async refund(input: { providerRef: string; amount: Agorot }): Promise<{ refundRef: string }> {
    if (!this.secretKey.startsWith("sk_test_")) throw new Error("Stripe test key is missing");
    const body = new URLSearchParams();
    body.set("payment_intent", input.providerRef);
    body.set("amount", String(input.amount));
    const response = await fetch("https://api.stripe.com/v1/refunds", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });
    if (!response.ok) throw new Error(`Stripe refund failed with status ${response.status}`);
    const payload: unknown = await response.json();
    if (typeof payload !== "object" || payload === null) throw new Error("Stripe refund failed");
    const refund = payload as { id?: string };
    if (typeof refund.id !== "string") throw new Error("Stripe refund failed");
    return { refundRef: refund.id };
  }

  parseWebhook(rawBody: string, signature: string): Promise<PaymentEvent> {
    if (this.webhookSecret === "") throw new Error("Invalid webhook signature");
    const nowSeconds = Math.floor(this.now().getTime() / 1000);
    if (!signatureOk(rawBody, signature, this.webhookSecret, nowSeconds)) {
      throw new Error("Invalid webhook signature");
    }
    let payload: unknown;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      throw new Error("Invalid webhook signature");
    }
    if (typeof payload !== "object" || payload === null)
      throw new Error("Invalid webhook signature");
    const event = payload as { id?: string; type?: string; data?: { object?: StripeObject } };
    if (
      typeof event.id !== "string" ||
      typeof event.type !== "string" ||
      event.data?.object === undefined
    ) {
      throw new Error("Invalid webhook signature");
    }
    const object = event.data.object;
    const orderId = orderIdOf(object);
    if (event.type === "checkout.session.completed") {
      return Promise.resolve({
        providerEventId: event.id,
        orderId,
        outcome: "paid",
        providerRef: paymentRef(object),
      });
    }
    if (
      event.type === "checkout.session.expired" ||
      event.type === "checkout.session.async_payment_failed"
    ) {
      return Promise.resolve({
        providerEventId: event.id,
        orderId,
        outcome: "failed",
        providerRef: paymentRef(object),
      });
    }
    return Promise.resolve({
      providerEventId: event.id,
      orderId,
      outcome: "ignored",
      providerRef: null,
    });
  }
}
