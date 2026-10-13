import { storedAgorot } from "../domain/money.js";
import { checkSaleMove } from "../domain/orders.js";
import { err, ok, type Result } from "../domain/result.js";
import { SALE_STATUSES, type SaleStatus } from "../domain/status.js";
import { checkCarMove } from "../domain/transitions.js";
import type { SaleOrderRecord, StaffStore } from "../repositories/staff-store.js";
import { toCarWrite } from "./car-view.js";
import { requirePermission } from "./login-staff.js";
import type { StaffActor } from "./staff-actor.js";

export type SaleDeskView = {
  id: string;
  number: string;
  carId: string;
  plate: string;
  make: string;
  model: string;
  status: SaleStatus;
  listPriceAgorot: number;
  depositAgorot: number;
  refundApproved: boolean | null;
  handoverAt: string | null;
};

function asStatus(value: string): SaleStatus {
  for (const status of SALE_STATUSES) {
    if (status === value) return status;
  }
  throw new Error(`Unexpected stored status ${value}`);
}

async function present(store: StaffStore, order: SaleOrderRecord): Promise<SaleDeskView> {
  const car = await store.findCar(order.carId);
  return {
    id: order.id,
    number: order.number,
    carId: order.carId,
    plate: car?.plate ?? "",
    make: car?.make ?? "",
    model: car?.model ?? "",
    status: asStatus(order.status),
    listPriceAgorot: order.listPriceAgorot,
    depositAgorot: order.depositAgorot,
    refundApproved: order.refundApproved,
    handoverAt: order.handoverAt?.toISOString() ?? null,
  };
}

/** Sale reservations for the yard. */
export async function listSaleDesk(
  store: StaffStore,
  actor: StaffActor,
): Promise<Result<SaleDeskView[]>> {
  const allowed = requirePermission(actor.role, "sales.read");
  if (!allowed.ok) return allowed;
  const orders = await store.listSaleOrders();
  const views: SaleDeskView[] = [];
  for (const order of orders) views.push(await present(store, order));
  return ok(views);
}

/** Marks the balance as received at the lot and the car as sold. */
export async function handOverSale(
  store: StaffStore,
  actor: StaffActor,
  orderId: string,
  now: Date,
): Promise<Result<SaleDeskView>> {
  const allowed = requirePermission(actor.role, "sales.handover");
  if (!allowed.ok) return allowed;
  return store.transaction(async (tx) => {
    const order = await tx.findSaleOrder(orderId);
    if (order === null) return err("NOT_FOUND");
    const move = checkSaleMove({
      from: asStatus(order.status),
      to: "completed",
      cause: "handover",
      actor: { kind: "staff", role: actor.role },
    });
    if (!move.ok) return move;
    const car = await tx.findCar(order.carId);
    if (car === null) return err("NOT_FOUND");
    if (car.status !== "for_sale") return err("ILLEGAL_TRANSITION");
    const edge = checkCarMove(car.status, "sold", {
      role: actor.role,
      cause: "sale_handover",
      hasOpenRental: false,
      hasOpenSaleReservation: false,
      hasMinAge: car.minAge !== null,
      ageBandCount: car.ageBands.length,
      listing: {
        ownersCount: car.ownersCount,
        knownAccidents: car.knownAccidents,
        accidentsNone: car.accidentsNone,
        conditionGrade: car.conditionGrade,
        salePriceAgorot: car.salePriceAgorot === null ? null : storedAgorot(car.salePriceAgorot),
        photoCount: car.photos.length,
      },
    });
    if (!edge.ok) return edge;
    const next: SaleOrderRecord = {
      ...order,
      status: "completed",
      handoverAt: now,
      handoverByStaffId: actor.id,
    };
    await tx.updateSaleOrder(next);
    await tx.updateCar({ ...toCarWrite(car), status: "sold", careReason: null });
    return ok(await present(tx, next));
  });
}
