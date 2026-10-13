import { afterEach, describe, expect, it } from "vitest";

import { copy } from "./locale";
import { getLocale, savePreferences } from "../preferences";

describe("display language", () => {
  afterEach(() => {
    savePreferences({ locale: "he", theme: "light", scale: "100" });
  });

  it("switches the whole site between Hebrew and English", () => {
    expect(copy.site.rent).toBe("להשכיר רכב");
    expect(copy.settings).toBe("הגדרות");

    savePreferences({ locale: "en" });

    expect(getLocale()).toBe("en");
    expect(copy.site.rent).toBe("Rent a car");
    expect(copy.site.question).toBe("What suits you today?");
    expect(copy.settings).toBe("Settings");
    expect(copy.desk).toBe("Lot desk");
  });
});
