import type { StaffRole } from "../domain/permissions.js";
import type { ConditionGrade } from "../domain/sale.js";
import type { CarStatus, CarType, CareReason, RentalStatus, SaleStatus } from "../domain/status.js";
import type { CivilDate } from "../domain/time.js";

/** Raised when a unique column, such as plate or email, is already taken. */
export class DuplicateRecord extends Error {
  constructor() {
    super("Unique value already exists");
    this.name = "DuplicateRecord";
  }
}

export type StaffRecord = {
  id: string;
  fullName: string;
  email: string;
  passwordHash: string;
  role: StaffRole;
  active: boolean;
};

export type PhotoRecord = {
  id: string;
  alt: string;
  sortOrder: number;
};

export type BandRecord = {
  id: string;
  minAge: number;
  maxAge: number | null;
  weekdayDailyAgorot: number;
  weekendDailyAgorot: number;
  holidayDailyAgorot: number;
};

/** One car as the staff desk stores it, including plate and internal notes. */
export type CarRecord = {
  id: string;
  plate: string;
  vin: string | null;
  make: string;
  model: string;
  year: number;
  color: string;
  primaryType: CarType;
  seats: number;
  currentKm: number;
  purchasedAt: CivilDate;
  minAge: number | null;
  ownersCount: number | null;
  knownAccidents: string | null;
  accidentsNone: boolean;
  conditionGrade: ConditionGrade | null;
  salePriceAgorot: number | null;
  deepTreatmentCompletedAt: Date | null;
  status: CarStatus;
  careReason: CareReason | null;
  internalNotes: string;
  /** Set when the one sale-threshold letter is queued, so a later scan does not send another. */
  saleAlertSentAt: Date | null;
  tagIds: string[];
  photos: PhotoRecord[];
  ageBands: BandRecord[];
};

export type LotRecord = {
  name: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  phone: string;
  publicEmail: string;
  staffAlertEmail: string;
  kmPerDay: number;
  excessKmPriceAgorot: number;
  fuelShortagePricePerLiterAgorot: number;
};

export type JsonObject = { [key: string]: string | number | boolean | null };

export type SettingChangeRecord = {
  id: string;
  staffId: string;
  createdAt: Date;
  scope: string;
  entityId: string | null;
  previousJson: JsonObject;
  nextJson: JsonObject;
};

export type HolidayRecord = {
  id: string;
  date: CivilDate;
  name: string;
};

export type InsuranceRecord = {
  id: string;
  name: string;
  description: string;
  dailyPriceAgorot: number;
  includedInBase: boolean;
  active: boolean;
  sortOrder: number;
};

export type TagRecord = {
  id: string;
  name: string;
  active: boolean;
};

export type HoldSnapshot = {
  id?: string;
  status: string;
  holdExpiresAt: Date | null;
};

export type StoredPriceLine = {
  start: string;
  hours: number;
  dayKind: string;
  agorot: number;
};

export type CustomerRecord = {
  id: string;
  fullName: string;
  phone: string;
  email: string;
  birthDate: CivilDate;
  passwordHash: string;
  blocked: boolean;
  blockReason: string | null;
  blockNote: string;
  blockedAt: Date | null;
  blockedByStaffId: string | null;
  unblockedAt: Date | null;
  unblockedByStaffId: string | null;
};

export type OutboxRecord = {
  id: string;
  to: string;
  subject: string;
  body: string;
  status: "pending" | "sent" | "failed";
  attempts: number;
  lastError: string;
  createdAt: Date;
  sentAt: Date | null;
};

export type PaymentEventRecord = {
  id: string;
  provider: string;
  providerEventId: string;
  orderKind: "rental" | "sale";
  orderId: string;
};

export type PublicTag = { id: string; name: string };

/** Rental catalog row. Plate, VIN, and internal notes are not loaded. */
export type PublicRentCar = {
  id: string;
  make: string;
  model: string;
  year: number;
  color: string;
  primaryType: CarType;
  seats: number;
  minAge: number | null;
  status: CarStatus;
  tags: PublicTag[];
  photos: PhotoRecord[];
  ageBands: BandRecord[];
  rentals: HoldSnapshot[];
};

/** Whole-fleet row for the buy gallery. Plate, VIN, and internal notes are not loaded. */
export type PublicFleetCar = {
  id: string;
  make: string;
  model: string;
  year: number;
  color: string;
  primaryType: CarType;
  seats: number;
  currentKm: number;
  tags: PublicTag[];
  photos: PhotoRecord[];
};

/** Sale catalog row. Plate, VIN, and internal notes are not loaded. */
export type PublicSaleCar = {
  id: string;
  make: string;
  model: string;
  year: number;
  color: string;
  primaryType: CarType;
  seats: number;
  currentKm: number;
  status: CarStatus;
  ownersCount: number | null;
  knownAccidents: string | null;
  accidentsNone: boolean;
  conditionGrade: ConditionGrade | null;
  salePriceAgorot: number | null;
  deepTreatmentCompletedAt: Date | null;
  tags: PublicTag[];
  photos: PhotoRecord[];
  rentals: HoldSnapshot[];
  sales: HoldSnapshot[];
};

export type RentalOrderRecord = {
  id: string;
  number: string;
  carId: string;
  customerId: string | null;
  holderTokenHash: string | null;
  pickupAt: Date;
  returnAt: Date;
  searchAge: number;
  ageAtPickup: number;
  returnMode: "lot" | "address";
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
  priceLines: StoredPriceLine[];
  kmAllowance: number;
  status: RentalStatus;
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
};

