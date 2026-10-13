import type { Response } from "express";

import type { ErrorCode, Result } from "../domain/result.js";

/** Business failures are 400, except auth, forbidden, and a taken car. */
export function statusFor(code: ErrorCode): number {
  if (code === "UNAUTHENTICATED" || code === "INVALID_CREDENTIALS") return 401;
  if (code === "FORBIDDEN") return 403;
  if (code === "CAR_TAKEN") return 409;
  if (code === "INTERNAL") return 500;
  return 400;
}

export function sendOk(res: Response, data: unknown): Response {
  return res.status(200).json({ ok: true, data });
}

export function sendErr(res: Response, code: ErrorCode): Response {
  return res.status(statusFor(code)).json({ ok: false, error: code });
}

export function sendResult<T>(res: Response, result: Result<T>): Response {
  if (!result.ok) return sendErr(res, result.error.code);
  return sendOk(res, result.value);
}
