import { Prisma, type PrismaClient } from "@prisma/client";

import {
  RENTAL_STATUSES,
  SALE_STATUSES,
  type RentalStatus,
  type SaleStatus,
} from "../domain/status.js";
import { DuplicateRecord } from "./staff-store.js";
import type {
  ChecklistRecord,
  DamageRecord,
  RentalOrderRecord,
  SaleOrderRecord,
  StoredPriceLine,
} from "./staff-store.js";

type Db = PrismaClient | Prisma.TransactionClient;

function dateOrNull(value: Date | null): Date | null {
  return value;
}

function oneOfStatus<T extends string>(value: string, options: readonly T[]): T {
  for (const option of options) {
    if (option === value) return option;
  }
  throw new Error(`Unexpected stored status ${value}`);
}

function priceLines(value: Prisma.JsonValue): StoredPriceLine[] {
  if (!Array.isArray(value)) return [];
  const lines: StoredPriceLine[] = [];
  for (const item of value) {
    if (typeof item !== "object" || item === null || Array.isArray(item)) continue;
    const line = item as StoredPriceLine;
    if (
      typeof line.start !== "string" ||
      typeof line.hours !== "number" ||
      typeof line.dayKind !== "string" ||
      typeof line.agorot !== "number"
    ) {
      continue;
    }
    lines.push({
      start: line.start,
      hours: line.hours,
      dayKind: line.dayKind,
      agorot: line.agorot,
    });
  }
  return lines;
}

function rentalFrom(row: {
  id: string;
  number: string;
  carId: string;
  customerId: string | null;
  holderTokenHash: string | null;
  pickupAt: Date;
  returnAt: Date;
  searchAge: number;
  ageAtPickup: number;
  returnMode: string;
  returnAddress: string;
  returnLat: number | null;
  returnLng: number | null;
  straightLineKm: number;
  billedKm: number;
  deliveryFeeAgorot: number;
  insurancePackageId: string;
  rentalAgorot: number;
  insuranceAgorot: number;
  totalAgorot: number;
  priceLines: Prisma.JsonValue;
  kmAllowance: number;
  status: string;
  holdExpiresAt: Date | null;
  paymentProvider: string;
  paymentRef: string | null;
  startKm: number | null;
  noShow: boolean;
  cancelledBy: string | null;
  yardCancelNote: string;
  refundPercent: number | null;
  refundAgorot: number | null;
  reminderSentAt: Date | null;
}): RentalOrderRecord {
  const returnMode = row.returnMode === "address" ? "address" : "lot";
  return {
    ...row,
    returnMode,
    status: oneOfStatus<RentalStatus>(row.status, RENTAL_STATUSES),
    priceLines: priceLines(row.priceLines),
  };
}

function saleFrom(row: {
  id: string;
  number: string;
  carId: string;
  customerId: string | null;
  holderTokenHash: string | null;
  listPriceAgorot: number;
  depositAgorot: number;
  status: string;
  wantsFinancing: boolean;
  financingNote: string;
  wantsTradeIn: boolean;
  tradeInNote: string;
  holdExpiresAt: Date | null;
  paymentProvider: string;
  paymentRef: string | null;
  refundDecidedAt: Date | null;
  refundApproved: boolean | null;
  refundByStaffId: string | null;
  handoverAt: Date | null;
  handoverByStaffId: string | null;
}): SaleOrderRecord {
  return { ...row, status: oneOfStatus<SaleStatus>(row.status, SALE_STATUSES) };
}

function checklistFrom(row: {
  id: string;
  rentalOrderId: string;
  endKm: number | null;
  fuelLitersShort: Prisma.Decimal | null;
  fuelChargeAgorot: number | null;
  kmExcess: number | null;
  kmChargeAgorot: number | null;
  washNeeded: boolean;
  washDone: boolean;
  treatmentNeeded: boolean;
  treatmentDone: boolean;
  treatmentNote: string;
  priceDecision: string | null;
  completedAt: Date | null;
  completedByStaffId: string | null;
  photos: { id: string }[];
  damages: { id: string; description: string; estimatedAgorot: number; photos: { id: string }[] }[];
}): ChecklistRecord {
  return {
    id: row.id,
    rentalOrderId: row.rentalOrderId,
    endKm: row.endKm,
    fuelLitersShort: row.fuelLitersShort === null ? null : Number(row.fuelLitersShort),
    fuelChargeAgorot: row.fuelChargeAgorot,
    kmExcess: row.kmExcess,
    kmChargeAgorot: row.kmChargeAgorot,
    washNeeded: row.washNeeded,
    washDone: row.washDone,
    treatmentNeeded: row.treatmentNeeded,
    treatmentDone: row.treatmentDone,
    treatmentNote: row.treatmentNote,
    priceDecision: row.priceDecision,
    completedAt: row.completedAt,
    completedByStaffId: row.completedByStaffId,
    returnPhotoIds: row.photos.map((photo) => photo.id),
    damages: row.damages.map((damage): DamageRecord => ({
      id: damage.id,
      description: damage.description,
      estimatedAgorot: damage.estimatedAgorot,
      photoIds: damage.photos.map((photo) => photo.id),
    })),
  };
}

