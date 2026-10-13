-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "LotSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "name" TEXT NOT NULL DEFAULT '',
    "address" TEXT NOT NULL DEFAULT '',
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "phone" TEXT NOT NULL DEFAULT '',
    "publicEmail" TEXT NOT NULL DEFAULT '',
    "staffAlertEmail" TEXT NOT NULL DEFAULT '',
    "kmPerDay" INTEGER NOT NULL DEFAULT 250,
    "excessKmPriceAgorot" INTEGER NOT NULL DEFAULT 200,
    "fuelShortagePricePerLiterAgorot" INTEGER NOT NULL DEFAULT 800,

    CONSTRAINT "LotSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SettingChange" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "scope" TEXT NOT NULL,
    "entityId" TEXT,
    "previousJson" JSONB NOT NULL,
    "nextJson" JSONB NOT NULL,

    CONSTRAINT "SettingChange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Holiday" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Holiday_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InsurancePackage" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "dailyPriceAgorot" INTEGER NOT NULL,
    "includedInBase" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL,

    CONSTRAINT "InsurancePackage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Car" (
    "id" TEXT NOT NULL,
    "plate" TEXT NOT NULL,
    "vin" TEXT,
    "make" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "color" TEXT NOT NULL,
    "primaryType" TEXT NOT NULL,
    "seats" INTEGER NOT NULL,
    "currentKm" INTEGER NOT NULL,
    "purchasedAt" DATE NOT NULL,
    "minAge" INTEGER,
    "ownersCount" INTEGER,
    "knownAccidents" TEXT,
    "accidentsNone" BOOLEAN NOT NULL DEFAULT false,
    "conditionGrade" TEXT,
    "salePriceAgorot" INTEGER,
    "deepTreatmentCompletedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL,
    "careReason" TEXT,
    "internalNotes" TEXT NOT NULL DEFAULT '',
    "saleAlertSentAt" TIMESTAMP(3),

    CONSTRAINT "Car_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CarTag" (
    "carId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "CarTag_pkey" PRIMARY KEY ("carId","tagId")
);

-- CreateTable
CREATE TABLE "CarPhoto" (
    "id" TEXT NOT NULL,
    "carId" TEXT NOT NULL,
    "alt" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,

    CONSTRAINT "CarPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgeBand" (
    "id" TEXT NOT NULL,
    "carId" TEXT NOT NULL,
    "minAge" INTEGER NOT NULL,
    "maxAge" INTEGER,
    "weekdayDailyAgorot" INTEGER NOT NULL,
    "weekendDailyAgorot" INTEGER NOT NULL,
    "holidayDailyAgorot" INTEGER NOT NULL,

    CONSTRAINT "AgeBand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "birthDate" DATE NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "blocked" BOOLEAN NOT NULL DEFAULT false,
    "blockReason" TEXT,
    "blockNote" TEXT NOT NULL DEFAULT '',
    "blockedAt" TIMESTAMP(3),
    "blockedByStaffId" TEXT,
    "unblockedAt" TIMESTAMP(3),
    "unblockedByStaffId" TEXT,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Staff" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RentalOrder" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "carId" TEXT NOT NULL,
    "customerId" TEXT,
    "holderTokenHash" TEXT,
    "pickupAt" TIMESTAMP(3) NOT NULL,
    "returnAt" TIMESTAMP(3) NOT NULL,
    "searchAge" INTEGER NOT NULL,
    "ageAtPickup" INTEGER NOT NULL,
    "returnMode" TEXT NOT NULL,
    "returnAddress" TEXT NOT NULL DEFAULT '',
    "returnLat" DOUBLE PRECISION,
    "returnLng" DOUBLE PRECISION,
    "straightLineKm" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "billedKm" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "deliveryFeeAgorot" INTEGER NOT NULL,
    "insurancePackageId" TEXT NOT NULL,
    "rentalAgorot" INTEGER NOT NULL,
    "insuranceAgorot" INTEGER NOT NULL,
    "totalAgorot" INTEGER NOT NULL,
    "priceLines" JSONB NOT NULL,
    "kmAllowance" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "holdExpiresAt" TIMESTAMP(3),
    "paymentProvider" TEXT NOT NULL DEFAULT 'stripe',
    "paymentRef" TEXT,
    "startKm" INTEGER,
    "noShow" BOOLEAN NOT NULL DEFAULT false,
    "cancelledBy" TEXT,
    "yardCancelNote" TEXT NOT NULL DEFAULT '',
    "refundPercent" INTEGER,
    "refundAgorot" INTEGER,
    "reminderSentAt" TIMESTAMP(3),

    CONSTRAINT "RentalOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Checklist" (
    "id" TEXT NOT NULL,
    "rentalOrderId" TEXT NOT NULL,
    "endKm" INTEGER,
    "fuelLitersShort" DECIMAL(6,1),
    "fuelChargeAgorot" INTEGER,
    "kmExcess" INTEGER,
    "kmChargeAgorot" INTEGER,
    "washNeeded" BOOLEAN NOT NULL DEFAULT false,
    "washDone" BOOLEAN NOT NULL DEFAULT false,
    "treatmentNeeded" BOOLEAN NOT NULL DEFAULT false,
    "treatmentDone" BOOLEAN NOT NULL DEFAULT false,
    "treatmentNote" TEXT NOT NULL DEFAULT '',
    "priceDecision" TEXT,
    "completedAt" TIMESTAMP(3),
    "completedByStaffId" TEXT,

    CONSTRAINT "Checklist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Damage" (
    "id" TEXT NOT NULL,
    "checklistId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "estimatedAgorot" INTEGER NOT NULL,

    CONSTRAINT "Damage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DamagePhoto" (
    "id" TEXT NOT NULL,
    "damageId" TEXT NOT NULL,

    CONSTRAINT "DamagePhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChecklistPhoto" (
    "id" TEXT NOT NULL,
    "checklistId" TEXT NOT NULL,

    CONSTRAINT "ChecklistPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaleOrder" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "carId" TEXT NOT NULL,
    "customerId" TEXT,
    "holderTokenHash" TEXT,
    "listPriceAgorot" INTEGER NOT NULL,
    "depositAgorot" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "wantsFinancing" BOOLEAN NOT NULL DEFAULT false,
    "financingNote" TEXT NOT NULL DEFAULT '',
    "wantsTradeIn" BOOLEAN NOT NULL DEFAULT false,
    "tradeInNote" TEXT NOT NULL DEFAULT '',
    "holdExpiresAt" TIMESTAMP(3),
    "paymentProvider" TEXT NOT NULL DEFAULT 'stripe',
    "paymentRef" TEXT,
    "refundDecidedAt" TIMESTAMP(3),
    "refundApproved" BOOLEAN,
    "refundByStaffId" TEXT,
    "handoverAt" TIMESTAMP(3),
    "handoverByStaffId" TEXT,

    CONSTRAINT "SaleOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentEvent" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerEventId" TEXT NOT NULL,
    "orderKind" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailOutbox" (
    "id" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "EmailOutbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobCheckpoint" (
    "name" TEXT NOT NULL,
    "ranAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobCheckpoint_pkey" PRIMARY KEY ("name")
);

-- CreateTable
CREATE TABLE "KmAdjustment" (
    "id" TEXT NOT NULL,
    "carId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "previousKm" INTEGER NOT NULL,
    "nextKm" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KmAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderSequence" (
    "kind" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "last" INTEGER NOT NULL,

    CONSTRAINT "OrderSequence_pkey" PRIMARY KEY ("kind","year")
);

-- CreateIndex
CREATE UNIQUE INDEX "Holiday_date_key" ON "Holiday"("date");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_name_key" ON "Tag"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Car_plate_key" ON "Car"("plate");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_email_key" ON "Customer"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Staff_email_key" ON "Staff"("email");

-- CreateIndex
CREATE UNIQUE INDEX "RentalOrder_number_key" ON "RentalOrder"("number");

-- CreateIndex
CREATE UNIQUE INDEX "RentalOrder_holderTokenHash_key" ON "RentalOrder"("holderTokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "Checklist_rentalOrderId_key" ON "Checklist"("rentalOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "SaleOrder_number_key" ON "SaleOrder"("number");

-- CreateIndex
CREATE UNIQUE INDEX "SaleOrder_holderTokenHash_key" ON "SaleOrder"("holderTokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentEvent_provider_providerEventId_key" ON "PaymentEvent"("provider", "providerEventId");

-- AddForeignKey
ALTER TABLE "CarTag" ADD CONSTRAINT "CarTag_carId_fkey" FOREIGN KEY ("carId") REFERENCES "Car"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarTag" ADD CONSTRAINT "CarTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarPhoto" ADD CONSTRAINT "CarPhoto_carId_fkey" FOREIGN KEY ("carId") REFERENCES "Car"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgeBand" ADD CONSTRAINT "AgeBand_carId_fkey" FOREIGN KEY ("carId") REFERENCES "Car"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalOrder" ADD CONSTRAINT "RentalOrder_carId_fkey" FOREIGN KEY ("carId") REFERENCES "Car"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Checklist" ADD CONSTRAINT "Checklist_rentalOrderId_fkey" FOREIGN KEY ("rentalOrderId") REFERENCES "RentalOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Damage" ADD CONSTRAINT "Damage_checklistId_fkey" FOREIGN KEY ("checklistId") REFERENCES "Checklist"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DamagePhoto" ADD CONSTRAINT "DamagePhoto_damageId_fkey" FOREIGN KEY ("damageId") REFERENCES "Damage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistPhoto" ADD CONSTRAINT "ChecklistPhoto_checklistId_fkey" FOREIGN KEY ("checklistId") REFERENCES "Checklist"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleOrder" ADD CONSTRAINT "SaleOrder_carId_fkey" FOREIGN KEY ("carId") REFERENCES "Car"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- One open rental per car. Open means a hold that has not expired in
-- application code, plus confirmed, active, and checklist.
CREATE UNIQUE INDEX rental_one_open_per_car
ON "RentalOrder" ("carId")
WHERE status IN ('pending_payment', 'confirmed', 'active', 'checklist');

-- One open sale per car. Open means an unexpired hold or a reservation.
CREATE UNIQUE INDEX sale_one_open_per_car
ON "SaleOrder" ("carId")
WHERE status IN ('pending_payment', 'reserved');

-- Exactly one active package can be the included base insurance.
CREATE UNIQUE INDEX one_active_base_insurance
ON "InsurancePackage" ("includedInBase")
WHERE "includedInBase" = true AND active = true;
