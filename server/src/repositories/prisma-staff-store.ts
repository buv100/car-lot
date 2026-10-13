import { Prisma, PrismaClient } from "@prisma/client";

import type { StaffRole } from "../domain/permissions.js";
import { CONDITION_GRADES, type ConditionGrade } from "../domain/sale.js";
import { CAR_STATUSES, CAR_TYPES, CARE_REASONS, type CarType } from "../domain/status.js";
import type { CivilDate } from "../domain/time.js";
import {
  findChecklist as readChecklist,
  findRentalOrder as readRentalOrder,
  findSaleOrder as readSaleOrder,
  insertRentalOrder as writeRentalOrder,
  insertSaleOrder as writeSaleOrder,
  listRentalOrders as readRentalOrders,
  listSaleOrders as readSaleOrders,
  saveChecklist as writeChecklist,
  updateRentalOrder as patchRentalOrder,
  updateSaleOrder as patchSaleOrder,
} from "./prisma-orders.js";
import {
  allocateSequence as nextSequence,
  findCustomerByEmail as customerByEmail,
  findCustomerById as customerById,
  findRentalByHoldHash as rentalByHold,
  findSaleByHoldHash as saleByHold,
  insertCustomer as writeCustomer,
  insertOutbox as writeOutbox,
  insertPaymentEvent as writePaymentEvent,
  listOutbox as readOutbox,
  updateOutbox as patchOutbox,
  listRentalsByStatus as rentalsByStatus,
  listRentalsForCustomer as rentalsForCustomer,
  listSalesByStatus as salesByStatus,
  listSalesForCustomer as salesForCustomer,
  updateCustomer as patchCustomer,
} from "./prisma-accounts.js";
import {
  DuplicateRecord,
  type BandRecord,
  type CarRecord,
  type CarWrite,
  type ChecklistRecord,
  type CustomerRecord,
  type HolidayRecord,
  type HoldSnapshot,
  type InsuranceRecord,
  type JsonObject,
  type KmAdjustmentRecord,
  type LotRecord,
  type OutboxRecord,
  type PaymentEventRecord,
  type PhotoRecord,
  type PublicFleetCar,
  type PublicRentCar,
  type PublicSaleCar,
  type RentalOrderRecord,
  type SaleOrderRecord,
  type SettingChangeRecord,
  type StaffRecord,
  type StaffStore,
  type TagRecord,
} from "./staff-store.js";

type Db = PrismaClient | Prisma.TransactionClient;

const carInclude = {
  tags: true,
  photos: { orderBy: { sortOrder: "asc" as const } },
  ageBands: { orderBy: { minAge: "asc" as const } },
} satisfies Prisma.CarInclude;

type CarRow = Prisma.CarGetPayload<{ include: typeof carInclude }>;

/** Catalog select. Plate, VIN, and internal notes stay out of this query. */
export const publicRentSelect = {
  id: true,
  make: true,
  model: true,
  year: true,
  color: true,
  primaryType: true,
  seats: true,
  minAge: true,
  status: true,
  tags: { select: { tag: { select: { id: true, name: true } } } },
  photos: {
    select: { id: true, alt: true, sortOrder: true },
    orderBy: { sortOrder: "asc" as const },
  },
  ageBands: {
    select: {
      id: true,
      minAge: true,
      maxAge: true,
      weekdayDailyAgorot: true,
      weekendDailyAgorot: true,
      holidayDailyAgorot: true,
    },
  },
  rentals: { select: { id: true, status: true, holdExpiresAt: true } },
} satisfies Prisma.CarSelect;

/** Whole-fleet select. Plate, VIN, and internal notes stay out of this query. */
export const publicFleetSelect = {
  id: true,
  make: true,
  model: true,
  year: true,
  color: true,
  primaryType: true,
  seats: true,
  currentKm: true,
  tags: { select: { tag: { select: { id: true, name: true } } } },
  photos: {
    select: { id: true, alt: true, sortOrder: true },
    orderBy: { sortOrder: "asc" as const },
  },
} satisfies Prisma.CarSelect;