const checklistInclude = {
  photos: true,
  damages: { include: { photos: true } },
} satisfies Prisma.ChecklistInclude;

function fuelDecimal(liters: number | null): Prisma.Decimal | null {
  if (liters === null) return null;
  return new Prisma.Decimal(liters.toFixed(1));
}

/** All rental orders, newest pickup first. */
export async function listRentalOrders(db: Db): Promise<RentalOrderRecord[]> {
  const rows = await db.rentalOrder.findMany({ orderBy: { pickupAt: "desc" } });
  return rows.map(rentalFrom);
}

/** One rental, or null when the id is unknown. */
export async function findRentalOrder(db: Db, id: string): Promise<RentalOrderRecord | null> {
  const row = await db.rentalOrder.findUnique({ where: { id } });
  return row === null ? null : rentalFrom(row);
}

function uniqueOrDuplicate(error: unknown): never {
  if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
    throw new DuplicateRecord();
  }
  throw error;
}

/** Inserts a rental, including the price snapshot taken at the hold. */
export async function insertRentalOrder(db: Db, row: RentalOrderRecord): Promise<void> {
  try {
    await db.rentalOrder.create({
      data: {
        id: row.id,
        number: row.number,
        carId: row.carId,
        customerId: row.customerId,
        holderTokenHash: row.holderTokenHash,
        pickupAt: row.pickupAt,
        returnAt: row.returnAt,
        searchAge: row.searchAge,
        ageAtPickup: row.ageAtPickup,
        returnMode: row.returnMode,
        returnAddress: row.returnAddress,
        returnLat: row.returnLat,
        returnLng: row.returnLng,
        straightLineKm: row.straightLineKm,
        billedKm: row.billedKm,
        deliveryFeeAgorot: row.deliveryFeeAgorot,
        insurancePackageId: row.insurancePackageId,
        rentalAgorot: row.rentalAgorot,
        insuranceAgorot: row.insuranceAgorot,
        totalAgorot: row.totalAgorot,
        priceLines: row.priceLines,
        kmAllowance: row.kmAllowance,
        status: row.status,
        holdExpiresAt: dateOrNull(row.holdExpiresAt),
        paymentProvider: row.paymentProvider,
        paymentRef: row.paymentRef,
        startKm: row.startKm,
        noShow: row.noShow,
        cancelledBy: row.cancelledBy,
        yardCancelNote: row.yardCancelNote,
        refundPercent: row.refundPercent,
        refundAgorot: row.refundAgorot,
        reminderSentAt: row.reminderSentAt,
      },
    });
  } catch (error: unknown) {
    uniqueOrDuplicate(error);
  }
}

/** Writes payment, hold, and handover fields from the full order row. */
export async function updateRentalOrder(db: Db, row: RentalOrderRecord): Promise<void> {
  await db.rentalOrder.update({
    where: { id: row.id },
    data: {
      customerId: row.customerId,
      holderTokenHash: row.holderTokenHash,
      status: row.status,
      holdExpiresAt: row.holdExpiresAt,
      ageAtPickup: row.ageAtPickup,
      rentalAgorot: row.rentalAgorot,
      insuranceAgorot: row.insuranceAgorot,
      deliveryFeeAgorot: row.deliveryFeeAgorot,
      totalAgorot: row.totalAgorot,
      priceLines: row.priceLines,
      kmAllowance: row.kmAllowance,
      straightLineKm: row.straightLineKm,
      billedKm: row.billedKm,
      startKm: row.startKm,
      noShow: row.noShow,
      cancelledBy: row.cancelledBy,
      yardCancelNote: row.yardCancelNote,
      refundPercent: row.refundPercent,
      refundAgorot: row.refundAgorot,
      reminderSentAt: row.reminderSentAt,
      paymentRef: row.paymentRef,
    },
  });
}

