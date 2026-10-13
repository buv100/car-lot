import { can, type Permission, type StaffRole } from "./permissions.js";
import { err, ok, type Result } from "./result.js";
import type { RentalStatus, SaleStatus } from "./status.js";

/** Who requested the change. System events come from payment or the job tick. */
export type Actor =
  | { readonly kind: "system" }
  | { readonly kind: "customer" }
  | { readonly kind: "staff"; readonly role: StaffRole };

/** Why a rental changes status. Cancel before handover skips the checklist. */
export type RentalTransitionCause =
  | "payment_succeeded"
  | "hold_expired"
  | "payment_failed"
  | "handover"
  | "customer_cancel"
  | "yard_cancel"
  | "no_show"
  | "returned"
  | "checklist_return"
  | "checklist_no_show";

export type SaleTransitionCause =
  "payment_succeeded" | "hold_expired" | "payment_failed" | "handover" | "refund_approved";

export type RentalTransitionInput = {
  readonly from: RentalStatus;
  readonly to: RentalStatus;
  readonly cause: RentalTransitionCause;
  readonly actor: Actor;
  readonly startKm?: number;
  readonly now?: Date;
  readonly pickupAt?: Date;
};

export type SaleTransitionInput = {
  readonly from: SaleStatus;
  readonly to: SaleStatus;
  readonly cause: SaleTransitionCause;
  readonly actor: Actor;
};

type Who = "system" | "customer" | "staff";

type RentalRule = {
  readonly from: RentalStatus;
  readonly to: RentalStatus;
  readonly cause: RentalTransitionCause;
  readonly who: Who;
  readonly permission?: Permission;
};

type SaleRule = {
  readonly from: SaleStatus;
  readonly to: SaleStatus;
  readonly cause: SaleTransitionCause;
  readonly who: Who;
  readonly permission?: Permission;
};

const RENTAL_RULES: readonly RentalRule[] = [
  { from: "pending_payment", to: "confirmed", cause: "payment_succeeded", who: "system" },
  { from: "pending_payment", to: "expired", cause: "hold_expired", who: "system" },
  { from: "pending_payment", to: "expired", cause: "payment_failed", who: "system" },
  {
    from: "confirmed",
    to: "active",
    cause: "handover",
    who: "staff",
    permission: "rentals.handover",
  },
  { from: "confirmed", to: "cancelled", cause: "customer_cancel", who: "customer" },
  {
    from: "confirmed",
    to: "cancelled",
    cause: "yard_cancel",
    who: "staff",
    permission: "rentals.cancel_yard",
  },
  {
    from: "confirmed",
    to: "checklist",
    cause: "no_show",
    who: "staff",
    permission: "rentals.handover",
  },
  {
    from: "active",
    to: "checklist",
    cause: "returned",
    who: "staff",
    permission: "rentals.handover",
  },
  {
    from: "checklist",
    to: "completed",
    cause: "checklist_return",
    who: "staff",
    permission: "checklist.complete",
  },
  {
    from: "checklist",
    to: "cancelled",
    cause: "checklist_no_show",
    who: "staff",
    permission: "checklist.complete",
  },
];

const SALE_RULES: readonly SaleRule[] = [
  { from: "pending_payment", to: "reserved", cause: "payment_succeeded", who: "system" },
  { from: "pending_payment", to: "expired", cause: "hold_expired", who: "system" },
  { from: "pending_payment", to: "expired", cause: "payment_failed", who: "system" },
  {
    from: "reserved",
    to: "completed",
    cause: "handover",
    who: "staff",
    permission: "sales.handover",
  },
  {
    from: "reserved",
    to: "cancelled",
    cause: "refund_approved",
    who: "staff",
    permission: "sales.refund",
  },
];

function authorize(who: Who, actor: Actor, permission: Permission | undefined): Result<void> {
  if (who === "system") {
    return actor.kind === "system" ? ok(undefined) : err("ILLEGAL_TRANSITION");
  }
  if (who === "customer") {
    return actor.kind === "customer" ? ok(undefined) : err("ILLEGAL_TRANSITION");
  }
  if (actor.kind !== "staff") return err("ILLEGAL_TRANSITION");
  if (permission !== undefined && !can(actor.role, permission)) return err("FORBIDDEN");
  return ok(undefined);
}

/** Allows one rental status change, including start-km on handover and the no-show clock. */
export function checkRentalMove(input: RentalTransitionInput): Result<void> {
  const rule = RENTAL_RULES.find(
    (candidate) =>
      candidate.from === input.from && candidate.to === input.to && candidate.cause === input.cause,
  );
  if (rule === undefined) return err("ILLEGAL_TRANSITION");
  const allowed = authorize(rule.who, input.actor, rule.permission);
  if (!allowed.ok) return allowed;
  if (input.cause === "handover") {
    if (input.startKm === undefined || !Number.isInteger(input.startKm) || input.startKm < 0) {
      return err("START_KM_REQUIRED");
    }
  }
  if (input.cause === "no_show") {
    if (input.now === undefined || input.pickupAt === undefined) {
      throw new Error("no_show requires now and pickupAt");
    }
    if (Number.isNaN(input.now.getTime()) || Number.isNaN(input.pickupAt.getTime())) {
      throw new Error("Invalid date");
    }
    // A no-show can be marked only after the pickup time. Earlier, the customer can still cancel.
    if (input.now.getTime() <= input.pickupAt.getTime()) return err("ILLEGAL_TRANSITION");
  }
  return ok(undefined);
}

/** Allows one sale status change. A paid reservation ends only by handover or a manager refund. */
export function checkSaleMove(input: SaleTransitionInput): Result<void> {
  const rule = SALE_RULES.find(
    (candidate) =>
      candidate.from === input.from && candidate.to === input.to && candidate.cause === input.cause,
  );
  if (rule === undefined) return err("ILLEGAL_TRANSITION");
  return authorize(rule.who, input.actor, rule.permission);
}

/** Manager only. Approval refunds and frees the car. Rejection keeps the reservation. */
export function checkSaleRefund(input: {
  readonly from: SaleStatus;
  readonly decision: "approve" | "reject";
  readonly actor: Actor;
}): Result<{ readonly orderStatus: SaleStatus; readonly refundApproved: boolean }> {
  if (input.from !== "reserved") return err("ILLEGAL_TRANSITION");
  if (input.actor.kind !== "staff") return err("ILLEGAL_TRANSITION");
  if (!can(input.actor.role, "sales.refund")) return err("FORBIDDEN");
  if (input.decision === "approve") {
    return ok({ orderStatus: "cancelled", refundApproved: true });
  }
  return ok({ orderStatus: "reserved", refundApproved: false });
}