/** Sale catalog select. Plate, VIN, and internal notes stay out of this query. */
export const publicSaleSelect = {
  id: true,
  make: true,
  model: true,
  year: true,
  color: true,
  primaryType: true,
  seats: true,
  currentKm: true,
  status: true,
  ownersCount: true,
  knownAccidents: true,
  accidentsNone: true,
  conditionGrade: true,
  salePriceAgorot: true,
  deepTreatmentCompletedAt: true,
  tags: { select: { tag: { select: { id: true, name: true } } } },
  photos: {
    select: { id: true, alt: true, sortOrder: true },
    orderBy: { sortOrder: "asc" as const },
  },
  rentals: { select: { id: true, status: true, holdExpiresAt: true } },
  sales: { select: { id: true, status: true, holdExpiresAt: true } },
} satisfies Prisma.CarSelect;

type PublicRentRow = Prisma.CarGetPayload<{ select: typeof publicRentSelect }>;
type PublicFleetRow = Prisma.CarGetPayload<{ select: typeof publicFleetSelect }>;
type PublicSaleRow = Prisma.CarGetPayload<{ select: typeof publicSaleSelect }>;

function mapPublicRent(row: PublicRentRow): PublicRentCar {
  return {
    id: row.id,
    make: row.make,
    model: row.model,
    year: row.year,
    color: row.color,
    primaryType: oneOf(row.primaryType, CAR_TYPES),
    seats: row.seats,
    minAge: row.minAge,
    status: oneOf(row.status, CAR_STATUSES),
    tags: row.tags.map((link) => ({ id: link.tag.id, name: link.tag.name })),
    photos: row.photos.map((photo) => ({
      id: photo.id,
      alt: photo.alt,
      sortOrder: photo.sortOrder,
    })),
    ageBands: row.ageBands.map((band) => ({
      id: band.id,
      minAge: band.minAge,
      maxAge: band.maxAge,
      weekdayDailyAgorot: band.weekdayDailyAgorot,
      weekendDailyAgorot: band.weekendDailyAgorot,
      holidayDailyAgorot: band.holidayDailyAgorot,
    })),
    rentals: row.rentals.map((rental) => ({
      id: rental.id,
      status: rental.status,
      holdExpiresAt: rental.holdExpiresAt,
    })),
  };
}

function mapPublicFleet(row: PublicFleetRow): PublicFleetCar {
  return {
    id: row.id,
    make: row.make,
    model: row.model,
    year: row.year,
    color: row.color,
    primaryType: oneOf(row.primaryType, CAR_TYPES),
    seats: row.seats,
    currentKm: row.currentKm,
    tags: row.tags.map((link) => ({ id: link.tag.id, name: link.tag.name })),
    photos: row.photos.map((photo) => ({
      id: photo.id,
      alt: photo.alt,
      sortOrder: photo.sortOrder,
    })),
  };
}

function mapPublicSale(row: PublicSaleRow): PublicSaleCar {
  return {
    id: row.id,
    make: row.make,
    model: row.model,
    year: row.year,
    color: row.color,
    primaryType: oneOf(row.primaryType, CAR_TYPES),
    seats: row.seats,
    currentKm: row.currentKm,
    status: oneOf(row.status, CAR_STATUSES),
    ownersCount: row.ownersCount,
    knownAccidents: row.knownAccidents,
    accidentsNone: row.accidentsNone,
    conditionGrade: conditionGrade(row.conditionGrade),
    salePriceAgorot: row.salePriceAgorot,
    deepTreatmentCompletedAt: row.deepTreatmentCompletedAt,
    tags: row.tags.map((link) => ({ id: link.tag.id, name: link.tag.name })),
    photos: row.photos.map((photo) => ({
      id: photo.id,
      alt: photo.alt,
      sortOrder: photo.sortOrder,
    })),
    rentals: row.rentals.map((rental) => ({
      id: rental.id,
      status: rental.status,
      holdExpiresAt: rental.holdExpiresAt,
    })),
    sales: row.sales.map((sale) => ({
      id: sale.id,
      status: sale.status,
      holdExpiresAt: sale.holdExpiresAt,
    })),
  };
}

