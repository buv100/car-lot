import { describe, it } from "vitest";

import { agorot } from "./money.js";
import type { SaleListing } from "./sale.js";
import { checkCarMove, type CarTransitionActor, type CarTransitionCause } from "./transitions.js";
import type { StaffRole } from "./permissions.js";
import { expectErr, expectOk } from "./testing.js";

function listing(photoCount: number): SaleListing {
  return {
    ownersCount: 1,
    knownAccidents: null,
    accidentsNone: true,
    conditionGrade: "excellent",
    salePriceAgorot: agorot(30000),
    photoCount,
  };
}

function actor(
  role: StaffRole,
  cause: CarTransitionCause,
  overrides: Partial<CarTransitionActor> = {},
): CarTransitionActor {
  return {
    role,
    cause,
    hasOpenRental: false,
    hasOpenSaleReservation: false,
    hasMinAge: true,
    ageBandCount: 1,
    listing: listing(4),
    ...overrides,
  };
}

describe("car transitions", () => {
  it("publishes only with a photo, a minimum age, and a price band", () => {
    expectOk(
      checkCarMove("preparing", "available", actor("yard", "publish", { listing: listing(1) })),
    );
    expectErr(
      checkCarMove("preparing", "available", actor("yard", "publish", { listing: listing(0) })),
      "CAR_NOT_READY",
    );
    expectErr(
      checkCarMove("preparing", "available", actor("manager", "publish", { hasMinAge: false })),
      "CAR_NOT_READY",
    );
    expectErr(
      checkCarMove("preparing", "available", actor("yard", "publish", { ageBandCount: 0 })),
      "CAR_NOT_READY",
    );
  });

  it("lets yard staff move through care and deep treatment, and blocks an open rental", () => {
    expectOk(checkCarMove("available", "in_care", actor("yard", "start_care")));
    expectOk(checkCarMove("in_care", "available", actor("yard", "finish_care")));
    expectErr(
      checkCarMove("available", "in_care", actor("yard", "start_care", { hasOpenRental: true })),
      "OPEN_RENTAL",
    );
    expectOk(checkCarMove("available", "deep_treatment", actor("yard", "start_deep_treatment")));
    expectErr(
      checkCarMove(
        "available",
        "deep_treatment",
        actor("yard", "start_deep_treatment", { hasOpenRental: true }),
      ),
      "OPEN_RENTAL",
    );
  });

  it("acceptance 14: deep treatment reaches for_sale only with the sale listing", () => {
    expectErr(
      checkCarMove(
        "deep_treatment",
        "for_sale",
        actor("yard", "complete_deep_treatment", { listing: listing(3) }),
      ),
      "SALE_NOT_READY",
    );
    expectErr(
      checkCarMove(
        "deep_treatment",
        "for_sale",
        actor("yard", "complete_deep_treatment", {
          listing: { ...listing(4), conditionGrade: null },
        }),
      ),
      "SALE_NOT_READY",
    );
    expectOk(checkCarMove("deep_treatment", "for_sale", actor("yard", "complete_deep_treatment")));
  });

  it("reserves early sale and a return to the fleet for a manager", () => {
    expectErr(
      checkCarMove("available", "for_sale", actor("yard", "early_move_to_sale")),
      "FORBIDDEN",
    );
    expectErr(
      checkCarMove(
        "available",
        "for_sale",
        actor("manager", "early_move_to_sale", { hasOpenRental: true }),
      ),
      "OPEN_RENTAL",
    );
    const incomplete = actor("manager", "early_move_to_sale", {
      listing: { ...listing(4), salePriceAgorot: null },
    });
    expectErr(checkCarMove("available", "for_sale", incomplete), "SALE_NOT_READY");
    expectOk(checkCarMove("available", "for_sale", actor("manager", "early_move_to_sale")));

    expectErr(
      checkCarMove("deep_treatment", "available", actor("yard", "return_to_fleet")),
      "FORBIDDEN",
    );
    expectErr(checkCarMove("for_sale", "available", actor("yard", "return_to_fleet")), "FORBIDDEN");
    expectOk(checkCarMove("deep_treatment", "available", actor("manager", "return_to_fleet")));
    expectErr(
      checkCarMove(
        "for_sale",
        "available",
        actor("manager", "return_to_fleet", { hasOpenSaleReservation: true }),
      ),
      "OPEN_RESERVATION",
    );
    expectOk(checkCarMove("for_sale", "available", actor("manager", "return_to_fleet")));
    expectOk(checkCarMove("for_sale", "sold", actor("yard", "sale_handover")));
  });

  it("rejects transitions that are not in the graph", () => {
    expectErr(
      checkCarMove("preparing", "sold", actor("manager", "sale_handover")),
      "ILLEGAL_TRANSITION",
    );
    expectErr(
      checkCarMove("available", "sold", actor("manager", "sale_handover")),
      "ILLEGAL_TRANSITION",
    );
    expectErr(
      checkCarMove("sold", "available", actor("manager", "return_to_fleet")),
      "ILLEGAL_TRANSITION",
    );
    expectErr(
      checkCarMove("preparing", "available", actor("yard", "start_care")),
      "ILLEGAL_TRANSITION",
    );
  });
});
