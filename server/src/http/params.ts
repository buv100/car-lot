import type { Request } from "express";
import { z } from "zod";

import { err, ok, type Result } from "../domain/result.js";

/** One path segment. Express 5 may hand back a list. */
export function routeParam(value: string | string[] | undefined): string | null {
  if (typeof value === "string" && value.length > 0) return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return null;
}

export function queryStrings(query: Request["query"]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(query)) {
    if (typeof value === "string") result[key] = value;
    else if (Array.isArray(value) && typeof value[0] === "string") result[key] = value[0];
  }
  return result;
}

/** Zod is the HTTP boundary. A failed parse never reaches a service. */
export function parseBody<T>(schema: z.ZodType<T>, body: unknown): Result<T> {
  const parsed = schema.safeParse(body);
  if (!parsed.success) return err("INVALID_INPUT");
  return ok(parsed.data);
}
