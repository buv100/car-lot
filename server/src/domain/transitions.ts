import { can, type Permission, type StaffRole } from "./permissions.js";
import { err, ok, type Result } from "./result.js";
import { isSaleListingReady, type SaleListing } from "./sale.js";
import type { CarStatus } from "./status.js";

/** Why a car changes status. The cause must match the edge, not only the two statuses. */
export type CarTransitionCause =
  | "publish"
  | "start_care"
  | "finish_care"
  | "start_deep_treatment"
  | "complete_deep_treatment"
  | "early_move_to_sale"
  | "return_to_fleet"
  | "sale_handover";

export type CarTransitionActor = {
  readonly role: StaffRole;
  readonly cause: CarTransitionCause;
  readonly hasOpenRental: boolean;
  readonly hasOpenSaleReservation: boolean;
  readonly hasMinAge: boolean;
  readonly ageBandCount: number;
  readonly listing: SaleListing;
};

type CarEdge = {
  readonly from: CarStatus;
  readonly to: CarStatus;
  readonly cause: CarTransitionCause;
  readonly permission: Permission;
  readonly blockOpenRental: boolean;
  readonly requirePublishReady: boolean;
  readonly requireSaleListing: boolean;
  readonly blockOpenReservation: boolean;
};

const CAR_EDGES: readonly CarEdge[] = [
  {
    from: "preparing",
    to: "available",
    cause: "publish",
    permission: "cars.status",
    blockOpenRental: false,
    requirePublishReady: true,
    requireSaleListing: false,
    blockOpenReservation: false,
  },
  {
    from: "available",
    to: "in_care",
    cause: "start_care",
    permission: "cars.status",
    blockOpenRental: true,
    requirePublishReady: false,
    requireSaleListing: false,
    blockOpenReservation: false,
  },
  {
    from: "in_care",
    to: "available",
    cause: "finish_care",
    permission: "cars.status",
    blockOpenRental: false,
    requirePublishReady: false,
    requireSaleListing: false,
    blockOpenReservation: false,
  },
  {
    from: "available",
    to: "deep_treatment",
    cause: "start_deep_treatment",
    permission: "cars.status",
    blockOpenRental: true,
    requirePublishReady: false,
    requireSaleListing: false,
    blockOpenReservation: false,
  },
  {
    from: "deep_treatment",
    to: "for_sale",
    cause: "complete_deep_treatment",
    permission: "cars.status",
    blockOpenRental: false,
    requirePublishReady: false,
    requireSaleListing: true,
    blockOpenReservation: false,
  },
  {
    from: "available",
    to: "for_sale",
    cause: "early_move_to_sale",
    permission: "sales.early_move",
    blockOpenRental: true,
    requirePublishReady: false,
    requireSaleListing: true,
    blockOpenReservation: false,
  },
  {
    from: "deep_treatment",
    to: "available",
    cause: "return_to_fleet",
    permission: "sales.early_move",
    blockOpenRental: false,
    requirePublishReady: false,
    requireSaleListing: false,
    blockOpenReservation: false,
  },
  {
    from: "for_sale",
    to: "available",
    cause: "return_to_fleet",
    permission: "sales.early_move",
    blockOpenRental: false,
    requirePublishReady: false,
    requireSaleListing: false,
    blockOpenReservation: true,
  },
  {
    from: "for_sale",
    to: "sold",
    cause: "sale_handover",
    permission: "sales.handover",
    blockOpenRental: false,
    requirePublishReady: false,
    requireSaleListing: false,
    blockOpenReservation: false,
  },
];

/** Allows one car status change. Any other pair of statuses is refused. */
export function checkCarMove(
  from: CarStatus,
  to: CarStatus,
  actor: CarTransitionActor,
): Result<void> {
  const edge = CAR_EDGES.find(
    (candidate) =>
      candidate.from === from && candidate.to === to && candidate.cause === actor.cause,
  );
  if (edge === undefined) return err("ILLEGAL_TRANSITION");
  if (!can(actor.role, edge.permission)) return err("FORBIDDEN");
  if (edge.blockOpenRental && actor.hasOpenRental) return err("OPEN_RENTAL");
  if (edge.blockOpenReservation && actor.hasOpenSaleReservation) {
    return err("OPEN_RESERVATION");
  }
  if (
    edge.requirePublishReady &&
    (actor.listing.photoCount < 1 || !actor.hasMinAge || actor.ageBandCount < 1)
  ) {
    return err("CAR_NOT_READY");
  }
  if (edge.requireSaleListing && !isSaleListingReady(actor.listing)) {
    return err("SALE_NOT_READY");
  }
  return ok(undefined);
}
