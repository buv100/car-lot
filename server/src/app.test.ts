import { describe, expect, it } from "vitest";
import { createApp } from "./app.js";

describe("createApp", () => {
  it("returns an Express application", () => {
    const app = createApp();
    expect(typeof app.disable).toBe("function");
  });
});
