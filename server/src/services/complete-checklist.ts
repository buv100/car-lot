import { randomUUID } from "node:crypto";

import { validateAgeBands, type AgeBand } from "../domain/age-bands.js";
import { assessChecklist, type PriceDecision } from "../domain/checklist.js";
import { returnCharges } from "../domain/charges.js";
import { storedAgorot, type Agorot } from "../domain/money.js";
import { detectPhotoKind, MAX_PHOTO_BYTES } from "../domain/photo.js";
import { err, ok, type Result } from "../domain/result.js";
import { RENTAL_STATUSES, type RentalStatus } from "../domain/status.js";
import type { PaymentProvider } from "../payments/provider.js";
import type { Mailer } from "../mail/mailer.js";
import type { ChecklistRecord, StaffStore } from "../repositories/staff-store.js";
import type { FileStore } from "../storage/file-store.js";
import { toCarWrite } from "./car-view.js";
import { deliverPending } from "./deliver-mail.js";
import { requirePermission } from "./login-staff.js";
import { queueCancellation, queueSaleAlertForCar } from "./order-mail.js";
import type { BandMoneyInput } from "./save-age-bands.js";
import type { StaffActor } from "./staff-actor.js";

export type ChecklistDamageDraft = {
  readonly description: string;
  readonly estimatedAgorot: Agorot;
  readonly photos: readonly Uint8Array[];
};

export type CompleteChecklistInput = {
  readonly endKm: number | null;
  readonly fuelLitersShort: number | null;
  readonly washNeeded: boolean;
  readonly washDone: boolean;
  readonly treatmentNeeded: boolean;
  readonly treatmentDone: boolean;
  readonly treatmentNote: string;
  readonly priceDecision: PriceDecision | null;
  readonly minAge: number | null;
  readonly bands: readonly BandMoneyInput[] | null;
  readonly returnPhotos: readonly Uint8Array[];
  readonly damages: readonly ChecklistDamageDraft[];
};

export type ChargePreview = {
  readonly kmExcess: number;
  readonly kmChargeAgorot: Agorot;
  readonly fuelChargeAgorot: Agorot;
};

function asStatus(value: string): RentalStatus {
  for (const status of RENTAL_STATUSES) {
    if (status === value) return status;
  }
  throw new Error(`Unexpected stored status ${value}`);
}

function photoOk(bytes: Uint8Array): boolean {
  return (
    bytes.byteLength > 0 && bytes.byteLength <= MAX_PHOTO_BYTES && detectPhotoKind(bytes) !== null
  );
}

async function storePhotos(
  files: FileStore,
  photos: readonly Uint8Array[],
): Promise<Result<string[]>> {
  const ids: string[] = [];
  for (const bytes of photos) {
    if (!photoOk(bytes)) return err("INVALID_PHOTO");
    const id = randomUUID();
    await files.savePrivatePhoto(id, bytes);
    ids.push(id);
  }
  return ok(ids);
}

/** Shows excess and fuel before the checklist is saved. The card is not charged. */
export async function previewChecklistCharges(
  store: StaffStore,
  actor: StaffActor,
  orderId: string,
  endKm: number,
  fuelLitersShort: number,
): Promise<Result<ChargePreview>> {
  const allowed = requirePermission(actor.role, "checklist.complete");
  if (!allowed.ok) return allowed;
  const order = await store.findRentalOrder(orderId);
  if (order === null || order.startKm === null) return err("NOT_FOUND");
  const lot = await store.readLot();
  if (lot === null) return err("LOT_NOT_READY");
  const charges = returnCharges({
    startKm: order.startKm,
    endKm,
    allowanceKm: order.kmAllowance,
    excessKmPriceAgorot: storedAgorot(lot.excessKmPriceAgorot),
    fuelLitersShort,
    fuelPricePerLiterAgorot: storedAgorot(lot.fuelShortagePricePerLiterAgorot),
  });
  if (!charges.ok) return charges;
  return ok({
    kmExcess: charges.value.excessKm,
    kmChargeAgorot: charges.value.kmChargeAgorot,
    fuelChargeAgorot: charges.value.fuelChargeAgorot,
  });
}

