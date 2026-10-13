import { describe, expect, it } from "vitest";

import { copy } from "./copy";
import { accountFormatHint, accountIssues } from "./required-fields";

const filled = {
  creating: true,
  fullName: "דנה לוי",
  phone: "050-123-4567",
  birthDate: "1990-04-02",
  email: "dana@example.com",
  password: "secret12",
  today: "2026-10-13",
};

describe("account form rules", () => {
  it("accepts a filled mobile number with separators", () => {
    expect(accountIssues(filled)).toEqual({ missing: [], invalid: [] });
  });

  it("marks a filled landline and a digits-only password as invalid", () => {
    const issues = accountIssues({
      ...filled,
      phone: "03-5551234",
      password: "12345678",
    });
    expect(issues.missing).toEqual([]);
    expect(issues.invalid).toEqual([copy.site.phone, copy.password]);
    expect(accountFormatHint(issues)).toEqual([copy.site.registerHint]);
  });
});
