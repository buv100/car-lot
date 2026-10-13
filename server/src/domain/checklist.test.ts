import { describe, expect, it } from "vitest";

import { assessChecklist, type ChecklistInput } from "./checklist.js";
import { agorot } from "./money.js";
import { expectErr, expectOk } from "./testing.js";

function draft(overrides: Partial<ChecklistInput> = {}): ChecklistInput {
  return {
    noShow: false,
    startKm: 1000,
    endKm: 1200,
    fuelLitersShort: 4,
    damages: [],
    washNeeded: false,
    washDone: false,
    treatmentNeeded: false,
    treatmentDone: false,
    returnPhotoCount: 1,
    priceDecision: "keep",
    priceUpdated: false,
    allowanceKm: 500,
    excessKmPriceAgorot: agorot(2),
    fuelPricePerLiterAgorot: agorot(8),
    ...overrides,
  };
}

describe("assessChecklist", () => {
  it("acceptance 11: refuses a checklist missing km, fuel, price, wash, or treatment", () => {
    expectErr(assessChecklist(draft({ endKm: null })), "CHECKLIST_INCOMPLETE");
    expectErr(assessChecklist(draft({ fuelLitersShort: null })), "CHECKLIST_INCOMPLETE");
    expectErr(assessChecklist(draft({ priceDecision: null })), "CHECKLIST_INCOMPLETE");
    expectErr(
      assessChecklist(draft({ washNeeded: true, washDone: false })),
      "CHECKLIST_INCOMPLETE",
    );
    expectErr(
      assessChecklist(draft({ treatmentNeeded: true, treatmentDone: false })),
      "CHECKLIST_INCOMPLETE",
    );
    expectErr(
      assessChecklist(draft({ priceDecision: "update", priceUpdated: false })),
      "CHECKLIST_INCOMPLETE",
    );
    expectErr(assessChecklist(draft({ endKm: 1000 })), "CHECKLIST_INCOMPLETE");
    expectErr(
      assessChecklist(
        draft({
          damages: [{ description: "  ", estimatedAgorot: agorot(50), photoCount: 1 }],
        }),
      ),
      "CHECKLIST_INCOMPLETE",
    );
  });

  it("stores excess and fuel without charging them, and leaves the car km on a no-show", () => {
    const done = expectOk(assessChecklist(draft()));
    expect(done.kmExcess).toBe(0);
    expect(done.fuelChargeAgorot).toBe(agorot(32));
    expect(done.nextStatus).toBe("completed");
    expect(done.updateCarKm).toBe(true);

    const withoutPhotos = expectOk(
      assessChecklist(
        draft({
          returnPhotoCount: 0,
          damages: [{ description: "שריטה", estimatedAgorot: agorot(50), photoCount: 0 }],
        }),
      ),
    );
    expect(withoutPhotos.nextStatus).toBe("completed");

    const over = expectOk(assessChecklist(draft({ endKm: 1600, allowanceKm: 500 })));
    expect(over.kmExcess).toBe(100);
    expect(over.kmChargeAgorot).toBe(agorot(200));

    const missed = expectOk(
      assessChecklist(
        draft({
          noShow: true,
          endKm: 1000,
          fuelLitersShort: 0,
          returnPhotoCount: 0,
          washNeeded: true,
          washDone: true,
        }),
      ),
    );
    expect(missed.nextStatus).toBe("cancelled");
    expect(missed.updateCarKm).toBe(false);
    expectErr(assessChecklist(draft({ endKm: 900 })), "END_KM_BEFORE_START");
  });
});
