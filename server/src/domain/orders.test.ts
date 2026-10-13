import { describe, expect, it } from "vitest";

import { checkRentalMove, checkSaleRefund, checkSaleMove } from "./orders.js";
import { expectErr, expectOk } from "./testing.js";

const yard = { kind: "staff", role: "yard" } as const;
const manager = { kind: "staff", role: "manager" } as const;
const customer = { kind: "customer" } as const;
const system = { kind: "system" } as const;

const pickupAt = new Date("2026-10-08T07:00:00.000Z");
const afterPickup = new Date(pickupAt.getTime() + 1);

describe("order transitions", () => {
  it("confirms or expires a hold only from the payment event", () => {
    expectOk(
      checkRentalMove({
        from: "pending_payment",
        to: "confirmed",
        cause: "payment_succeeded",
        actor: system,
      }),
    );
    expectOk(
      checkRentalMove({
        from: "pending_payment",
        to: "expired",
        cause: "payment_failed",
        actor: system,
      }),
    );
    expectErr(
      checkRentalMove({
        from: "pending_payment",
        to: "confirmed",
        cause: "payment_succeeded",
        actor: customer,
      }),
      "ILLEGAL_TRANSITION",
    );
  });

  it("cancels a confirmed rental for the customer by the scale, or for the yard in full", () => {
    expectOk(
      checkRentalMove({
        from: "confirmed",
        to: "cancelled",
        cause: "customer_cancel",
        actor: customer,
      }),
    );
    expectOk(
      checkRentalMove({
        from: "confirmed",
        to: "cancelled",
        cause: "yard_cancel",
        actor: yard,
      }),
    );
    expectOk(
      checkRentalMove({
        from: "confirmed",
        to: "cancelled",
        cause: "yard_cancel",
        actor: manager,
      }),
    );
    expectErr(
      checkRentalMove({
        from: "active",
        to: "cancelled",
        cause: "customer_cancel",
        actor: customer,
      }),
      "ILLEGAL_TRANSITION",
    );
  });

  it("requires a start kilometre to hand over, and sends a no-show to checklist", () => {
    expectErr(
      checkRentalMove({
        from: "confirmed",
        to: "active",
        cause: "handover",
        actor: yard,
      }),
      "START_KM_REQUIRED",
    );
    expectOk(
      checkRentalMove({
        from: "confirmed",
        to: "active",
        cause: "handover",
        actor: yard,
        startKm: 0,
      }),
    );
    expectErr(
      checkRentalMove({
        from: "confirmed",
        to: "checklist",
        cause: "no_show",
        actor: yard,
        now: pickupAt,
        pickupAt,
      }),
      "ILLEGAL_TRANSITION",
    );
    expectOk(
      checkRentalMove({
        from: "confirmed",
        to: "checklist",
        cause: "no_show",
        actor: manager,
        now: afterPickup,
        pickupAt,
      }),
    );
    expectErr(
      checkRentalMove({
        from: "confirmed",
        to: "cancelled",
        cause: "no_show",
        actor: yard,
        now: afterPickup,
        pickupAt,
      }),
      "ILLEGAL_TRANSITION",
    );
    expectErr(
      checkRentalMove({
        from: "confirmed",
        to: "checklist",
        cause: "returned",
        actor: yard,
      }),
      "ILLEGAL_TRANSITION",
    );
    expectOk(
      checkRentalMove({
        from: "active",
        to: "checklist",
        cause: "returned",
        actor: yard,
      }),
    );
  });

  it("completes a normal return and cancels a no-show only from checklist", () => {
    expectOk(
      checkRentalMove({
        from: "checklist",
        to: "completed",
        cause: "checklist_return",
        actor: yard,
      }),
    );
    expectOk(
      checkRentalMove({
        from: "checklist",
        to: "cancelled",
        cause: "checklist_no_show",
        actor: yard,
      }),
    );
    expectErr(
      checkRentalMove({
        from: "checklist",
        to: "cancelled",
        cause: "checklist_return",
        actor: yard,
      }),
      "ILLEGAL_TRANSITION",
    );
  });

  it("lets a manager approve or reject a deposit, and lets yard staff hand over a sale", () => {
    expectErr(
      checkSaleMove({
        from: "reserved",
        to: "cancelled",
        cause: "refund_approved",
        actor: yard,
      }),
      "FORBIDDEN",
    );
    expectOk(
      checkSaleMove({
        from: "pending_payment",
        to: "reserved",
        cause: "payment_succeeded",
        actor: system,
      }),
    );
    expectOk(
      checkSaleMove({
        from: "reserved",
        to: "completed",
        cause: "handover",
        actor: yard,
      }),
    );
    expect(
      expectOk(checkSaleRefund({ from: "reserved", decision: "approve", actor: manager })),
    ).toEqual({
      orderStatus: "cancelled",
      refundApproved: true,
    });
    expect(
      expectOk(checkSaleRefund({ from: "reserved", decision: "reject", actor: manager })),
    ).toEqual({
      orderStatus: "reserved",
      refundApproved: false,
    });
    expectErr(checkSaleRefund({ from: "reserved", decision: "approve", actor: yard }), "FORBIDDEN");
    expectErr(
      checkSaleRefund({ from: "pending_payment", decision: "reject", actor: manager }),
      "ILLEGAL_TRANSITION",
    );
  });
});
