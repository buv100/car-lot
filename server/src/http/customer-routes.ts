import { Router, type Request } from "express";
import { z } from "zod";

import { isUuid } from "../domain/car-fields.js";
import { CAR_TYPES } from "../domain/status.js";
import { instantInJerusalem, parseCivilDate } from "../domain/time.js";
import { loginCustomer, registerCustomer } from "../services/customer-account.js";
import { confirmPayment } from "../services/confirm-payment.js";
import { holdRental } from "../services/hold-rental.js";
import { holdSale } from "../services/hold-sale.js";
import { payRental } from "../services/pay-rental.js";
import { paySale } from "../services/pay-sale.js";
import { readAccount, readRentalOrder, readSaleOrder } from "../services/read-order.js";
import type { RentQuery } from "../services/catalog-rent-price.js";
import type { AppContext } from "./context.js";
import { LocalTestPayments } from "../payments/provider.js";
import {
  customerIdFromToken,
  customerSecretReady,
  readCustomerCookie,
  signCustomerToken,
  writeCustomerCookie,
  clearCustomerCookie,
} from "./customer-token.js";
import { parseBody, routeParam } from "./params.js";
import { sendErr, sendOk, sendResult } from "./respond.js";
import { asyncRoute } from "./staff-guard.js";

const rentHold = z.object({
  carId: z.string(),
  pickup: z.string(),
  returnAt: z.string(),
  age: z.number().int(),
  primaryType: z.enum(CAR_TYPES),
  returnMode: z.enum(["lot", "address"]),
  returnAddress: z.string().optional(),
  insurancePackageId: z.string().nullable().optional(),
});

const accountBody = z.object({
  fullName: z.string(),
  phone: z.string(),
  email: z.string(),
  birthDate: z.string(),
  password: z.string(),
});

const payBody = z.object({ acceptPrice: z.boolean().optional() });

/** Jerusalem wall time `YYYY-MM-DDTHH:mm`, not the browser's timezone. */
function parseJerusalemMinute(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (match === null) return null;
  const yearText = match[1];
  const monthText = match[2];
  const dayText = match[3];
  const hourText = match[4];
  const minuteText = match[5];
  if (
    yearText === undefined ||
    monthText === undefined ||
    dayText === undefined ||
    hourText === undefined ||
    minuteText === undefined
  ) {
    return null;
  }
  const civil = parseCivilDate(`${yearText}-${monthText}-${dayText}`);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  if (civil === null || hour > 23 || minute > 59) return null;
  return instantInJerusalem(civil.year, civil.month, civil.day, hour, minute);
}

function customerId(context: AppContext, req: Request): string | null {
  if (!customerSecretReady(context.customerJwtSecret)) return null;
  const token = readCustomerCookie(req);
  if (token === null) return null;
  return customerIdFromToken(context.customerJwtSecret, token);
}

function holdToken(req: Request): string | null {
  const value = req.header("x-hold-token");
  return value === undefined || value.trim() === "" ? null : value.trim();
}

/** Confirms a local test checkout. A configured Stripe key never reaches this. */
async function settleLocalCheckout(context: AppContext, orderId: string) {
  return confirmPayment(
    context.store,
    {
      providerEventId: `local-${orderId}`,
      orderId,
      outcome: "paid",
      providerRef: `local_${orderId}`,
    },
    context.mailer,
    context.now(),
  );
}