function conditionGrade(value: string | null): ConditionGrade | null {
  if (value === null) return null;
  return oneOf(value, CONDITION_GRADES);
}

function oneOf<T extends string>(value: string, options: readonly T[]): T {
  for (const option of options) {
    if (option === value) return option;
  }
  throw new Error(`Unexpected stored value ${value}`);
}

function requireRole(value: string): StaffRole {
  if (value === "yard" || value === "manager") return value;
  throw new Error(`Unexpected staff role ${value}`);
}

function civilToDb(date: CivilDate): Date {
  return new Date(Date.UTC(date.year, date.month - 1, date.day));
}

function dbToCivil(date: Date): CivilDate {
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

function jsonObject(value: Prisma.JsonValue): JsonObject {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Setting history must be a JSON object");
  }
  const result: JsonObject = {};
  for (const [key, item] of Object.entries(value)) {
    if (
      typeof item === "string" ||
      typeof item === "number" ||
      typeof item === "boolean" ||
      item === null
    ) {
      result[key] = item;
    } else {
      throw new Error("Setting history contains a nested value");
    }
  }
  return result;
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

async function unique<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error: unknown) {
    if (isUniqueViolation(error)) throw new DuplicateRecord();
    throw error;
  }
}

function mapStaff(row: {
  id: string;
  fullName: string;
  email: string;
  passwordHash: string;
  role: string;
  active: boolean;
}): StaffRecord {
  return { ...row, role: requireRole(row.role) };
}

function mapCar(row: CarRow): CarRecord {
  const care = row.careReason;
  return {
    id: row.id,
    plate: row.plate,
    vin: row.vin,
    make: row.make,
    model: row.model,
    year: row.year,
    color: row.color,
    primaryType: oneOf(row.primaryType, CAR_TYPES),
    seats: row.seats,
    currentKm: row.currentKm,
    purchasedAt: dbToCivil(row.purchasedAt),
    minAge: row.minAge,
    ownersCount: row.ownersCount,
    knownAccidents: row.knownAccidents,
    accidentsNone: row.accidentsNone,
    conditionGrade: conditionGrade(row.conditionGrade),
    salePriceAgorot: row.salePriceAgorot,
    deepTreatmentCompletedAt: row.deepTreatmentCompletedAt,
    status: oneOf(row.status, CAR_STATUSES),
    careReason: care === null ? null : oneOf(care, CARE_REASONS),
    internalNotes: row.internalNotes,
    saleAlertSentAt: row.saleAlertSentAt,
    tagIds: row.tags.map((tag) => tag.tagId),
    photos: row.photos.map((photo) => ({
      id: photo.id,
      alt: photo.alt,
      sortOrder: photo.sortOrder,
    })),
    ageBands: row.ageBands.map((band) => ({
      id: band.id,
      minAge: band.minAge,
      maxAge: band.maxAge,
      weekdayDailyAgorot: band.weekdayDailyAgorot,
      weekendDailyAgorot: band.weekendDailyAgorot,
      holidayDailyAgorot: band.holidayDailyAgorot,
    })),
  };
}

function carData(car: CarWrite): Prisma.CarUpdateInput {
  return {
    plate: car.plate,
    vin: car.vin,
    make: car.make,
    model: car.model,
    year: car.year,
    color: car.color,
    primaryType: car.primaryType,
    seats: car.seats,
    currentKm: car.currentKm,
    purchasedAt: civilToDb(car.purchasedAt),
    minAge: car.minAge,
    ownersCount: car.ownersCount,
    knownAccidents: car.knownAccidents,
    accidentsNone: car.accidentsNone,
    conditionGrade: car.conditionGrade,
    salePriceAgorot: car.salePriceAgorot,
    deepTreatmentCompletedAt: car.deepTreatmentCompletedAt,
    status: car.status,
    careReason: car.careReason,
    internalNotes: car.internalNotes,
  };
}

/** Prisma mapping for the staff desk. Partial unique indexes stay in the migration. */
export class PrismaStaffStore implements StaffStore {
  constructor(private readonly db: Db) {}

  async transaction<T>(work: (store: StaffStore) => Promise<T>): Promise<T> {
    if (!("$transaction" in this.db)) return work(this);
    return this.db.$transaction((tx) => work(new PrismaStaffStore(tx)));
  }

