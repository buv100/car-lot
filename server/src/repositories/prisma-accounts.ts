import type { Prisma, PrismaClient } from "@prisma/client";

import type { CivilDate } from "../domain/time.js";
import { DuplicateRecord } from "./staff-store.js";
import type {
  CustomerRecord,
  OutboxRecord,
  PaymentEventRecord,
  RentalOrderRecord,
  SaleOrderRecord,
} from "./staff-store.js";
import {
  findRentalOrder,
  findSaleOrder,
  listRentalOrders,
  listSaleOrders,
} from "./prisma-orders.js";

type Db = PrismaClient | Prisma.TransactionClient;

function civilToDb(date: CivilDate): Date {
  return new Date(Date.UTC(date.year, date.month - 1, date.day));
}

function dbToCivil(date: Date): CivilDate {
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

function customerFrom(row: {
  id: string;
  fullName: string;
  phone: string;
  email: string;
  birthDate: Date;
  passwordHash: string;
  blocked: boolean;
  blockReason: string | null;
  blockNote: string;
  blockedAt: Date | null;
  blockedByStaffId: string | null;
  unblockedAt: Date | null;
  unblockedByStaffId: string | null;
}): CustomerRecord {
  return { ...row, birthDate: dbToCivil(row.birthDate) };
}

function customerData(customer: CustomerRecord) {
  return { ...customer, birthDate: civilToDb(customer.birthDate) };
}

export async function findCustomerByEmail(db: Db, email: string): Promise<CustomerRecord | null> {
  const row = await db.customer.findUnique({ where: { email } });
  return row === null ? null : customerFrom(row);
}

export async function findCustomerById(db: Db, id: string): Promise<CustomerRecord | null> {
  const row = await db.customer.findUnique({ where: { id } });
  return row === null ? null : customerFrom(row);
}

export async function insertCustomer(db: Db, customer: CustomerRecord): Promise<void> {
  try {
    await db.customer.create({ data: customerData(customer) });
  } catch (error: unknown) {
    if (isUniqueViolation(error)) throw new DuplicateRecord();
    throw error;
  }
}

export async function updateCustomer(db: Db, customer: CustomerRecord): Promise<void> {
  await db.customer.update({ where: { id: customer.id }, data: customerData(customer) });
}

export async function allocateSequence(db: Db, kind: "R" | "S", year: number): Promise<number> {
  const row = await db.orderSequence.upsert({
    where: { kind_year: { kind, year } },
    create: { kind, year, last: 1 },
    update: { last: { increment: 1 } },
  });
  return row.last;
}

export async function findRentalByHoldHash(
  db: Db,
  hash: string,
): Promise<RentalOrderRecord | null> {
  const row = await db.rentalOrder.findUnique({ where: { holderTokenHash: hash } });
  if (row === null) return null;
  return findRentalOrder(db, row.id);
}

export async function listRentalsForCustomer(
  db: Db,
  customerId: string,
): Promise<RentalOrderRecord[]> {
  const rows = await listRentalOrders(db);
  return rows.filter((row) => row.customerId === customerId);
}

export async function listRentalsByStatus(
  db: Db,
  status: RentalOrderRecord["status"],
): Promise<RentalOrderRecord[]> {
  const rows = await listRentalOrders(db);
  return rows.filter((row) => row.status === status);
}

export async function findSaleByHoldHash(db: Db, hash: string): Promise<SaleOrderRecord | null> {
  const row = await db.saleOrder.findUnique({ where: { holderTokenHash: hash } });
  if (row === null) return null;
  return findSaleOrder(db, row.id);
}

export async function listSalesForCustomer(db: Db, customerId: string): Promise<SaleOrderRecord[]> {
  const rows = await listSaleOrders(db);
  return rows.filter((row) => row.customerId === customerId);
}

export async function listSalesByStatus(
  db: Db,
  status: SaleOrderRecord["status"],
): Promise<SaleOrderRecord[]> {
  const rows = await listSaleOrders(db);
  return rows.filter((row) => row.status === status);
}

export async function insertOutbox(db: Db, row: OutboxRecord): Promise<void> {
  await db.emailOutbox.create({
    data: {
      id: row.id,
      to: row.to,
      subject: row.subject,
      body: row.body,
      status: row.status,
      attempts: row.attempts,
      lastError: row.lastError,
      createdAt: row.createdAt,
      sentAt: row.sentAt,
    },
  });
}

export async function updateOutbox(db: Db, row: OutboxRecord): Promise<void> {
  await db.emailOutbox.update({
    where: { id: row.id },
    data: {
      status: row.status,
      attempts: row.attempts,
      lastError: row.lastError,
      sentAt: row.sentAt,
    },
  });
}

export async function listOutbox(db: Db): Promise<OutboxRecord[]> {
  const rows = await db.emailOutbox.findMany({ orderBy: { createdAt: "asc" } });
  return rows.map((row) => ({
    id: row.id,
    to: row.to,
    subject: row.subject,
    body: row.body,
    status: row.status === "sent" || row.status === "failed" ? row.status : "pending",
    attempts: row.attempts,
    lastError: row.lastError,
    createdAt: row.createdAt,
    sentAt: row.sentAt,
  }));
}

export async function insertPaymentEvent(db: Db, row: PaymentEventRecord): Promise<void> {
  try {
    await db.paymentEvent.create({ data: row });
  } catch (error: unknown) {
    if (isUniqueViolation(error)) throw new DuplicateRecord();
    throw error;
  }
}
