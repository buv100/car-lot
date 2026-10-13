import type { Request, Response } from "express";
import jwt from "jsonwebtoken";

const COOKIE = "customer_token";
const MAX_AGE_SECONDS = 12 * 60 * 60;

/** The customer secret is separate from the staff secret and at least 32 characters. */
export function customerSecretReady(secret: string): boolean {
  return secret.length >= 32;
}

/** Signs the customer cookie for 12 hours. */
export function signCustomerToken(secret: string, customerId: string): string {
  return jwt.sign({ sub: customerId }, secret, {
    audience: "customer",
    expiresIn: MAX_AGE_SECONDS,
  });
}

/** Returns the customer id when the signature and audience match. */
export function customerIdFromToken(secret: string, token: string): string | null {
  try {
    const payload = jwt.verify(token, secret, { audience: "customer" });
    if (typeof payload === "string" || typeof payload.sub !== "string") return null;
    return payload.sub;
  } catch {
    return null;
  }
}

export function readCustomerCookie(req: Request): string | null {
  const header = req.header("cookie");
  if (header === undefined) return null;
  for (const part of header.split(";")) {
    const [rawName, ...rest] = part.trim().split("=");
    if (rawName === COOKIE) return decodeURIComponent(rest.join("="));
  }
  return null;
}

export function writeCustomerCookie(res: Response, token: string, secure: boolean): void {
  const parts = [
    `${COOKIE}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${MAX_AGE_SECONDS}`,
  ];
  if (secure) parts.push("Secure");
  res.setHeader("Set-Cookie", parts.join("; "));
}

export function clearCustomerCookie(res: Response, secure: boolean): void {
  const parts = [`${COOKIE}=`, "Path=/", "HttpOnly", "SameSite=Lax", "Max-Age=0"];
  if (secure) parts.push("Secure");
  res.setHeader("Set-Cookie", parts.join("; "));
}