  async findStaffByEmail(email: string): Promise<StaffRecord | null> {
    const row = await this.db.staff.findUnique({ where: { email } });
    return row === null ? null : mapStaff(row);
  }

  async findStaffById(id: string): Promise<StaffRecord | null> {
    const row = await this.db.staff.findUnique({ where: { id } });
    return row === null ? null : mapStaff(row);
  }

  async listStaff(): Promise<StaffRecord[]> {
    const rows = await this.db.staff.findMany({ orderBy: { fullName: "asc" } });
    return rows.map(mapStaff);
  }

  async insertStaff(staff: StaffRecord): Promise<void> {
    await unique(() => this.db.staff.create({ data: staff }));
  }

  async updateStaff(staff: StaffRecord): Promise<void> {
    await unique(() => this.db.staff.update({ where: { id: staff.id }, data: staff }));
  }

  async countActiveManagers(): Promise<number> {
    return this.db.staff.count({ where: { role: "manager", active: true } });
  }

  async listCars(): Promise<CarRecord[]> {
    const rows = await this.db.car.findMany({
      include: carInclude,
      orderBy: [{ make: "asc" }, { model: "asc" }],
    });
    return rows.map(mapCar);
  }

  async findCar(id: string): Promise<CarRecord | null> {
    const row = await this.db.car.findUnique({ where: { id }, include: carInclude });
    return row === null ? null : mapCar(row);
  }

  async insertCar(car: CarWrite): Promise<void> {
    await unique(() =>
      this.db.car.create({
        data: {
          id: car.id,
          plate: car.plate,
          vin: car.vin,
          make: car.make,
          model: car.model,
          year: car.year,
          color: car.color,
          primaryType: car.primaryType,
          seats: car.seats,
          currentKm: car.currentKm,
          purchasedAt: civilToDb(car.purchasedAt),
          minAge: car.minAge,
          ownersCount: car.ownersCount,
          knownAccidents: car.knownAccidents,
          accidentsNone: car.accidentsNone,
          conditionGrade: car.conditionGrade,
          salePriceAgorot: car.salePriceAgorot,
          deepTreatmentCompletedAt: car.deepTreatmentCompletedAt,
          status: car.status,
          careReason: car.careReason,
          internalNotes: car.internalNotes,
          tags: { create: car.tagIds.map((tagId) => ({ tagId })) },
        },
      }),
    );
  }

  async updateCar(car: CarWrite): Promise<void> {
    await unique(async () => {
      await this.db.car.update({ where: { id: car.id }, data: carData(car) });
      await this.db.carTag.deleteMany({ where: { carId: car.id } });
      if (car.tagIds.length > 0) {
        await this.db.carTag.createMany({
          data: car.tagIds.map((tagId) => ({ carId: car.id, tagId })),
        });
      }
    });
  }

  async replaceAgeBands(carId: string, bands: readonly BandRecord[]): Promise<void> {
    await this.db.ageBand.deleteMany({ where: { carId } });
    if (bands.length === 0) return;
    await this.db.ageBand.createMany({
      data: bands.map((band) => ({ ...band, carId })),
    });
  }

  async addPhoto(carId: string, photo: PhotoRecord): Promise<void> {
    await this.db.carPhoto.create({ data: { ...photo, carId } });
  }

  async updatePhoto(carId: string, photo: PhotoRecord): Promise<void> {
    const existing = await this.db.carPhoto.findFirst({ where: { id: photo.id, carId } });
    if (existing === null) throw new Error("Photo is missing");
    await this.db.carPhoto.update({
      where: { id: photo.id },
      data: { alt: photo.alt, sortOrder: photo.sortOrder },
    });
  }

  async deletePhoto(carId: string, photoId: string): Promise<void> {
    const existing = await this.db.carPhoto.findFirst({ where: { id: photoId, carId } });
    if (existing === null) throw new Error("Photo is missing");
    await this.db.carPhoto.delete({ where: { id: photoId } });
  }

