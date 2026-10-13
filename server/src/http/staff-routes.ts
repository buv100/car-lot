import { Router } from "express";
import { z } from "zod";

import { isUuid } from "../domain/car-fields.js";
import { addCarPhoto, decodePhoto, removeCarPhoto } from "../services/car-photos.js";
import { agorot } from "../domain/money.js";
import { saveAgeBands } from "../services/save-age-bands.js";
import { changeCarStatus } from "../services/car-status.js";
import { createCar, getStaffCar, listStaffCars, updateCar } from "../services/cars.js";
import { adjustKm } from "../services/adjust-km.js";
import {
  createStaffAccount,
  listStaffAccounts,
  updateStaffAccount,
} from "../services/staff-accounts.js";
import { loginStaff } from "../services/login-staff.js";
import { decideSaleRefund } from "../services/sale-refund.js";
import {
  addHoliday,
  listTagsForCars,
  removeHoliday,
  saveInsurance,
} from "../services/settings-lists.js";
import { updateLotSettings } from "../services/lot-settings.js";
import { geocodeLotAddress, readSettings } from "../services/settings-lot.js";
import { createTag, updateTag } from "../services/tags.js";
import type { AppContext } from "./context.js";
import { deskRouter } from "./desk-routes.js";
import { historyJson } from "./present.js";
import { parseBody, routeParam } from "./params.js";
import { sendErr, sendOk, sendResult } from "./respond.js";
import { asyncRoute, currentStaff, requireStaff, sendSession } from "./staff-guard.js";
import {
  clearStaffCookie,
  signStaffToken,
  staffSecretReady,
  writeStaffCookie,
} from "./staff-token.js";

const carBody = z.object({
  plate: z.string(),
  vin: z.string().nullable(),
  make: z.string(),
  model: z.string(),
  year: z.number(),
  color: z.string(),
  primaryType: z.string(),
  seats: z.number(),
  currentKm: z.number(),
  purchasedAt: z.string(),
  minAge: z.number().int().nullable().optional(),
  internalNotes: z.string(),
  tagIds: z.array(z.string()),
});

const destinations = ["available", "in_care", "deep_treatment"] as const;
const careReasons = ["wash", "treatment", "other"] as const;