/** Customer account, holds, and checkout. Staff cookies are ignored here. */
export function customerRouter(context: AppContext): Router {
  const router = Router();
  const { store, geocoder, payments } = context;

  router.post(
    "/account/register",
    asyncRoute(async (req, res) => {
      const body = parseBody(accountBody, req.body);
      if (!body.ok) return sendResult(res, body);
      if (!customerSecretReady(context.customerJwtSecret)) return sendErr(res, "INTERNAL");
      const created = await registerCustomer(store, body.value, context.now());
      if (!created.ok) return sendResult(res, created);
      writeCustomerCookie(
        res,
        signCustomerToken(context.customerJwtSecret, created.value.id),
        context.secureCookies,
      );
      sendOk(res, { id: created.value.id });
    }),
  );

  router.post(
    "/account/login",
    asyncRoute(async (req, res) => {
      const body = parseBody(z.object({ email: z.string(), password: z.string() }), req.body);
      if (!body.ok) return sendResult(res, body);
      if (!customerSecretReady(context.customerJwtSecret)) return sendErr(res, "INTERNAL");
      const customer = await loginCustomer(store, body.value.email, body.value.password);
      if (!customer.ok) return sendResult(res, customer);
      writeCustomerCookie(
        res,
        signCustomerToken(context.customerJwtSecret, customer.value.id),
        context.secureCookies,
      );
      sendOk(res, { id: customer.value.id });
    }),
  );

  router.post("/account/logout", (_req, res) => {
    clearCustomerCookie(res, context.secureCookies);
    sendOk(res, { signedOut: true });
  });

  router.get(
    "/account",
    asyncRoute(async (req, res) => {
      const id = customerId(context, req);
      if (id === null) return sendErr(res, "UNAUTHENTICATED");
      sendResult(res, await readAccount(store, id));
    }),
  );

  router.post(
    "/rent/holds",
    asyncRoute(async (req, res) => {
      const body = parseBody(rentHold, req.body);
      if (!body.ok) return sendResult(res, body);
      if (!isUuid(body.value.carId)) return sendErr(res, "NOT_FOUND");
      const pickupAt = parseJerusalemMinute(body.value.pickup);
      const returnAt = parseJerusalemMinute(body.value.returnAt);
      if (pickupAt === null || returnAt === null) return sendErr(res, "INVALID_INPUT");
      const query: RentQuery = {
        pickupAt,
        returnAt,
        age: body.value.age,
        primaryType: body.value.primaryType,
        returnMode: body.value.returnMode,
        returnAddress: body.value.returnAddress ?? "",
        tagId: null,
      };
      const insurance =
        body.value.insurancePackageId === undefined ? null : body.value.insurancePackageId;
      sendResult(
        res,
        await holdRental(store, geocoder, body.value.carId, query, insurance, context.now()),
      );
    }),
  );

  router.get(
    "/rent/orders/:id",
    asyncRoute(async (req, res) => {
      const id = routeParam(req.params.id);
      if (id === null || !isUuid(id)) return sendErr(res, "NOT_FOUND");
      sendResult(
        res,
        await readRentalOrder(
          store,
          geocoder,
          id,
          customerId(context, req),
          holdToken(req),
          context.now(),
        ),
      );
    }),
  );

  router.post(
    "/rent/orders/:id/pay",
    asyncRoute(async (req, res) => {
      const id = routeParam(req.params.id);
      const body = parseBody(payBody, req.body ?? {});
      const signedIn = customerId(context, req);
      const token = holdToken(req);
      if (id === null || !isUuid(id) || token === null) return sendErr(res, "NOT_FOUND");
      if (!body.ok) return sendResult(res, body);
      if (signedIn === null) return sendErr(res, "UNAUTHENTICATED");
      const paid = await payRental(
        store,
        geocoder,
        payments,
        {
          orderId: id,
          customerId: signedIn,
          holdToken: token,
          acceptPrice: body.value.acceptPrice === true,
          successUrl: `${context.appUrl}/rent/orders/${id}`,
          cancelUrl: `${context.appUrl}/rent/checkout?order=${id}`,
        },
        context.now(),
      );
      if (!paid.ok) return sendResult(res, paid);
      if (payments instanceof LocalTestPayments) {
        const settled = await settleLocalCheckout(context, id);
        if (!settled.ok) return sendResult(res, settled);
      }
      sendResult(res, paid);
    }),
  );

  router.post(
    "/buy/holds",
    asyncRoute(async (req, res) => {
      const body = parseBody(
        z.object({
          carId: z.string(),
          wantsFinancing: z.boolean(),
          financingNote: z.string(),
          wantsTradeIn: z.boolean(),
          tradeInNote: z.string(),
        }),
        req.body,
      );
      if (!body.ok) return sendResult(res, body);
      if (!isUuid(body.value.carId)) return sendErr(res, "NOT_FOUND");
      sendResult(res, await holdSale(store, body.value, context.now()));
    }),
  );

  router.get(
    "/buy/orders/:id",
    asyncRoute(async (req, res) => {
      const id = routeParam(req.params.id);
      if (id === null || !isUuid(id)) return sendErr(res, "NOT_FOUND");
      sendResult(res, await readSaleOrder(store, id, customerId(context, req), holdToken(req)));
    }),
  );

  router.post(
    "/buy/orders/:id/pay",
    asyncRoute(async (req, res) => {
      const id = routeParam(req.params.id);
      const body = parseBody(payBody, req.body ?? {});
      const signedIn = customerId(context, req);
      const token = holdToken(req);
      if (id === null || !isUuid(id) || token === null) return sendErr(res, "NOT_FOUND");
      if (!body.ok) return sendResult(res, body);
      if (signedIn === null) return sendErr(res, "UNAUTHENTICATED");
      const paid = await paySale(
        store,
        payments,
        {
          orderId: id,
          customerId: signedIn,
          holdToken: token,
          acceptPrice: body.value.acceptPrice === true,
          successUrl: `${context.appUrl}/buy/orders/${id}`,
          cancelUrl: `${context.appUrl}/buy/checkout?order=${id}`,
        },
        context.now(),
      );
      if (!paid.ok) return sendResult(res, paid);
      if (payments instanceof LocalTestPayments) {
        const settled = await settleLocalCheckout(context, id);
        if (!settled.ok) return sendResult(res, settled);
      }
      sendResult(res, paid);
    }),
  );

  return router;
}
