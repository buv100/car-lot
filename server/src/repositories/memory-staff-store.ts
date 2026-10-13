/* eslint-disable @typescript-eslint/require-await -- In-memory methods stay synchronous behind the Promise port. */
import { randomUUID } from "node:crypto";

import { civilDateKey } from "../domain/time.js";
import {
  RENTAL_STATUSES,
  SALE_STATUSES,
  type CarType,
  type RentalStatus,
  type SaleStatus,
} from "../domain/status.js";
import {
  DuplicateRecord,
  type BandRecord,
  type CarRecord,
  type CarWrite,
  type ChecklistRecord,
  type HolidayRecord,
  type HoldSnapshot,
  type InsuranceRecord,
  type KmAdjustmentRecord,
  type LotRecord,
  type PhotoRecord,
  type PublicFleetCar,
  type PublicRentCar,
  type PublicSaleCar,
  type PublicTag,
  type CustomerRecord,
  type OutboxRecord,
  type PaymentEventRecord,
  type RentalOrderRecord,
  type SaleOrderRecord,
  type SettingChangeRecord,
  type StaffRecord,
  type StaffStore,
  type TagRecord,
} from "./staff-store.js";

function lotDefaults(): LotRecord {
  return {
    name: "",
    address: "",
    latitude: null,
    longitude: null,
    phone: "",
    publicEmail: "",
    staffAlertEmail: "",
    kmPerDay: 250,
    excessKmPriceAgorot: 200,
    fuelShortagePricePerLiterAgorot: 800,
  };
}

function withRelations(
  car: CarWrite,
  photos: PhotoRecord[],
  ageBands: BandRecord[],
  saleAlertSentAt: Date | null,
): CarRecord {
  return { ...car, tagIds: [...car.tagIds], photos, ageBands, saleAlertSentAt };
}

/** In-memory lot used by service tests. It enforces the same unique fields as PostgreSQL. */
export class MemoryStaffStore implements StaffStore {
  private readonly staff = new Map<string, StaffRecord>();
  private readonly cars = new Map<string, CarRecord>();
  private lot: LotRecord | null = lotDefaults();
  private readonly changes: SettingChangeRecord[] = [];
  private readonly holidays: HolidayRecord[] = [];
  private readonly insurance: InsuranceRecord[] = [];
  private readonly tags: TagRecord[] = [];
  private readonly rentals: RentalOrderRecord[] = [];
  private readonly checklists: ChecklistRecord[] = [];
  private readonly sales: SaleOrderRecord[] = [];
  private readonly adjustments: KmAdjustmentRecord[] = [];
  private readonly customers = new Map<string, CustomerRecord>();
  private readonly sequences = new Map<string, number>();
  private readonly outbox: OutboxRecord[] = [];
  private readonly checkpoints = new Map<string, Date>();
  private readonly paymentEvents: PaymentEventRecord[] = [];

  /** Plants an open rental so a status change can be refused without a payment flow. */
  seedRental(carId: string, status: string, holdExpiresAt: Date | null): void {
    this.rentals.push({
      id: randomUUID(),
      number: `R-SEED-${this.rentals.length + 1}`,
      carId,
      customerId: null,
      holderTokenHash: null,
      pickupAt: new Date(0),
      returnAt: new Date(0),
      searchAge: 0,
      ageAtPickup: 0,
      returnMode: "lot",
      returnAddress: "",
      returnLat: null,
      returnLng: null,
      straightLineKm: 0,
      billedKm: 0,
      deliveryFeeAgorot: 0,
      insurancePackageId: "base",
      rentalAgorot: 0,
      insuranceAgorot: 0,
      totalAgorot: 0,
      priceLines: [],
      kmAllowance: 0,
      status: storedStatus(status, RENTAL_STATUSES),
      holdExpiresAt,
      paymentProvider: "stripe",
      paymentRef: null,
      startKm: null,
      noShow: false,
      cancelledBy: null,
      yardCancelNote: "",
      refundPercent: null,
      refundAgorot: null,
      reminderSentAt: null,
    });
  }

