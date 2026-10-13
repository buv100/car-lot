import { describe, expect, it } from "vitest";

import { isAcceptedPassword } from "./password.js";

describe("isAcceptedPassword", () => {
  it("requires 8 characters, a letter, and a digit", () => {
    expect(isAcceptedPassword("yard1234")).toBe(true);
    expect(isAcceptedPassword("מגרש1234")).toBe(true);
    expect(isAcceptedPassword("short1")).toBe(false);
    expect(isAcceptedPassword("longpassword")).toBe(false);
    expect(isAcceptedPassword("12345678")).toBe(false);
  });
});