  async listRentals(carId: string): Promise<HoldSnapshot[]> {
    return this.db.rentalOrder.findMany({
      where: { carId },
      select: { status: true, holdExpiresAt: true },
    });
  }

  async listRentalOrders(): Promise<RentalOrderRecord[]> {
    return readRentalOrders(this.db);
  }

  async findRentalOrder(id: string): Promise<RentalOrderRecord | null> {
    return readRentalOrder(this.db, id);
  }

  async insertRentalOrder(row: RentalOrderRecord): Promise<void> {
    await writeRentalOrder(this.db, row);
  }

  async updateRentalOrder(row: RentalOrderRecord): Promise<void> {
    await patchRentalOrder(this.db, row);
  }

  async findChecklist(rentalOrderId: string): Promise<ChecklistRecord | null> {
    return readChecklist(this.db, rentalOrderId);
  }

  async saveChecklist(row: ChecklistRecord): Promise<void> {
    await writeChecklist(this.db, row);
  }

  async listSaleOrders(): Promise<SaleOrderRecord[]> {
    return readSaleOrders(this.db);
  }

  async findSaleOrder(id: string): Promise<SaleOrderRecord | null> {
    return readSaleOrder(this.db, id);
  }

  async insertSaleOrder(row: SaleOrderRecord): Promise<void> {
    await writeSaleOrder(this.db, row);
  }

  async updateSaleOrder(row: SaleOrderRecord): Promise<void> {
    await patchSaleOrder(this.db, row);
  }

  async insertKmAdjustment(row: KmAdjustmentRecord): Promise<void> {
    await this.db.kmAdjustment.create({ data: row });
  }

  async listPublicRentals(primaryType: CarType | null): Promise<PublicRentCar[]> {
    const rows = await this.db.car.findMany({
      where: primaryType === null ? {} : { primaryType },
      select: publicRentSelect,
      orderBy: [{ make: "asc" }, { model: "asc" }],
    });
    return rows.map(mapPublicRent);
  }

  async findPublicRental(id: string): Promise<PublicRentCar | null> {
    const row = await this.db.car.findUnique({ where: { id }, select: publicRentSelect });
    return row === null ? null : mapPublicRent(row);
  }

  async listPublicSales(primaryType: CarType | null): Promise<PublicSaleCar[]> {
    const rows = await this.db.car.findMany({
      where: primaryType === null ? {} : { primaryType },
      select: publicSaleSelect,
      orderBy: [{ make: "asc" }, { model: "asc" }],
    });
    return rows.map(mapPublicSale);
  }

  async findPublicSale(id: string): Promise<PublicSaleCar | null> {
    const row = await this.db.car.findUnique({ where: { id }, select: publicSaleSelect });
    return row === null ? null : mapPublicSale(row);
  }

  async listPublicFleet(): Promise<PublicFleetCar[]> {
    const rows = await this.db.car.findMany({
      select: publicFleetSelect,
      orderBy: [{ make: "asc" }, { model: "asc" }, { id: "asc" }],
    });
    return rows.map(mapPublicFleet);
  }

  async findPublicFleet(id: string): Promise<PublicFleetCar | null> {
    const row = await this.db.car.findUnique({ where: { id }, select: publicFleetSelect });
    return row === null ? null : mapPublicFleet(row);
  }

  async readLot(): Promise<LotRecord | null> {
    return this.db.lotSettings.findUnique({ where: { id: "default" } });
  }

  async writeLot(lot: LotRecord): Promise<void> {
    await this.db.lotSettings.update({ where: { id: "default" }, data: lot });
  }

  async insertSettingChange(change: SettingChangeRecord): Promise<void> {
    await this.db.settingChange.create({ data: change });
  }

  async listSettingChanges(): Promise<SettingChangeRecord[]> {
    const rows = await this.db.settingChange.findMany({ orderBy: { createdAt: "desc" } });
    return rows.map((row) => ({
      id: row.id,
      staffId: row.staffId,
      createdAt: row.createdAt,
      scope: row.scope,
      entityId: row.entityId,
      previousJson: jsonObject(row.previousJson),
      nextJson: jsonObject(row.nextJson),
    }));
  }