  /** Plants a sale hold so the catalog can hide a reserved car. */
  seedSale(carId: string, status: string, holdExpiresAt: Date | null): void {
    this.sales.push({
      id: randomUUID(),
      number: `S-SEED-${this.sales.length + 1}`,
      carId,
      customerId: null,
      holderTokenHash: null,
      listPriceAgorot: 0,
      depositAgorot: 0,
      status: storedStatus(status, SALE_STATUSES),
      wantsFinancing: false,
      financingNote: "",
      wantsTradeIn: false,
      tradeInNote: "",
      holdExpiresAt,
      paymentProvider: "stripe",
      paymentRef: null,
      refundDecidedAt: null,
      refundApproved: null,
      refundByStaffId: null,
      handoverAt: null,
      handoverByStaffId: null,
    });
  }

  async findStaffByEmail(email: string): Promise<StaffRecord | null> {
    for (const person of this.staff.values()) {
      if (person.email === email) return { ...person };
    }
    return null;
  }

  async findStaffById(id: string): Promise<StaffRecord | null> {
    const person = this.staff.get(id);
    return person === undefined ? null : { ...person };
  }

  async listStaff(): Promise<StaffRecord[]> {
    return [...this.staff.values()]
      .map((person) => ({ ...person }))
      .sort((left, right) => left.fullName.localeCompare(right.fullName, "he"));
  }

  async insertStaff(staff: StaffRecord): Promise<void> {
    if ([...this.staff.values()].some((person) => person.email === staff.email)) {
      throw new DuplicateRecord();
    }
    this.staff.set(staff.id, { ...staff });
  }

  async updateStaff(staff: StaffRecord): Promise<void> {
    const clash = [...this.staff.values()].find(
      (person) => person.email === staff.email && person.id !== staff.id,
    );
    if (clash !== undefined) throw new DuplicateRecord();
    this.staff.set(staff.id, { ...staff });
  }

  async countActiveManagers(): Promise<number> {
    return [...this.staff.values()].filter((person) => person.role === "manager" && person.active)
      .length;
  }

  async listCars(): Promise<CarRecord[]> {
    return [...this.cars.values()]
      .map((car) => structuredClone(car))
      .sort(
        (left, right) =>
          left.make.localeCompare(right.make, "he") || left.model.localeCompare(right.model, "he"),
      );
  }

  async findCar(id: string): Promise<CarRecord | null> {
    const car = this.cars.get(id);
    return car === undefined ? null : structuredClone(car);
  }

  async insertCar(car: CarWrite): Promise<void> {
    if ([...this.cars.values()].some((existing) => existing.plate === car.plate)) {
      throw new DuplicateRecord();
    }
    this.cars.set(car.id, withRelations(car, [], [], null));
  }

  async updateCar(car: CarWrite): Promise<void> {
    const current = this.cars.get(car.id);
    if (current === undefined) throw new Error("Car is missing");
    if (
      [...this.cars.values()].some(
        (existing) => existing.plate === car.plate && existing.id !== car.id,
      )
    ) {
      throw new DuplicateRecord();
    }
    this.cars.set(
      car.id,
      withRelations(car, current.photos, current.ageBands, current.saleAlertSentAt),
    );
  }

  async replaceAgeBands(carId: string, bands: readonly BandRecord[]): Promise<void> {
    const current = this.cars.get(carId);
    if (current === undefined) throw new Error("Car is missing");
    current.ageBands = bands.map((band) => ({ ...band }));
  }

  async addPhoto(carId: string, photo: PhotoRecord): Promise<void> {
    const current = this.cars.get(carId);
    if (current === undefined) throw new Error("Car is missing");
    current.photos.push({ ...photo });
    current.photos.sort((left, right) => left.sortOrder - right.sortOrder);
  }

