import type { Geocoder } from "../geocoding/geocoder.js";
import { err, ok, type Result } from "../domain/result.js";
import { civilDateKey } from "../domain/time.js";
import type {
  RentalOrderRecord,
  SaleOrderRecord,
  StaffStore,
  StoredPriceLine,
} from "../repositories/staff-store.js";
import { hashHoldToken } from "./hold-token.js";
import { repriceHeldRental } from "./hold-rental.js";

const PAID_RENTAL = new Set(["confirmed", "active", "checklist", "completed", "cancelled"]);

export type RentalOrderView = {
  id: string;
  status: string;
  confirming: boolean;
  number: string | null;
  plate: string | null;
  make: string;
  model: string;
  pickupAt: string;
  returnAt: string;
  lotAddress: string;
  returnAddress: string;
  lines: StoredPriceLine[];
  rentalAgorot: number;
  insuranceAgorot: number;
  deliveryFeeAgorot: number;
  totalAgorot: number;
  liveTotalAgorot: number;
  priceChanged: boolean;
  kmAllowance: number;
};

export type SaleOrderView = {
  id: string;
  status: string;
  confirming: boolean;
  number: string | null;
  make: string;
  model: string;
  listPriceAgorot: number;
  depositAgorot: number;
  holdExpiresAt: string | null;
};

export type AccountView = {
  fullName: string;
  phone: string;
  email: string;
  birthDate: string;
  rentals: {
    id: string;
    status: string;
    number: string | null;
    make: string;
    model: string;
    totalAgorot: number;
  }[];
  sales: {
    id: string;
    status: string;
    number: string | null;
    make: string;
    model: string;
    depositAgorot: number;
  }[];
};

function paidNumber(status: string, number: string): string | null {
  return PAID_RENTAL.has(status) || status === "reserved" ? number : null;
}

function rentalAllowed(
  order: RentalOrderRecord,
  customerId: string | null,
  holdToken: string | null,
): boolean {
  if (customerId !== null && order.customerId === customerId) return true;
  if (holdToken === null || order.holderTokenHash === null) return false;
  return order.holderTokenHash === hashHoldToken(holdToken);
}

/** Order page data. The plate and order number stay hidden until payment is confirmed. */
export async function readRentalOrder(
  store: StaffStore,
  geocoder: Geocoder,
  orderId: string,
  customerId: string | null,
  holdToken: string | null,
  now: Date,
): Promise<Result<RentalOrderView>> {
  const order = await store.findRentalOrder(orderId);
  if (order === null || !rentalAllowed(order, customerId, holdToken)) {
    return err("NOT_FOUND");
  }
  const [car, lot] = await Promise.all([store.findCar(order.carId), store.readLot()]);
  if (car === null || lot === null) return err("NOT_FOUND");
  const repriced =
    order.status === "pending_payment"
      ? await repriceHeldRental(store, geocoder, order, now)
      : null;
  const live = repriced !== null && repriced.ok ? repriced.value.totalAgorot : order.totalAgorot;
  const revealed = PAID_RENTAL.has(order.status);
  return ok({
    id: order.id,
    status: order.status,
    confirming: order.status === "pending_payment",
    number: revealed ? order.number : null,
    plate: revealed ? car.plate : null,
    make: car.make,
    model: car.model,
    pickupAt: order.pickupAt.toISOString(),
    returnAt: order.returnAt.toISOString(),
    lotAddress: lot.address,
    returnAddress: order.returnMode === "lot" ? lot.address : order.returnAddress,
    lines: order.priceLines,
    rentalAgorot: order.rentalAgorot,
    insuranceAgorot: order.insuranceAgorot,
    deliveryFeeAgorot: order.deliveryFeeAgorot,
    totalAgorot: order.totalAgorot,
    liveTotalAgorot: live,
    priceChanged: live !== order.totalAgorot,
    kmAllowance: order.kmAllowance,
  });
}

/** Reservation page. A paid deposit has no expiry. */
export async function readSaleOrder(
  store: StaffStore,
  orderId: string,
  customerId: string | null,
  holdToken: string | null,
): Promise<Result<SaleOrderView>> {
  const order = await store.findSaleOrder(orderId);
  if (order === null || !saleAllowed(order, customerId, holdToken)) return err("NOT_FOUND");
  const car = await store.findCar(order.carId);
  if (car === null) return err("NOT_FOUND");
  const revealed =
    order.status === "reserved" || order.status === "completed" || order.status === "cancelled";
  return ok({
    id: order.id,
    status: order.status,
    confirming: order.status === "pending_payment",
    number: revealed ? order.number : null,
    make: car.make,
    model: car.model,
    listPriceAgorot: order.listPriceAgorot,
    depositAgorot: order.depositAgorot,
    holdExpiresAt:
      order.status === "reserved" ? null : (order.holdExpiresAt?.toISOString() ?? null),
  });
}

function saleAllowed(
  order: SaleOrderRecord,
  customerId: string | null,
  holdToken: string | null,
): boolean {
  if (customerId !== null && order.customerId === customerId) return true;
  if (holdToken === null || order.holderTokenHash === null) return false;
  return order.holderTokenHash === hashHoldToken(holdToken);
}

/** The signed-in customer's details and orders. Block reasons stay off this payload. */
export async function readAccount(
  store: StaffStore,
  customerId: string,
): Promise<Result<AccountView>> {
  const customer = await store.findCustomerById(customerId);
  if (customer === null) return err("UNAUTHENTICATED");
  const [rentals, sales] = await Promise.all([
    store.listRentalsForCustomer(customerId),
    store.listSalesForCustomer(customerId),
  ]);
  const rentalViews = [];
  for (const rental of rentals) {
    const car = await store.findCar(rental.carId);
    rentalViews.push({
      id: rental.id,
      status: rental.status,
      number: paidNumber(rental.status, rental.number),
      make: car?.make ?? "",
      model: car?.model ?? "",
      totalAgorot: rental.totalAgorot,
    });
  }
  const saleViews = [];
  for (const sale of sales) {
    const car = await store.findCar(sale.carId);
    saleViews.push({
      id: sale.id,
      status: sale.status,
      number: sale.status === "reserved" || sale.status === "completed" ? sale.number : null,
      make: car?.make ?? "",
      model: car?.model ?? "",
      depositAgorot: sale.depositAgorot,
    });
  }
  return ok({
    fullName: customer.fullName,
    phone: customer.phone,
    email: customer.email,
    birthDate: civilDateKey(customer.birthDate),
    rentals: rentalViews,
    sales: saleViews,
  });
}
