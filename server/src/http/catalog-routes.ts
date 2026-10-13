import { Router } from "express";
import { z } from "zod";

import { isUuid } from "../domain/car-fields.js";
import { type ConditionGrade } from "../domain/sale.js";
import { CAR_TYPES } from "../domain/status.js";
import { instantInJerusalem, parseCivilDate } from "../domain/time.js";
import { publicLot, publicTags } from "../services/catalog-home.js";
import { getFleetCar, listFleet } from "../services/catalog-fleet.js";
import { quoteRentalCar, searchRentals, type RentQuery } from "../services/catalog-rent.js";
import { getSaleCar, searchSales } from "../services/catalog-sale.js";
import { detectPhotoKind, photoContentType } from "../domain/photo.js";
import type { AppContext } from "./context.js";
import { parseBody, queryStrings, routeParam } from "./params.js";
import { sendErr, sendResult } from "./respond.js";
import { asyncRoute } from "./staff-guard.js";

const rentSearch = z.object({
  pickup: z.string().min(1),
  returnAt: z.string().min(1),
  age: z.string().regex(/^[0-9]+$/),
  primaryType: z.string().optional(),
  returnMode: z.enum(["lot", "address"]),
  returnAddress: z.string().optional(),
  tagId: z.string().optional(),
  insurancePackageId: z.string().optional(),
});

const saleSearch = z.object({
  maxKm: z.string().regex(/^[1-9][0-9]*$/),
  condition: z.enum(["excellent", "good", "fair", "any"]),
  primaryType: z.string().optional(),
  tagId: z.string().optional(),
});

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

function optionalId(value: string | undefined): { id: string | null } | null {
  if (value === undefined || value.trim() === "") return { id: null };
  if (!isUuid(value)) return null;
  return { id: value };
}

function rentQuery(input: z.infer<typeof rentSearch>): RentQuery | null {
  const pickupAt = parseJerusalemMinute(input.pickup);
  const returnAt = parseJerusalemMinute(input.returnAt);
  const age = Number(input.age);
  if (pickupAt === null || returnAt === null || !Number.isInteger(age)) return null;
  const typeText = input.primaryType?.trim() ?? "";
  const primaryType = typeText === "" ? null : CAR_TYPES.find((type) => type === typeText);
  if (typeText !== "" && primaryType === undefined) return null;
  return {
    pickupAt,
    returnAt,
    age,
    primaryType: primaryType ?? null,
    returnMode: input.returnMode,
    returnAddress: input.returnAddress ?? "",
    tagId: null,
  };
}

/** Public catalog. These routes do not accept a staff or customer token. */
export function catalogRouter(context: AppContext): Router {
  const router = Router();
  const { store, geocoder } = context;

  router.get(
    "/catalog/lot",
    asyncRoute(async (_req, res) => {
      sendResult(res, await publicLot(store));
    }),
  );

  router.get(
    "/catalog/tags",
    asyncRoute(async (_req, res) => {
      sendResult(res, await publicTags(store));
    }),
  );

  router.get(
    "/rent/search",
    asyncRoute(async (req, res) => {
      const parsed = parseBody(rentSearch, queryStrings(req.query));
      if (!parsed.ok) return sendResult(res, parsed);
      const tag = optionalId(parsed.value.tagId);
      if (tag === null) return sendErr(res, "INVALID_INPUT");
      const query = rentQuery(parsed.value);
      if (query === null) return sendErr(res, "INVALID_INPUT");
      sendResult(
        res,
        await searchRentals(store, geocoder, { ...query, tagId: tag.id }, context.now()),
      );
    }),
  );

  router.get(
    "/rent/cars/:id",
    asyncRoute(async (req, res) => {
      const id = routeParam(req.params.id);
      const parsed = parseBody(rentSearch, queryStrings(req.query));
      if (id === null || !isUuid(id)) return sendErr(res, "NOT_FOUND");
      if (!parsed.ok) return sendResult(res, parsed);
      const tag = optionalId(parsed.value.tagId);
      const insurance = optionalId(parsed.value.insurancePackageId);
      if (tag === null || insurance === null) return sendErr(res, "INVALID_INPUT");
      const query = rentQuery(parsed.value);
      if (query === null) return sendErr(res, "INVALID_INPUT");
      sendResult(
        res,
        await quoteRentalCar(
          store,
          geocoder,
          id,
          { ...query, tagId: tag.id },
          insurance.id,
          context.now(),
        ),
      );
    }),
  );

  router.get(
    "/buy/all",
    asyncRoute(async (_req, res) => {
      sendResult(res, await listFleet(store));
    }),
  );

  router.get(
    "/buy/all/:id",
    asyncRoute(async (req, res) => {
      const id = routeParam(req.params.id);
      if (id === null || !isUuid(id)) return sendErr(res, "NOT_FOUND");
      sendResult(res, await getFleetCar(store, id));
    }),
  );

  router.get(
    "/buy/search",
    asyncRoute(async (req, res) => {
      const parsed = parseBody(saleSearch, queryStrings(req.query));
      if (!parsed.ok) return sendResult(res, parsed);
      const tag = optionalId(parsed.value.tagId);
      if (tag === null) return sendErr(res, "INVALID_INPUT");
      const typeText = parsed.value.primaryType?.trim() ?? "";
      const primaryType = typeText === "" ? null : CAR_TYPES.find((type) => type === typeText);
      if (typeText !== "" && primaryType === undefined) return sendErr(res, "INVALID_INPUT");
      const condition = parsed.value.condition;
      sendResult(
        res,
        await searchSales(
          store,
          {
            maxKm: Number(parsed.value.maxKm),
            condition: condition satisfies ConditionGrade | "any",
            primaryType: primaryType ?? null,
            tagId: tag.id,
          },
          context.now(),
        ),
      );
    }),
  );

  router.get(
    "/buy/cars/:id",
    asyncRoute(async (req, res) => {
      const id = routeParam(req.params.id);
      if (id === null || !isUuid(id)) return sendErr(res, "NOT_FOUND");
      sendResult(res, await getSaleCar(store, id, context.now()));
    }),
  );

  return router;
}

/** Public car photo. The path is two ids, never a plate. */
export function mediaRouter(context: AppContext): Router {
  const router = Router();
  router.get(
    "/cars/:carId/:photoId",
    asyncRoute(async (req, res) => {
      const carId = routeParam(req.params.carId);
      const photoId = routeParam(req.params.photoId);
      if (carId === null || photoId === null || !isUuid(carId) || !isUuid(photoId)) {
        sendErr(res, "NOT_FOUND");
        return;
      }
      try {
        const bytes = await context.files.readCarPhoto(carId, photoId);
        const kind = detectPhotoKind(bytes);
        if (kind === null) {
          sendErr(res, "NOT_FOUND");
          return;
        }
        res.status(200).type(photoContentType(kind)).send(Buffer.from(bytes));
      } catch {
        sendErr(res, "NOT_FOUND");
      }
    }),
  );
  return router;
}