  async updatePhoto(carId: string, photo: PhotoRecord): Promise<void> {
    const current = this.cars.get(carId);
    if (current === undefined) throw new Error("Car is missing");
    const index = current.photos.findIndex((item) => item.id === photo.id);
    if (index < 0) throw new Error("Photo is missing");
    current.photos[index] = { ...photo };
    current.photos.sort((left, right) => left.sortOrder - right.sortOrder);
  }

  async deletePhoto(carId: string, photoId: string): Promise<void> {
    const current = this.cars.get(carId);
    if (current === undefined) throw new Error("Car is missing");
    current.photos = current.photos.filter((photo) => photo.id !== photoId);
  }

  async listRentals(carId: string): Promise<HoldSnapshot[]> {
    return this.rentals
      .filter((rental) => rental.carId === carId)
      .map((rental) => ({
        id: rental.id,
        status: rental.status,
        holdExpiresAt: rental.holdExpiresAt,
      }));
  }

  async listRentalOrders(): Promise<RentalOrderRecord[]> {
    return this.rentals.map(cloneRental);
  }

  async findRentalOrder(id: string): Promise<RentalOrderRecord | null> {
    const row = this.rentals.find((rental) => rental.id === id);
    return row === undefined ? null : cloneRental(row);
  }

  async insertRentalOrder(row: RentalOrderRecord): Promise<void> {
    const blocking = new Set(["pending_payment", "confirmed", "active", "checklist"]);
    if (
      this.rentals.some(
        (rental) =>
          rental.number === row.number ||
          rental.id === row.id ||
          (row.holderTokenHash !== null && rental.holderTokenHash === row.holderTokenHash) ||
          (blocking.has(row.status) && rental.carId === row.carId && blocking.has(rental.status)),
      )
    ) {
      throw new DuplicateRecord();
    }
    this.rentals.push(cloneRental(row));
  }

  async updateRentalOrder(row: RentalOrderRecord): Promise<void> {
    const index = this.rentals.findIndex((rental) => rental.id === row.id);
    if (index < 0) throw new Error("Rental is missing");
    this.rentals[index] = cloneRental(row);
  }

  async findChecklist(rentalOrderId: string): Promise<ChecklistRecord | null> {
    const row = this.checklists.find((checklist) => checklist.rentalOrderId === rentalOrderId);
    return row === undefined ? null : cloneChecklist(row);
  }

  async saveChecklist(row: ChecklistRecord): Promise<void> {
    const index = this.checklists.findIndex(
      (checklist) => checklist.rentalOrderId === row.rentalOrderId,
    );
    const copy = cloneChecklist(row);
    if (index < 0) this.checklists.push(copy);
    else this.checklists[index] = copy;
  }

  async listSaleOrders(): Promise<SaleOrderRecord[]> {
    return this.sales.map(cloneSale);
  }

  async findSaleOrder(id: string): Promise<SaleOrderRecord | null> {
    const row = this.sales.find((sale) => sale.id === id);
    return row === undefined ? null : cloneSale(row);
  }

  async insertSaleOrder(row: SaleOrderRecord): Promise<void> {
    const blocking = new Set(["pending_payment", "reserved"]);
    if (
      this.sales.some(
        (sale) =>
          sale.number === row.number ||
          sale.id === row.id ||
          (row.holderTokenHash !== null && sale.holderTokenHash === row.holderTokenHash) ||
          (blocking.has(row.status) && sale.carId === row.carId && blocking.has(sale.status)),
      )
    ) {
      throw new DuplicateRecord();
    }
    this.sales.push(cloneSale(row));
  }

  async updateSaleOrder(row: SaleOrderRecord): Promise<void> {
    const index = this.sales.findIndex((sale) => sale.id === row.id);
    if (index < 0) throw new Error("Sale is missing");
    this.sales[index] = cloneSale(row);
  }

  async insertKmAdjustment(row: KmAdjustmentRecord): Promise<void> {
    this.adjustments.push({ ...row });
  }

  async listPublicRentals(primaryType: CarType | null): Promise<PublicRentCar[]> {
    return [...this.cars.values()]
      .filter((car) => primaryType === null || car.primaryType === primaryType)
      .map((car) => this.toPublicRent(car));
  }

