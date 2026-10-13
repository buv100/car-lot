import { Router } from "express";
import { z } from "zod";

import { isUuid } from "../domain/car-fields.js";
import { agorot, type Agorot } from "../domain/money.js";
import { detectPhotoKind, photoContentType } from "../domain/photo.js";
import { CONDITION_GRADES } from "../domain/sale.js";
import { err, ok, type Result } from "../domain/result.js";
import { parseCivilDate } from "../domain/time.js";
import { decodePhoto } from "../services/car-photos.js";
import { retryOutbox } from "../services/deliver-mail.js";
import { completeChecklist, previewChecklistCharges } from "../services/complete-checklist.js";
import { completeDeepTreatment, salePriceOrNull } from "../services/deep-treatment.js";
import {
  getRentalDesk,
  handOverRental,
  listRentalDesk,
  markNoShow,
  markReturned,
} from "../services/rental-desk.js";
import { cancelRentalByYard } from "../services/rental-cancel.js";
import { handOverSale, listSaleDesk } from "../services/sale-desk.js";
import { staffBoard } from "../services/staff-board.js";
import type { AppContext } from "./context.js";
import { parseBody, queryStrings, routeParam } from "./params.js";
import { sendErr, sendResult } from "./respond.js";
import { asyncRoute, currentStaff } from "./staff-guard.js";

const bandBody = z.object({
  minAge: z.number().int(),
  maxAge: z.number().int().nullable(),
  weekdayShekels: z.number().int(),
  weekendShekels: z.number().int(),
  holidayShekels: z.number().int(),
});

function wholeShekels(value: number): Result<Agorot> {
  if (!Number.isInteger(value) || value < 0) return err("INVALID_INPUT");
  return ok(agorot(value));
}

function orderId(value: string | string[] | undefined): string | null {
  const id = routeParam(value);
  if (id === null || !isUuid(id)) return null;
  return id;
}