/** The checklist for one rental, including damage and return photo ids. */
export async function findChecklist(
  db: Db,
  rentalOrderId: string,
): Promise<ChecklistRecord | null> {
  const row = await db.checklist.findUnique({
    where: { rentalOrderId },
    include: checklistInclude,
  });
  return row === null ? null : checklistFrom(row);
}

/** Replaces checklist rows so a second save does not leave old damage photos. */
export async function saveChecklist(db: Db, row: ChecklistRecord): Promise<void> {
  const existing = await db.checklist.findUnique({ where: { rentalOrderId: row.rentalOrderId } });
  const data = {
    endKm: row.endKm,
    fuelLitersShort: fuelDecimal(row.fuelLitersShort),
    fuelChargeAgorot: row.fuelChargeAgorot,
    kmExcess: row.kmExcess,
    kmChargeAgorot: row.kmChargeAgorot,
    washNeeded: row.washNeeded,
    washDone: row.washDone,
    treatmentNeeded: row.treatmentNeeded,
    treatmentDone: row.treatmentDone,
    treatmentNote: row.treatmentNote,
    priceDecision: row.priceDecision,
    completedAt: row.completedAt,
    completedByStaffId: row.completedByStaffId,
  };
  if (existing === null) {
    await db.checklist.create({ data: { id: row.id, rentalOrderId: row.rentalOrderId, ...data } });
  } else {
    await db.damagePhoto.deleteMany({ where: { damage: { checklistId: existing.id } } });
    await db.damage.deleteMany({ where: { checklistId: existing.id } });
    await db.checklistPhoto.deleteMany({ where: { checklistId: existing.id } });
    await db.checklist.update({ where: { id: existing.id }, data });
  }
  const saved = await db.checklist.findUniqueOrThrow({
    where: { rentalOrderId: row.rentalOrderId },
  });
  if (row.returnPhotoIds.length > 0) {
    await db.checklistPhoto.createMany({
      data: row.returnPhotoIds.map((id) => ({ id, checklistId: saved.id })),
    });
  }
  for (const damage of row.damages) {
    await db.damage.create({
      data: {
        id: damage.id,
        checklistId: saved.id,
        description: damage.description,
        estimatedAgorot: damage.estimatedAgorot,
        photos: { create: damage.photoIds.map((id) => ({ id })) },
      },
    });
  }
}

/** All sale orders. */
export async function listSaleOrders(db: Db): Promise<SaleOrderRecord[]> {
  const rows = await db.saleOrder.findMany({ orderBy: { number: "desc" } });
  return rows.map(saleFrom);
}

/** One sale order, or null. */
export async function findSaleOrder(db: Db, id: string): Promise<SaleOrderRecord | null> {
  const row = await db.saleOrder.findUnique({ where: { id } });
  return row === null ? null : saleFrom(row);
}

/** Inserts a sale order. The number is unique. */
export async function insertSaleOrder(db: Db, row: SaleOrderRecord): Promise<void> {
  try {
    await db.saleOrder.create({
      data: {
        id: row.id,
        number: row.number,
        carId: row.carId,
        customerId: row.customerId,
        holderTokenHash: row.holderTokenHash,
        listPriceAgorot: row.listPriceAgorot,
        depositAgorot: row.depositAgorot,
        status: row.status,
        wantsFinancing: row.wantsFinancing,
        financingNote: row.financingNote,
        wantsTradeIn: row.wantsTradeIn,
        tradeInNote: row.tradeInNote,
        holdExpiresAt: row.holdExpiresAt,
        paymentProvider: row.paymentProvider,
        paymentRef: row.paymentRef,
        refundDecidedAt: row.refundDecidedAt,
        refundApproved: row.refundApproved,
        refundByStaffId: row.refundByStaffId,
        handoverAt: row.handoverAt,
        handoverByStaffId: row.handoverByStaffId,
      },
    });
  } catch (error: unknown) {
    uniqueOrDuplicate(error);
  }
}

/** Writes payment, hold, and handover fields from the full sale row. */
export async function updateSaleOrder(db: Db, row: SaleOrderRecord): Promise<void> {
  await db.saleOrder.update({
    where: { id: row.id },
    data: {
      customerId: row.customerId,
      holderTokenHash: row.holderTokenHash,
      status: row.status,
      holdExpiresAt: row.holdExpiresAt,
      listPriceAgorot: row.listPriceAgorot,
      depositAgorot: row.depositAgorot,
      paymentRef: row.paymentRef,
      refundDecidedAt: row.refundDecidedAt,
      refundApproved: row.refundApproved,
      refundByStaffId: row.refundByStaffId,
      handoverAt: row.handoverAt,
      handoverByStaffId: row.handoverByStaffId,
    },
  });
}