  async findPublicRental(id: string): Promise<PublicRentCar | null> {
    const car = this.cars.get(id);
    return car === undefined ? null : this.toPublicRent(car);
  }

  async listPublicSales(primaryType: CarType | null): Promise<PublicSaleCar[]> {
    return [...this.cars.values()]
      .filter((car) => primaryType === null || car.primaryType === primaryType)
      .map((car) => this.toPublicSale(car));
  }

  async findPublicSale(id: string): Promise<PublicSaleCar | null> {
    const car = this.cars.get(id);
    return car === undefined ? null : this.toPublicSale(car);
  }

  async listPublicFleet(): Promise<PublicFleetCar[]> {
    return [...this.cars.values()]
      .map((car) => this.toPublicFleet(car))
      .sort(
        (left, right) =>
          left.make.localeCompare(right.make, "he") ||
          left.model.localeCompare(right.model, "he") ||
          left.id.localeCompare(right.id),
      );
  }

  async findPublicFleet(id: string): Promise<PublicFleetCar | null> {
    const car = this.cars.get(id);
    return car === undefined ? null : this.toPublicFleet(car);
  }

  private tagsFor(ids: readonly string[]): PublicTag[] {
    return ids.flatMap((id) => {
      const tag = this.tags.find((item) => item.id === id);
      return tag === undefined ? [] : [{ id: tag.id, name: tag.name }];
    });
  }

  private toPublicRent(car: CarRecord): PublicRentCar {
    return {
      id: car.id,
      make: car.make,
      model: car.model,
      year: car.year,
      color: car.color,
      primaryType: car.primaryType,
      seats: car.seats,
      minAge: car.minAge,
      status: car.status,
      tags: this.tagsFor(car.tagIds),
      photos: car.photos.map((photo) => ({ ...photo })),
      ageBands: car.ageBands.map((band) => ({ ...band })),
      rentals: this.rentals
        .filter((rental) => rental.carId === car.id)
        .map((rental) => ({
          id: rental.id,
          status: rental.status,
          holdExpiresAt: rental.holdExpiresAt,
        })),
    };
  }

  private toPublicFleet(car: CarRecord): PublicFleetCar {
    return {
      id: car.id,
      make: car.make,
      model: car.model,
      year: car.year,
      color: car.color,
      primaryType: car.primaryType,
      seats: car.seats,
      currentKm: car.currentKm,
      tags: this.tagsFor(car.tagIds),
      photos: car.photos.map((photo) => ({ ...photo })),
    };
  }

  private toPublicSale(car: CarRecord): PublicSaleCar {
    return {
      id: car.id,
      make: car.make,
      model: car.model,
      year: car.year,
      color: car.color,
      primaryType: car.primaryType,
      seats: car.seats,
      currentKm: car.currentKm,
      status: car.status,
      ownersCount: car.ownersCount,
      knownAccidents: car.knownAccidents,
      accidentsNone: car.accidentsNone,
      conditionGrade: car.conditionGrade,
      salePriceAgorot: car.salePriceAgorot,
      deepTreatmentCompletedAt: car.deepTreatmentCompletedAt,
      tags: this.tagsFor(car.tagIds),
      photos: car.photos.map((photo) => ({ ...photo })),
      rentals: this.rentals
        .filter((rental) => rental.carId === car.id)
        .map((rental) => ({
          id: rental.id,
          status: rental.status,
          holdExpiresAt: rental.holdExpiresAt,
        })),
      sales: this.sales
        .filter((sale) => sale.carId === car.id)
        .map((sale) => ({ id: sale.id, status: sale.status, holdExpiresAt: sale.holdExpiresAt })),
    };
  }

  async readLot(): Promise<LotRecord | null> {
    return this.lot === null ? null : { ...this.lot };
  }

  async writeLot(lot: LotRecord): Promise<void> {
    this.lot = { ...lot };
  }