/** Staff JSON API. Customer tokens are not accepted on this router. */
export function staffRouter(context: AppContext): Router {
  const router = Router();
  const { store, files, geocoder } = context;

  router.post(
    "/login",
    asyncRoute(async (req, res) => {
      const body = parseBody(z.object({ email: z.string(), password: z.string() }), req.body);
      if (!body.ok) return sendResult(res, body);
      if (!staffSecretReady(context.staffJwtSecret)) return sendErr(res, "INTERNAL");
      const staff = await loginStaff(store, body.value.email, body.value.password);
      if (!staff.ok) return sendResult(res, staff);
      writeStaffCookie(
        res,
        signStaffToken(context.staffJwtSecret, staff.value.id, staff.value.role),
        context.secureCookies,
      );
      sendSession(res, staff.value);
    }),
  );

  router.post("/logout", (_req, res) => {
    clearStaffCookie(res, context.secureCookies);
    sendOk(res, { signedOut: true });
  });

  router.use(requireStaff(context));

  router.get("/session", (req, res) => {
    sendSession(res, currentStaff(req));
  });

  router.get(
    "/cars",
    asyncRoute(async (req, res) => {
      sendResult(res, await listStaffCars(store, currentStaff(req), context.now()));
    }),
  );

  router.post(
    "/cars",
    asyncRoute(async (req, res) => {
      const body = parseBody(carBody, req.body);
      if (!body.ok) return sendResult(res, body);
      sendResult(
        res,
        await createCar(
          store,
          currentStaff(req),
          { ...body.value, minAge: body.value.minAge ?? null },
          context.now(),
        ),
      );
    }),
  );

  router.get(
    "/cars/:id",
    asyncRoute(async (req, res) => {
      const id = routeParam(req.params.id);
      if (id === null || !isUuid(id)) return sendErr(res, "NOT_FOUND");
      sendResult(res, await getStaffCar(store, currentStaff(req), id, context.now()));
    }),
  );

  router.patch(
    "/cars/:id",
    asyncRoute(async (req, res) => {
      const id = routeParam(req.params.id);
      const body = parseBody(carBody, req.body);
      if (id === null || !isUuid(id)) return sendErr(res, "NOT_FOUND");
      if (!body.ok) return sendResult(res, body);
      sendResult(res, await updateCar(store, currentStaff(req), id, body.value, context.now()));
    }),
  );

  router.post(
    "/cars/:id/status",
    asyncRoute(async (req, res) => {
      const id = routeParam(req.params.id);
      const body = parseBody(
        z.object({
          to: z.enum(destinations),
          careReason: z.enum(careReasons).optional(),
        }),
        req.body,
      );
      if (id === null || !isUuid(id)) return sendErr(res, "NOT_FOUND");
      if (!body.ok) return sendResult(res, body);
      sendResult(
        res,
        await changeCarStatus(store, currentStaff(req), id, body.value, context.now()),
      );
    }),
  );

  router.put(
    "/cars/:id/age-bands",
    asyncRoute(async (req, res) => {
      const id = routeParam(req.params.id);
      const body = parseBody(
        z.object({
          minAge: z.number(),
          bands: z.array(
            z.object({
              minAge: z.number(),
              maxAge: z.number().nullable(),
              weekdayShekels: z.number(),
              weekendShekels: z.number(),
              holidayShekels: z.number(),
            }),
          ),
        }),
        req.body,
      );
      if (id === null || !isUuid(id)) return sendErr(res, "NOT_FOUND");
      if (!body.ok) return sendResult(res, body);
      const whole = body.value.bands.every(
        (band) =>
          Number.isInteger(band.weekdayShekels) &&
          band.weekdayShekels >= 0 &&
          Number.isInteger(band.weekendShekels) &&
          band.weekendShekels >= 0 &&
          Number.isInteger(band.holidayShekels) &&
          band.holidayShekels >= 0,
      );
      if (!whole) return sendErr(res, "INVALID_INPUT");
      const bands = body.value.bands.map((band) => ({
        minAge: band.minAge,
        maxAge: band.maxAge,
        weekdayDailyAgorot: agorot(band.weekdayShekels),
        weekendDailyAgorot: agorot(band.weekendShekels),
        holidayDailyAgorot: agorot(band.holidayShekels),
      }));
      sendResult(
        res,
        await saveAgeBands(store, currentStaff(req), id, body.value.minAge, bands, context.now()),
      );
    }),
  );

  router.post(
    "/cars/:id/photos",
    asyncRoute(async (req, res) => {
      const id = routeParam(req.params.id);
      const body = parseBody(z.object({ alt: z.string(), contentBase64: z.string() }), req.body);
      if (id === null || !isUuid(id)) return sendErr(res, "NOT_FOUND");
      if (!body.ok) return sendResult(res, body);
      const bytes = decodePhoto(body.value.contentBase64);
      if (!bytes.ok) return sendResult(res, bytes);
      sendResult(
        res,
        await addCarPhoto(
          store,
          files,
          currentStaff(req),
          id,
          body.value.alt,
          bytes.value,
          context.now(),
        ),
      );
    }),
  );

  router.delete(
    "/cars/:id/photos/:photoId",
    asyncRoute(async (req, res) => {
      const id = routeParam(req.params.id);
      const photoId = routeParam(req.params.photoId);
      if (id === null || photoId === null || !isUuid(id) || !isUuid(photoId))
        return sendErr(res, "NOT_FOUND");
      sendResult(
        res,
        await removeCarPhoto(store, files, currentStaff(req), id, photoId, context.now()),
      );
    }),
  );

  router.post(
    "/cars/:id/km",
    asyncRoute(async (req, res) => {
      const id = routeParam(req.params.id);
      const body = parseBody(z.object({ nextKm: z.number(), reason: z.string() }), req.body);
      if (id === null || !isUuid(id)) return sendErr(res, "NOT_FOUND");
      if (!body.ok) return sendResult(res, body);
      sendResult(
        res,
        await adjustKm(
          store,
          currentStaff(req),
          id,
          body.value.nextKm,
          body.value.reason,
          context.now(),
          context.mailer,
        ),
      );
    }),
  );

  router.get(
    "/tags",
    asyncRoute(async (req, res) => {
      sendResult(res, await listTagsForCars(store, currentStaff(req)));
    }),
  );

  router.get(
    "/settings",
    asyncRoute(async (req, res) => {
      const bundle = await readSettings(store, currentStaff(req));
      if (!bundle.ok) return sendResult(res, bundle);
      sendOk(res, {
        ...bundle.value,
        history: bundle.value.history.map((change) => historyJson(change)),
      });
    }),
  );

  router.patch(
    "/settings",
    asyncRoute(async (req, res) => {
      const body = parseBody(
        z.object({
          name: z.string(),
          address: z.string(),
          latitude: z.number().nullable(),
          longitude: z.number().nullable(),
          phone: z.string(),
          publicEmail: z.string(),
          staffAlertEmail: z.string(),
          kmPerDay: z.number(),
          excessKmShekels: z.number(),
          fuelShekels: z.number(),
        }),
        req.body,
      );
      if (!body.ok) return sendResult(res, body);
      if (
        !Number.isInteger(body.value.excessKmShekels) ||
        body.value.excessKmShekels < 0 ||
        !Number.isInteger(body.value.fuelShekels) ||
        body.value.fuelShekels < 0
      ) {
        return sendErr(res, "INVALID_INPUT");
      }
      const { excessKmShekels, fuelShekels, ...lot } = body.value;
      sendResult(
        res,
        await updateLotSettings(
          store,
          geocoder,
          currentStaff(req),
          {
            ...lot,
            excessKmPriceAgorot: agorot(excessKmShekels),
            fuelShortagePricePerLiterAgorot: agorot(fuelShekels),
          },
          context.now(),
        ),
      );
    }),
  );

  router.post(
    "/settings/geocode",
    asyncRoute(async (req, res) => {
      const body = parseBody(z.object({ address: z.string() }), req.body);
      if (!body.ok) return sendResult(res, body);
      sendResult(res, await geocodeLotAddress(geocoder, currentStaff(req), body.value.address));
    }),
  );

  router.post(
    "/holidays",
    asyncRoute(async (req, res) => {
      const body = parseBody(z.object({ name: z.string(), date: z.string() }), req.body);
      if (!body.ok) return sendResult(res, body);
      sendResult(res, await addHoliday(store, currentStaff(req), body.value.name, body.value.date));
    }),
  );

  router.delete(
    "/holidays/:id",
    asyncRoute(async (req, res) => {
      const id = routeParam(req.params.id);
      if (id === null || !isUuid(id)) return sendErr(res, "NOT_FOUND");
      sendResult(res, await removeHoliday(store, currentStaff(req), id));
    }),
  );

  router.post(
    "/insurance",
    asyncRoute(async (req, res) => {
      const body = parseBody(insuranceBody, req.body);
      if (!body.ok) return sendResult(res, body);
      sendResult(
        res,
        await saveInsurance(store, currentStaff(req), null, body.value, context.now()),
      );
    }),
  );

  router.patch(
    "/insurance/:id",
    asyncRoute(async (req, res) => {
      const id = routeParam(req.params.id);
      const body = parseBody(insuranceBody, req.body);
      if (id === null || !isUuid(id)) return sendErr(res, "NOT_FOUND");
      if (!body.ok) return sendResult(res, body);
      sendResult(res, await saveInsurance(store, currentStaff(req), id, body.value, context.now()));
    }),
  );

  router.post(
    "/tags",
    asyncRoute(async (req, res) => {
      const body = parseBody(z.object({ name: z.string(), active: z.boolean() }), req.body);
      if (!body.ok) return sendResult(res, body);
      sendResult(
        res,
        await createTag(store, currentStaff(req), body.value.name, body.value.active),
      );
    }),
  );

  router.patch(
    "/tags/:id",
    asyncRoute(async (req, res) => {
      const id = routeParam(req.params.id);
      const body = parseBody(z.object({ name: z.string(), active: z.boolean() }), req.body);
      if (id === null || !isUuid(id)) return sendErr(res, "NOT_FOUND");
      if (!body.ok) return sendResult(res, body);
      sendResult(
        res,
        await updateTag(store, currentStaff(req), id, body.value.name, body.value.active),
      );
    }),
  );

  router.get(
    "/employees",
    asyncRoute(async (req, res) => {
      sendResult(res, await listStaffAccounts(store, currentStaff(req)));
    }),
  );

  router.post(
    "/employees",
    asyncRoute(async (req, res) => {
      const body = parseBody(
        z.object({
          fullName: z.string(),
          email: z.string(),
          password: z.string(),
          role: z.string(),
        }),
        req.body,
      );
      if (!body.ok) return sendResult(res, body);
      sendResult(res, await createStaffAccount(store, currentStaff(req), body.value));
    }),
  );

  router.patch(
    "/employees/:id",
    asyncRoute(async (req, res) => {
      const id = routeParam(req.params.id);
      const body = parseBody(
        z.object({
          fullName: z.string(),
          email: z.string(),
          password: z.string().nullable(),
          role: z.string(),
          active: z.boolean(),
        }),
        req.body,
      );
      if (id === null || !isUuid(id)) return sendErr(res, "NOT_FOUND");
      if (!body.ok) return sendResult(res, body);
      sendResult(res, await updateStaffAccount(store, currentStaff(req), id, body.value));
    }),
  );

  router.use(deskRouter(context));
  router.post(
    "/sales/:id/refund",
    asyncRoute(async (req, res) => {
      const id = routeParam(req.params.id);
      const body = parseBody(z.object({ approved: z.boolean() }), req.body);
      if (id === null || !isUuid(id)) return sendErr(res, "NOT_FOUND");
      if (!body.ok) return sendResult(res, body);
      sendResult(
        res,
        await decideSaleRefund(
          store,
          context.payments,
          currentStaff(req),
          id,
          body.value.approved,
          context.now(),
          context.mailer,
        ),
      );
    }),
  );

  return router;
}

const insuranceBody = z.object({
  name: z.string(),
  description: z.string(),
  dailyShekels: z.number(),
  includedInBase: z.boolean(),
  active: z.boolean(),
  sortOrder: z.number(),
});
