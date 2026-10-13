import type { Request, Response } from "express";
import jwt from "jsonwebtoken";

import type { StaffRole } from "../domain/permissions.js";

const COOKIE = "staff_token";
const MAX_AGE_SECONDS = 12 * 60 * 60;

/** The staff secret is a separate string of at least 32 characters. */
export function staffSecretReady(secret: string): boolean {
  return secret.length >= 32;
}

/** Signs the staff cookie for 12 hours. The role claim is not the authorization source. */
export function signStaffToken(secret: string, staffId: string, role: StaffRole): string {
  return jwt.sign({ sub: staffId, role }, secret, {
    audience: "staff",
    expiresIn: MAX_AGE_SECONDS,
  });
}

/** Returns the staff id when the signature and audience match. */
export function staffIdFromToken(secret: string, token: string): string | null {
  try {
    const payload = jwt.verify(token, secret, { audience: "staff" });
    if (typeof payload === "string" || typeof payload.sub !== "string") return null;
    return payload.sub;
  } catch {
    return null;
  }
}

export function readStaffCookie(req: Request): string | null {
  const header = req.header("cookie");
  if (header === undefined) return null;
  for (const part of header.split(";")) {
    const [rawName, ...rest] = part.trim().split("=");
    if (rawName === COOKIE) return decodeURIComponent(rest.join("="));
  }
  return null;
}

export function writeStaffCookie(res: Response, token: string, secure: boolean): void {
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

export function clearStaffCookie(res: Response, secure: boolean): void {
  const parts = [`${COOKIE}=`, "Path=/", "HttpOnly", "SameSite=Lax", "Max-Age=0"];
  if (secure) parts.push("Secure");
  res.setHeader("Set-Cookie", parts.join("; "));
}