export type DamageRecord = {
  id: string;
  description: string;
  estimatedAgorot: number;
  photoIds: string[];
};

export type ChecklistRecord = {
  id: string;
  rentalOrderId: string;
  endKm: number | null;
  fuelLitersShort: number | null;
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
  returnPhotoIds: string[];
  damages: DamageRecord[];
};

export type SaleOrderRecord = {
  id: string;
  number: string;
  carId: string;
  customerId: string | null;
  holderTokenHash: string | null;
  listPriceAgorot: number;
  depositAgorot: number;
  status: SaleStatus;
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
};

export type KmAdjustmentRecord = {
  id: string;
  carId: string;
  staffId: string;
  previousKm: number;
  nextKm: number;
  reason: string;
  createdAt: Date;
};

export type CarWrite = Omit<CarRecord, "photos" | "ageBands" | "saleAlertSentAt">;

/** Persistence for the staff desk. Product rules stay in the services. */
export interface StaffStore {
  findStaffByEmail(email: string): Promise<StaffRecord | null>;
  findStaffById(id: string): Promise<StaffRecord | null>;
  listStaff(): Promise<StaffRecord[]>;
  insertStaff(staff: StaffRecord): Promise<void>;
  updateStaff(staff: StaffRecord): Promise<void>;
  countActiveManagers(): Promise<number>;

  listCars(): Promise<CarRecord[]>;
  findCar(id: string): Promise<CarRecord | null>;
  insertCar(car: CarWrite): Promise<void>;
  updateCar(car: CarWrite): Promise<void>;
  replaceAgeBands(carId: string, bands: readonly BandRecord[]): Promise<void>;
  addPhoto(carId: string, photo: PhotoRecord): Promise<void>;
  updatePhoto(carId: string, photo: PhotoRecord): Promise<void>;
  deletePhoto(carId: string, photoId: string): Promise<void>;
  listRentals(carId: string): Promise<HoldSnapshot[]>;
  listRentalOrders(): Promise<RentalOrderRecord[]>;
  findRentalOrder(id: string): Promise<RentalOrderRecord | null>;
  insertRentalOrder(row: RentalOrderRecord): Promise<void>;
  updateRentalOrder(row: RentalOrderRecord): Promise<void>;
  findChecklist(rentalOrderId: string): Promise<ChecklistRecord | null>;
  saveChecklist(row: ChecklistRecord): Promise<void>;
  listSaleOrders(): Promise<SaleOrderRecord[]>;
  findSaleOrder(id: string): Promise<SaleOrderRecord | null>;
  insertSaleOrder(row: SaleOrderRecord): Promise<void>;
  updateSaleOrder(row: SaleOrderRecord): Promise<void>;
  insertKmAdjustment(row: KmAdjustmentRecord): Promise<void>;
  listPublicRentals(primaryType: CarType | null): Promise<PublicRentCar[]>;
  findPublicRental(id: string): Promise<PublicRentCar | null>;
  listPublicSales(primaryType: CarType | null): Promise<PublicSaleCar[]>;
  findPublicSale(id: string): Promise<PublicSaleCar | null>;
  listPublicFleet(): Promise<PublicFleetCar[]>;
  findPublicFleet(id: string): Promise<PublicFleetCar | null>;

  readLot(): Promise<LotRecord | null>;
  writeLot(lot: LotRecord): Promise<void>;
  insertSettingChange(change: SettingChangeRecord): Promise<void>;
  listSettingChanges(): Promise<SettingChangeRecord[]>;

  listHolidays(): Promise<HolidayRecord[]>;
  insertHoliday(holiday: HolidayRecord): Promise<void>;
  deleteHoliday(id: string): Promise<boolean>;

  listInsurance(): Promise<InsuranceRecord[]>;
  insertInsurance(pack: InsuranceRecord): Promise<void>;
  updateInsurance(pack: InsuranceRecord): Promise<void>;

  listTags(): Promise<TagRecord[]>;
  insertTag(tag: TagRecord): Promise<void>;
  updateTag(tag: TagRecord): Promise<void>;

  findCustomerByEmail(email: string): Promise<CustomerRecord | null>;
  findCustomerById(id: string): Promise<CustomerRecord | null>;
  insertCustomer(customer: CustomerRecord): Promise<void>;
  updateCustomer(customer: CustomerRecord): Promise<void>;
  allocateSequence(kind: "R" | "S", year: number): Promise<number>;
  findRentalByHoldHash(hash: string): Promise<RentalOrderRecord | null>;
  listRentalsForCustomer(customerId: string): Promise<RentalOrderRecord[]>;
  listRentalsByStatus(status: RentalStatus): Promise<RentalOrderRecord[]>;
  findSaleByHoldHash(hash: string): Promise<SaleOrderRecord | null>;
  listSalesForCustomer(customerId: string): Promise<SaleOrderRecord[]>;
  listSalesByStatus(status: SaleStatus): Promise<SaleOrderRecord[]>;
  insertOutbox(row: OutboxRecord): Promise<void>;
  updateOutbox(row: OutboxRecord): Promise<void>;
  listOutbox(): Promise<OutboxRecord[]>;
  /** Null until that named job has run once. */
  readCheckpoint(name: string): Promise<Date | null>;
  writeCheckpoint(name: string, ranAt: Date): Promise<void>;
  /** Records the single sale-threshold letter without changing the car status. */
  markSaleAlertSent(carId: string, at: Date): Promise<void>;
  insertPaymentEvent(row: PaymentEventRecord): Promise<void>;

  transaction<T>(work: (store: StaffStore) => Promise<T>): Promise<T>;
}
