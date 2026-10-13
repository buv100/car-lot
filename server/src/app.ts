import express, { type Express, type NextFunction, type Request, type Response } from "express";

import { catalogRouter, mediaRouter } from "./http/catalog-routes.js";
import type { AppContext } from "./http/context.js";
import { customerRouter } from "./http/customer-routes.js";
import { jobRouter } from "./http/job-routes.js";
import { sendErr, sendResult } from "./http/respond.js";
import { asyncRoute } from "./http/staff-guard.js";
import { staffRouter } from "./http/staff-routes.js";
import { confirmPayment } from "./services/confirm-payment.js";

/** JSON API and public car photos. Screens stay in the React app. */
export function createApp(context: AppContext): Express {
  const app = express();
  app.disable("x-powered-by");
  app.use((req, res, next) => {
    const origin = req.header("origin");
    if (origin === context.clientOrigin) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Credentials", "true");
      res.setHeader("Vary", "Origin");
    }
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Hold-Token");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,PUT,DELETE,OPTIONS");
    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }
    next();
  });
  app.use("/media", mediaRouter(context));
  app.post(
    "/api/payments/webhook",
    express.raw({ type: "application/json" }),
    asyncRoute(async (req, res) => {
      const raw = Buffer.isBuffer(req.body) ? req.body.toString("utf8") : "";
      const signature = req.header("stripe-signature") ?? "";
      try {
        const event = await context.payments.parseWebhook(raw, signature);
        sendResult(res, await confirmPayment(context.store, event, context.mailer, context.now()));
      } catch {
        sendErr(res, "INVALID_INPUT");
      }
    }),
  );
  app.use(express.json({ limit: "12mb" }));
  app.use("/api/jobs", jobRouter(context));
  app.use("/api/staff", staffRouter(context));
  app.use("/api", customerRouter(context));
  app.use("/api", catalogRouter(context));
  app.use("/api", (_req, res) => {
    sendErr(res, "NOT_FOUND");
  });
  app.use((error: unknown, _req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) {
      next(error);
      return;
    }
    if (error instanceof SyntaxError) {
      sendErr(res, "INVALID_INPUT");
      return;
    }
    console.error(error instanceof Error ? error.message : "INTERNAL");
    sendErr(res, "INTERNAL");
  });
  return app;
}
