import type { NextFunction, Request, RequestHandler, Response } from "express";

import { grantedPermissions } from "../domain/permissions.js";
import { loadStaff } from "../services/login-staff.js";
import type { StaffPublic } from "../services/staff-actor.js";
import type { AppContext } from "./context.js";
import { sendErr, sendOk } from "./respond.js";
import { readStaffCookie, staffIdFromToken, staffSecretReady } from "./staff-token.js";

const actors = new WeakMap<Request, StaffPublic>();

export function currentStaff(req: Request): StaffPublic {
  const actor = actors.get(req);
  if (actor === undefined) throw new Error("Staff middleware missing");
  return actor;
}

/** Checks the staff cookie, then the PostgreSQL row. An inactive employee is signed out. */
export function requireStaff(context: AppContext): RequestHandler {
  return (req, res, next) => {
    authenticate(context, req, res)
      .then((actor) => {
        if (actor === null) return;
        actors.set(req, actor);
        next();
      })
      .catch(next);
  };
}

async function authenticate(
  context: AppContext,
  req: Request,
  res: Response,
): Promise<StaffPublic | null> {
  if (!staffSecretReady(context.staffJwtSecret)) {
    sendErr(res, "INTERNAL");
    return null;
  }
  const token = readStaffCookie(req);
  if (token === null) {
    sendErr(res, "UNAUTHENTICATED");
    return null;
  }
  const staffId = staffIdFromToken(context.staffJwtSecret, token);
  if (staffId === null) {
    sendErr(res, "UNAUTHENTICATED");
    return null;
  }
  const staff = await loadStaff(context.store, staffId);
  if (!staff.ok) {
    sendErr(res, staff.error.code);
    return null;
  }
  return staff.value;
}

export function sendSession(res: Response, staff: StaffPublic): void {
  sendOk(res, {
    id: staff.id,
    fullName: staff.fullName,
    email: staff.email,
    role: staff.role,
    permissions: grantedPermissions(staff.role),
  });
}

export function asyncRoute(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    handler(req, res, next).catch(next);
  };
}
