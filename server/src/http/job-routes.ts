import { timingSafeEqual } from "node:crypto";
import { Router } from "express";

import { tickJobs } from "../services/tick-jobs.js";
import type { AppContext } from "./context.js";
import { sendErr, sendOk } from "./respond.js";
import { asyncRoute } from "./staff-guard.js";

/** Bearer JOB_SECRET. An empty secret never matches, so the tick stays closed. */
function bearerMatches(header: string | undefined, secret: string): boolean {
  if (secret.length === 0 || header === undefined) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(header);
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(actual, expected);
}

/** Background tick. It is not a staff session and not a customer session. */
export function jobRouter(context: AppContext): Router {
  const router = Router();
  router.post(
    "/tick",
    asyncRoute(async (req, res) => {
      if (!bearerMatches(req.header("authorization"), context.jobSecret)) {
        sendErr(res, "UNAUTHENTICATED");
        return;
      }
      sendOk(res, await tickJobs(context.store, context.mailer, context.now()));
    }),
  );
  return router;
}
