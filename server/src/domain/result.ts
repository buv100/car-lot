/** Stable error ids returned to the client. Hebrew text lives in the copy file. */
export const ERROR_CODES = [
  "RENTAL_TOO_SHORT",
  "PICKUP_TOO_SOON",
  "AGE_NOT_OFFERED",
  "BANDS_OVERLAP",
  "BANDS_INVALID",
  "TOO_FAR",
  "ADDRESS_NOT_FOUND",
  "LOT_NOT_READY",
  "ILLEGAL_TRANSITION",
  "FORBIDDEN",
  "CAR_NOT_READY",
  "CAR_TAKEN",
  "OPEN_RENTAL",
  "SALE_NOT_READY",
  "OPEN_RESERVATION",
  "START_KM_REQUIRED",
  "END_KM_BEFORE_START",
  "CHECKLIST_INCOMPLETE",
  "UNAUTHENTICATED",
  "INVALID_CREDENTIALS",
  "INVALID_INPUT",
  "NOT_FOUND",
  "DUPLICATE",
  "LAST_MANAGER",
  "INVALID_PHOTO",
  "TOO_MANY_PHOTOS",
  "INACTIVE_TAG",
  "INSURANCE_INVALID",
  "CUSTOMER_BLOCKED",
  "AGE_MISMATCH",
  "PRICE_CHANGED",
  "INTERNAL",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export type DomainError = { code: ErrorCode; message?: string };

/** Expected business failure. Programmer bugs still throw. */
export type Result<T> = { ok: true; value: T } | { ok: false; error: DomainError };

/** Wraps a successful value. */
export function ok<T>(value: T): Result<T> {
  return { ok: true, value };
}

/** Wraps a business failure. The optional message is for logs, not for customers. */
export function err(code: ErrorCode, message?: string): Result<never> {
  if (message === undefined) return { ok: false, error: { code } };
  return { ok: false, error: { code, message } };
}