  async insertSettingChange(change: SettingChangeRecord): Promise<void> {
    this.changes.push({
      ...change,
      previousJson: { ...change.previousJson },
      nextJson: { ...change.nextJson },
    });
  }

  async listSettingChanges(): Promise<SettingChangeRecord[]> {
    return [...this.changes]
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
      .map((change) => ({
        ...change,
        previousJson: { ...change.previousJson },
        nextJson: { ...change.nextJson },
      }));
  }

  async listHolidays(): Promise<HolidayRecord[]> {
    return [...this.holidays].sort((left, right) =>
      civilDateKey(left.date).localeCompare(civilDateKey(right.date)),
    );
  }

  async insertHoliday(holiday: HolidayRecord): Promise<void> {
    if (this.holidays.some((item) => civilDateKey(item.date) === civilDateKey(holiday.date))) {
      throw new DuplicateRecord();
    }
    this.holidays.push({ ...holiday, date: { ...holiday.date } });
  }

  async deleteHoliday(id: string): Promise<boolean> {
    const index = this.holidays.findIndex((item) => item.id === id);
    if (index < 0) return false;
    this.holidays.splice(index, 1);
    return true;
  }

  async listInsurance(): Promise<InsuranceRecord[]> {
    return [...this.insurance].sort((left, right) => left.sortOrder - right.sortOrder);
  }

  async insertInsurance(pack: InsuranceRecord): Promise<void> {
    this.insurance.push({ ...pack });
  }

  async updateInsurance(pack: InsuranceRecord): Promise<void> {
    const index = this.insurance.findIndex((item) => item.id === pack.id);
    if (index < 0) throw new Error("Insurance package is missing");
    this.insurance[index] = { ...pack };
  }

  async listTags(): Promise<TagRecord[]> {
    return [...this.tags].sort((left, right) => left.name.localeCompare(right.name, "he"));
  }

  async insertTag(tag: TagRecord): Promise<void> {
    if (this.tags.some((item) => item.name === tag.name)) throw new DuplicateRecord();
    this.tags.push({ ...tag });
  }

  async updateTag(tag: TagRecord): Promise<void> {
    if (this.tags.some((item) => item.name === tag.name && item.id !== tag.id)) {
      throw new DuplicateRecord();
    }
    const index = this.tags.findIndex((item) => item.id === tag.id);
    if (index < 0) throw new Error("Tag is missing");
    this.tags[index] = { ...tag };
  }

  async findCustomerByEmail(email: string): Promise<CustomerRecord | null> {
    for (const customer of this.customers.values()) {
      if (customer.email === email) return { ...customer, birthDate: { ...customer.birthDate } };
    }
    return null;
  }

  async findCustomerById(id: string): Promise<CustomerRecord | null> {
    const customer = this.customers.get(id);
    return customer === undefined ? null : { ...customer, birthDate: { ...customer.birthDate } };
  }

  async insertCustomer(customer: CustomerRecord): Promise<void> {
    if ([...this.customers.values()].some((item) => item.email === customer.email)) {
      throw new DuplicateRecord();
    }
    this.customers.set(customer.id, { ...customer, birthDate: { ...customer.birthDate } });
  }

  async updateCustomer(customer: CustomerRecord): Promise<void> {
    if (!this.customers.has(customer.id)) throw new Error("Customer is missing");
    this.customers.set(customer.id, { ...customer, birthDate: { ...customer.birthDate } });
  }

  async allocateSequence(kind: "R" | "S", year: number): Promise<number> {
    const key = `${kind}:${year}`;
    const next = (this.sequences.get(key) ?? 0) + 1;
    this.sequences.set(key, next);
    return next;
  }

  async findRentalByHoldHash(hash: string): Promise<RentalOrderRecord | null> {
    const row = this.rentals.find((rental) => rental.holderTokenHash === hash);
    return row === undefined ? null : cloneRental(row);
  }

  async listRentalsForCustomer(customerId: string): Promise<RentalOrderRecord[]> {
    return this.rentals.filter((rental) => rental.customerId === customerId).map(cloneRental);
  }