/** Closes the checklist. A normal return updates the car kilometres and frees it. */
export async function completeChecklist(
  store: StaffStore,
  files: FileStore,
  payments: PaymentProvider,
  actor: StaffActor,
  orderId: string,
  input: CompleteChecklistInput,
  now: Date,
  mailer: Mailer,
): Promise<Result<{ status: RentalStatus; currentKm: number }>> {
  const allowed = requirePermission(actor.role, "checklist.complete");
  if (!allowed.ok) return allowed;
  const order = await store.findRentalOrder(orderId);
  if (order === null || asStatus(order.status) !== "checklist" || order.startKm === null) {
    return err("NOT_FOUND");
  }
  const car = await store.findCar(order.carId);
  const lot = await store.readLot();
  if (car === null || lot === null) return err("NOT_FOUND");

  let priceUpdated = input.priceDecision === "keep";
  let bands: AgeBand[] | null = null;
  if (input.priceDecision === "update") {
    if (input.minAge === null || input.bands === null) return err("CHECKLIST_INCOMPLETE");
    bands = input.bands.map((band) => ({
      minAge: band.minAge,
      maxAge: band.maxAge,
      weekdayDailyAgorot: storedAgorot(band.weekdayDailyAgorot),
      weekendDailyAgorot: storedAgorot(band.weekendDailyAgorot),
      holidayDailyAgorot: storedAgorot(band.holidayDailyAgorot),
    }));
    const check = validateAgeBands(input.minAge, bands);
    if (!check.ok) return check;
    priceUpdated = true;
  }

  const assessed = assessChecklist({
    noShow: order.noShow,
    startKm: order.startKm,
    endKm: input.endKm,
    fuelLitersShort: input.fuelLitersShort,
    damages: input.damages.map((damage) => ({
      description: damage.description,
      estimatedAgorot: damage.estimatedAgorot,
      photoCount: damage.photos.length,
    })),
    washNeeded: input.washNeeded,
    washDone: input.washDone,
    treatmentNeeded: input.treatmentNeeded,
    treatmentDone: input.treatmentDone,
    returnPhotoCount: order.noShow ? 0 : input.returnPhotos.length,
    priceDecision: input.priceDecision,
    priceUpdated,
    allowanceKm: order.kmAllowance,
    excessKmPriceAgorot: storedAgorot(lot.excessKmPriceAgorot),
    fuelPricePerLiterAgorot: storedAgorot(lot.fuelShortagePricePerLiterAgorot),
  });
  if (!assessed.ok) return assessed;

  const returnPhotos = await storePhotos(files, order.noShow ? [] : input.returnPhotos);
  if (!returnPhotos.ok) return returnPhotos;
  const damages: ChecklistRecord["damages"] = [];
  for (const damage of input.damages) {
    const photos = await storePhotos(files, damage.photos);
    if (!photos.ok) return photos;
    damages.push({
      id: randomUUID(),
      description: damage.description.trim(),
      estimatedAgorot: damage.estimatedAgorot,
      photoIds: photos.value,
    });
  }

  if (assessed.value.nextStatus === "cancelled" && (order.refundAgorot ?? 0) > 0) {
    if (order.paymentRef === null) throw new Error("Paid order is missing a payment reference");
    await payments.refund({
      providerRef: order.paymentRef,
      amount: storedAgorot(order.refundAgorot ?? 0),
    });
  }

  const existing = await store.findChecklist(order.id);
  const checklist: ChecklistRecord = {
    id: existing?.id ?? randomUUID(),
    rentalOrderId: order.id,
    endKm: assessed.value.endKm,
    fuelLitersShort: assessed.value.fuelLitersShort,
    fuelChargeAgorot: assessed.value.fuelChargeAgorot,
    kmExcess: assessed.value.kmExcess,
    kmChargeAgorot: assessed.value.kmChargeAgorot,
    washNeeded: input.washNeeded,
    washDone: input.washDone,
    treatmentNeeded: input.treatmentNeeded,
    treatmentDone: input.treatmentDone,
    treatmentNote: input.treatmentNote.trim(),
    priceDecision: input.priceDecision,
    completedAt: now,
    completedByStaffId: actor.id,
    returnPhotoIds: returnPhotos.value,
    damages,
  };

  await store.transaction(async (tx) => {
    if (bands !== null && input.minAge !== null) {
      await tx.updateCar({ ...toCarWrite(car), minAge: input.minAge });
      await tx.replaceAgeBands(
        car.id,
        bands.map((band) => ({ id: randomUUID(), ...band })),
      );
    }
    const current = await tx.findCar(car.id);
    if (current === null) throw new Error("Car missing during checklist");
    await tx.updateCar({
      ...toCarWrite(current),
      currentKm: assessed.value.updateCarKm ? assessed.value.endKm : current.currentKm,
    });
    await tx.saveChecklist(checklist);
    await tx.updateRentalOrder({ ...order, status: assessed.value.nextStatus });
    await queueSaleAlertForCar(tx, car.id, now);
    if (assessed.value.nextStatus === "cancelled") await queueCancellation(tx, order.id, now);
  });
  await deliverPending(store, mailer, now);

  const saved = await store.findCar(car.id);
  if (saved === null) throw new Error("Car missing after checklist");
  return ok({ status: assessed.value.nextStatus, currentKm: saved.currentKm });
}
