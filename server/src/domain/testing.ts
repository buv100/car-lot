import { expect } from "vitest";

import type { ErrorCode, Result } from "./result.js";

export function expectOk<T>(result: Result<T>): T {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.error.code);
  return result.value;
}

export function expectErr(result: Result<unknown>, code: ErrorCode): void {
  expect(result.ok).toBe(false);
  if (result.ok) throw new Error("expected an error");
  expect(result.error.code).toBe(code);
}