  async listRentalsByStatus(status: RentalStatus): Promise<RentalOrderRecord[]> {
    return this.rentals.filter((rental) => rental.status === status).map(cloneRental);
  }

  async findSaleByHoldHash(hash: string): Promise<SaleOrderRecord | null> {
    const row = this.sales.find((sale) => sale.holderTokenHash === hash);
    return row === undefined ? null : cloneSale(row);
  }

  async listSalesForCustomer(customerId: string): Promise<SaleOrderRecord[]> {
    return this.sales.filter((sale) => sale.customerId === customerId).map(cloneSale);
  }

  async listSalesByStatus(status: SaleStatus): Promise<SaleOrderRecord[]> {
    return this.sales.filter((sale) => sale.status === status).map(cloneSale);
  }

  async insertOutbox(row: OutboxRecord): Promise<void> {
    this.outbox.push(cloneOutbox(row));
  }

  async updateOutbox(row: OutboxRecord): Promise<void> {
    const index = this.outbox.findIndex((item) => item.id === row.id);
    if (index < 0) throw new Error("Outbox row is missing");
    this.outbox[index] = cloneOutbox(row);
  }

  async listOutbox(): Promise<OutboxRecord[]> {
    return this.outbox.map(cloneOutbox);
  }

  async readCheckpoint(name: string): Promise<Date | null> {
    const ranAt = this.checkpoints.get(name);
    return ranAt === undefined ? null : new Date(ranAt);
  }

  async writeCheckpoint(name: string, ranAt: Date): Promise<void> {
    this.checkpoints.set(name, new Date(ranAt));
  }

  async markSaleAlertSent(carId: string, at: Date): Promise<void> {
    const car = this.cars.get(carId);
    if (car === undefined) throw new Error("Car is missing");
    car.saleAlertSentAt = new Date(at);
  }

  async insertPaymentEvent(row: PaymentEventRecord): Promise<void> {
    if (
      this.paymentEvents.some(
        (event) => event.provider === row.provider && event.providerEventId === row.providerEventId,
      )
    ) {
      throw new DuplicateRecord();
    }
    this.paymentEvents.push({ ...row });
  }

  async transaction<T>(work: (store: StaffStore) => Promise<T>): Promise<T> {
    return work(this);
  }
}

function storedStatus<T extends string>(value: string, options: readonly T[]): T {
  for (const option of options) {
    if (option === value) return option;
  }
  throw new Error(`Unexpected stored status ${value}`);
}

function cloneRental(row: RentalOrderRecord): RentalOrderRecord {
  return {
    ...row,
    pickupAt: new Date(row.pickupAt),
    returnAt: new Date(row.returnAt),
    holdExpiresAt: row.holdExpiresAt === null ? null : new Date(row.holdExpiresAt),
    reminderSentAt: row.reminderSentAt === null ? null : new Date(row.reminderSentAt),
    priceLines: row.priceLines.map((line) => ({ ...line })),
  };
}

function cloneOutbox(row: OutboxRecord): OutboxRecord {
  return {
    ...row,
    createdAt: new Date(row.createdAt),
    sentAt: row.sentAt === null ? null : new Date(row.sentAt),
  };
}

function cloneChecklist(row: ChecklistRecord): ChecklistRecord {
  return {
    ...row,
    completedAt: row.completedAt === null ? null : new Date(row.completedAt),
    returnPhotoIds: [...row.returnPhotoIds],
    damages: row.damages.map((damage) => ({ ...damage, photoIds: [...damage.photoIds] })),
  };
}

function cloneSale(row: SaleOrderRecord): SaleOrderRecord {
  return {
    ...row,
    holdExpiresAt: row.holdExpiresAt === null ? null : new Date(row.holdExpiresAt),
    refundDecidedAt: row.refundDecidedAt === null ? null : new Date(row.refundDecidedAt),
    handoverAt: row.handoverAt === null ? null : new Date(row.handoverAt),
  };
}