/** Yard handover, checklist, and sale desk. Mounted behind the staff session. */
export function deskRouter(context: AppContext): Router {
  const router = Router();
  const { store, files, payments } = context;

  router.get(
    "/board",
    asyncRoute(async (req, res) => {
      sendResult(res, await staffBoard(store, currentStaff(req), context.now()));
    }),
  );

  router.get(
    "/rentals",
    asyncRoute(async (req, res) => {
      const status = queryStrings(req.query).status ?? null;
      sendResult(res, await listRentalDesk(store, currentStaff(req), status));
    }),
  );

  router.get(
    "/rentals/:id",
    asyncRoute(async (req, res) => {
      const id = orderId(req.params.id);
      if (id === null) return sendErr(res, "NOT_FOUND");
      sendResult(res, await getRentalDesk(store, currentStaff(req), id));
    }),
  );

  router.post(
    "/rentals/:id/handover",
    asyncRoute(async (req, res) => {
      const id = orderId(req.params.id);
      const body = parseBody(z.object({ startKm: z.number().int().nonnegative() }), req.body);
      if (id === null) return sendErr(res, "NOT_FOUND");
      if (!body.ok) return sendResult(res, body);
      sendResult(res, await handOverRental(store, currentStaff(req), id, body.value.startKm));
    }),
  );

  router.post(
    "/rentals/:id/returned",
    asyncRoute(async (req, res) => {
      const id = orderId(req.params.id);
      if (id === null) return sendErr(res, "NOT_FOUND");
      sendResult(res, await markReturned(store, currentStaff(req), id));
    }),
  );

  router.post(
    "/rentals/:id/no-show",
    asyncRoute(async (req, res) => {
      const id = orderId(req.params.id);
      const body = parseBody(
        z.object({ washNeeded: z.boolean(), treatmentNeeded: z.boolean() }),
        req.body,
      );
      if (id === null) return sendErr(res, "NOT_FOUND");
      if (!body.ok) return sendResult(res, body);
      sendResult(res, await markNoShow(store, currentStaff(req), id, context.now(), body.value));
    }),
  );

  router.post(
    "/rentals/:id/cancel",
    asyncRoute(async (req, res) => {
      const id = orderId(req.params.id);
      const body = parseBody(z.object({ note: z.string() }), req.body);
      if (id === null) return sendErr(res, "NOT_FOUND");
      if (!body.ok) return sendResult(res, body);
      sendResult(
        res,
        await cancelRentalByYard(
          store,
          payments,
          context.mailer,
          currentStaff(req),
          id,
          body.value.note,
          context.now(),
        ),
      );
    }),
  );

  router.post(
    "/rentals/:id/checklist/preview",
    asyncRoute(async (req, res) => {
      const id = orderId(req.params.id);
      const body = parseBody(
        z.object({ endKm: z.number().int().nonnegative(), fuelLitersShort: z.number() }),
        req.body,
      );
      if (id === null) return sendErr(res, "NOT_FOUND");
      if (!body.ok) return sendResult(res, body);
      sendResult(
        res,
        await previewChecklistCharges(
          store,
          currentStaff(req),
          id,
          body.value.endKm,
          body.value.fuelLitersShort,
        ),
      );
    }),
  );

  router.post(
    "/rentals/:id/checklist",
    asyncRoute(async (req, res) => {
      const id = orderId(req.params.id);
      const body = parseBody(
        z.object({
          endKm: z.number().int().nonnegative().nullable(),
          fuelLitersShort: z.number().nullable(),
          washNeeded: z.boolean(),
          washDone: z.boolean(),
          treatmentNeeded: z.boolean(),
          treatmentDone: z.boolean(),
          treatmentNote: z.string(),
          priceDecision: z.enum(["keep", "update"]).nullable(),
          minAge: z.number().int().nullable(),
          bands: z.array(bandBody).nullable(),
          returnPhotos: z.array(z.string()),
          damages: z.array(
            z.object({
              description: z.string(),
              estimatedShekels: z.number().int().nonnegative(),
              photos: z.array(z.string()),
            }),
          ),
        }),
        req.body,
      );
      if (id === null) return sendErr(res, "NOT_FOUND");
      if (!body.ok) return sendResult(res, body);
      const returnPhotos = [];
      for (const photo of body.value.returnPhotos) {
        const decoded = decodePhoto(photo);
        if (!decoded.ok) return sendResult(res, decoded);
        returnPhotos.push(decoded.value);
      }
      const damages = [];
      for (const damage of body.value.damages) {
        const money = wholeShekels(damage.estimatedShekels);
        if (!money.ok) return sendResult(res, money);
        const photos = [];
        for (const photo of damage.photos) {
          const decoded = decodePhoto(photo);
          if (!decoded.ok) return sendResult(res, decoded);
          photos.push(decoded.value);
        }
        damages.push({
          description: damage.description,
          estimatedAgorot: money.value,
          photos,
        });
      }
      const bands =
        body.value.bands === null
          ? null
          : body.value.bands.map((band) => ({
              minAge: band.minAge,
              maxAge: band.maxAge,
              weekdayDailyAgorot: agorot(band.weekdayShekels),
              weekendDailyAgorot: agorot(band.weekendShekels),
              holidayDailyAgorot: agorot(band.holidayShekels),
            }));
      sendResult(
        res,
        await completeChecklist(
          store,
          files,
          payments,
          currentStaff(req),
          id,
          { ...body.value, returnPhotos, damages, bands },
          context.now(),
          context.mailer,
        ),
      );
    }),
  );

  router.get(
    "/photos/:id",
    asyncRoute(async (req, res) => {
      const id = orderId(req.params.id);
      if (id === null) return sendErr(res, "NOT_FOUND");
      const allowed = await staffBoard(store, currentStaff(req), context.now());
      if (!allowed.ok) return sendResult(res, allowed);
      let bytes: Uint8Array;
      try {
        bytes = await files.readPrivatePhoto(id);
      } catch {
        return sendErr(res, "NOT_FOUND");
      }
      const kind = detectPhotoKind(bytes);
      if (kind === null) return sendErr(res, "NOT_FOUND");
      res.setHeader("Content-Type", photoContentType(kind));
      res.status(200).send(Buffer.from(bytes));
    }),
  );

  router.get(
    "/sales",
    asyncRoute(async (req, res) => {
      sendResult(res, await listSaleDesk(store, currentStaff(req)));
    }),
  );

  router.post(
    "/sales/:id/handover",
    asyncRoute(async (req, res) => {
      const id = orderId(req.params.id);
      if (id === null) return sendErr(res, "NOT_FOUND");
      sendResult(res, await handOverSale(store, currentStaff(req), id, context.now()));
    }),
  );

  router.post(
    "/cars/:id/deep-treatment",
    asyncRoute(async (req, res) => {
      const id = orderId(req.params.id);
      const body = parseBody(
        z.object({
          ownersCount: z.number().int().nullable(),
          knownAccidents: z.string().nullable(),
          accidentsNone: z.boolean(),
          conditionGrade: z.enum(CONDITION_GRADES).nullable(),
          salePriceShekels: z.number().int().nullable(),
          completedAt: z.string(),
        }),
        req.body,
      );
      if (id === null) return sendErr(res, "NOT_FOUND");
      if (!body.ok) return sendResult(res, body);
      const completedAt = parseCivilDate(body.value.completedAt);
      sendResult(
        res,
        await completeDeepTreatment(
          store,
          currentStaff(req),
          id,
          {
            ownersCount: body.value.ownersCount,
            knownAccidents: body.value.knownAccidents,
            accidentsNone: body.value.accidentsNone,
            conditionGrade: body.value.conditionGrade,
            salePriceAgorot: salePriceOrNull(body.value.salePriceShekels),
            completedAt:
              completedAt === null
                ? null
                : new Date(Date.UTC(completedAt.year, completedAt.month - 1, completedAt.day)),
          },
          context.now(),
        ),
      );
    }),
  );

  router.post(
    "/outbox/:id/retry",
    asyncRoute(async (req, res) => {
      const id = orderId(req.params.id);
      if (id === null) return sendErr(res, "NOT_FOUND");
      sendResult(
        res,
        await retryOutbox(store, context.mailer, currentStaff(req), id, context.now()),
      );
    }),
  );

  return router;
}