  async listHolidays(): Promise<HolidayRecord[]> {
    const rows = await this.db.holiday.findMany({ orderBy: { date: "asc" } });
    return rows.map((row) => ({ id: row.id, name: row.name, date: dbToCivil(row.date) }));
  }

  async insertHoliday(holiday: HolidayRecord): Promise<void> {
    await unique(() =>
      this.db.holiday.create({
        data: { id: holiday.id, name: holiday.name, date: civilToDb(holiday.date) },
      }),
    );
  }

  async deleteHoliday(id: string): Promise<boolean> {
    const existing = await this.db.holiday.findUnique({ where: { id } });
    if (existing === null) return false;
    await this.db.holiday.delete({ where: { id } });
    return true;
  }

  async listInsurance(): Promise<InsuranceRecord[]> {
    return this.db.insurancePackage.findMany({ orderBy: { sortOrder: "asc" } });
  }

  async insertInsurance(pack: InsuranceRecord): Promise<void> {
    await this.db.insurancePackage.create({ data: pack });
  }

  async updateInsurance(pack: InsuranceRecord): Promise<void> {
    await this.db.insurancePackage.update({ where: { id: pack.id }, data: pack });
  }

  async listTags(): Promise<TagRecord[]> {
    return this.db.tag.findMany({ orderBy: { name: "asc" } });
  }

  async insertTag(tag: TagRecord): Promise<void> {
    await unique(() => this.db.tag.create({ data: tag }));
  }

  async updateTag(tag: TagRecord): Promise<void> {
    await unique(() => this.db.tag.update({ where: { id: tag.id }, data: tag }));
  }

  async findCustomerByEmail(email: string): Promise<CustomerRecord | null> {
    return customerByEmail(this.db, email);
  }

  async findCustomerById(id: string): Promise<CustomerRecord | null> {
    return customerById(this.db, id);
  }

  async insertCustomer(customer: CustomerRecord): Promise<void> {
    await writeCustomer(this.db, customer);
  }

  async updateCustomer(customer: CustomerRecord): Promise<void> {
    await patchCustomer(this.db, customer);
  }

  async allocateSequence(kind: "R" | "S", year: number): Promise<number> {
    return nextSequence(this.db, kind, year);
  }

  async findRentalByHoldHash(hash: string): Promise<RentalOrderRecord | null> {
    return rentalByHold(this.db, hash);
  }

  async listRentalsForCustomer(customerId: string): Promise<RentalOrderRecord[]> {
    return rentalsForCustomer(this.db, customerId);
  }

  async listRentalsByStatus(status: RentalOrderRecord["status"]): Promise<RentalOrderRecord[]> {
    return rentalsByStatus(this.db, status);
  }

  async findSaleByHoldHash(hash: string): Promise<SaleOrderRecord | null> {
    return saleByHold(this.db, hash);
  }

  async listSalesForCustomer(customerId: string): Promise<SaleOrderRecord[]> {
    return salesForCustomer(this.db, customerId);
  }

  async listSalesByStatus(status: SaleOrderRecord["status"]): Promise<SaleOrderRecord[]> {
    return salesByStatus(this.db, status);
  }

  async insertOutbox(row: OutboxRecord): Promise<void> {
    await writeOutbox(this.db, row);
  }

  async updateOutbox(row: OutboxRecord): Promise<void> {
    await patchOutbox(this.db, row);
  }

  async listOutbox(): Promise<OutboxRecord[]> {
    return readOutbox(this.db);
  }

  async readCheckpoint(name: string): Promise<Date | null> {
    const row = await this.db.jobCheckpoint.findUnique({ where: { name } });
    return row === null ? null : row.ranAt;
  }

  async writeCheckpoint(name: string, ranAt: Date): Promise<void> {
    await this.db.jobCheckpoint.upsert({
      where: { name },
      create: { name, ranAt },
      update: { ranAt },
    });
  }

  async markSaleAlertSent(carId: string, at: Date): Promise<void> {
    await this.db.car.update({ where: { id: carId }, data: { saleAlertSentAt: at } });
  }

  async insertPaymentEvent(row: PaymentEventRecord): Promise<void> {
    await writePaymentEvent(this.db, row);
  }
}
