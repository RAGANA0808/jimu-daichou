-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('HEAD_PRIEST', 'PRIEST', 'STAFF', 'READ_ONLY');

-- CreateEnum
CREATE TYPE "PreparationStatus" AS ENUM ('TENTATIVE', 'CONFIRMED', 'DONE', 'CANCELED');

-- CreateEnum
CREATE TYPE "GravePlotType" AS ENUM ('INDIVIDUAL', 'COUPLE', 'FAMILY', 'ETERNAL_MEMORIAL', 'OSSUARY');

-- CreateEnum
CREATE TYPE "GravePlotStatus" AS ENUM ('AVAILABLE', 'IN_USE', 'RESERVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "TransactionCategory" AS ENUM ('MAINTENANCE_FEE', 'OFFERING', 'DONATION', 'EVENT_FEE', 'EXPENSE', 'OTHER');

-- CreateEnum
CREATE TYPE "TransactionDirection" AS ENUM ('INCOME', 'EXPENSE');

-- CreateEnum
CREATE TYPE "InteractionKind" AS ENUM ('PHONE', 'VISIT', 'EMAIL', 'CONVERSATION', 'NOTE');

-- CreateTable
CREATE TABLE "Tenant" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'STAFF',
    "supabaseUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Household" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "householderName" TEXT NOT NULL,
    "nameKana" TEXT NOT NULL,
    "postalCode" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "mobile" TEXT,
    "email" TEXT,
    "secondaryContact" TEXT,
    "memo" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Household_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Person" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "householdId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "nameKana" TEXT NOT NULL,
    "familyRelation" TEXT,
    "birthDate" DATE,
    "isDeceased" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Person_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeathLedgerEntry" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "personId" UUID NOT NULL,
    "kaimyoName" TEXT,
    "secularName" TEXT NOT NULL,
    "dateOfDeath" DATE NOT NULL,
    "dateOfDeathWareki" TEXT,
    "ageAtDeath" INTEGER,
    "burialLocation" TEXT,
    "memo" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeathLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemorialService" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "householdId" UUID NOT NULL,
    "serviceName" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "location" TEXT,
    "attendeeCount" INTEGER,
    "tobaCount" INTEGER,
    "offeringAmount" INTEGER,
    "preparationStatus" "PreparationStatus" NOT NULL DEFAULT 'TENTATIVE',
    "assignedUserId" UUID,
    "googleCalendarEventId" TEXT,
    "memo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemorialService_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GravePlot" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "householdId" UUID,
    "plotNumber" TEXT NOT NULL,
    "plotType" "GravePlotType" NOT NULL,
    "status" "GravePlotStatus" NOT NULL DEFAULT 'AVAILABLE',
    "contractDate" DATE,
    "contractPlan" TEXT,
    "positionX" INTEGER,
    "positionY" INTEGER,
    "memo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GravePlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "householdId" UUID,
    "category" "TransactionCategory" NOT NULL,
    "amount" INTEGER NOT NULL,
    "direction" "TransactionDirection" NOT NULL,
    "paidAt" DATE NOT NULL,
    "paymentMethod" TEXT,
    "memo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InteractionNote" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "householdId" UUID NOT NULL,
    "authorId" UUID,
    "kind" "InteractionKind" NOT NULL DEFAULT 'NOTE',
    "content" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InteractionNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "householdId" UUID,
    "title" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "User_supabaseUserId_key" ON "User"("supabaseUserId");

-- CreateIndex
CREATE INDEX "User_tenantId_idx" ON "User"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "User_tenantId_email_key" ON "User"("tenantId", "email");

-- CreateIndex
CREATE INDEX "Household_tenantId_idx" ON "Household"("tenantId");

-- CreateIndex
CREATE INDEX "Household_tenantId_nameKana_idx" ON "Household"("tenantId", "nameKana");

-- CreateIndex
CREATE INDEX "Household_tenantId_phone_idx" ON "Household"("tenantId", "phone");

-- CreateIndex
CREATE INDEX "Household_tenantId_mobile_idx" ON "Household"("tenantId", "mobile");

-- CreateIndex
CREATE INDEX "Person_tenantId_idx" ON "Person"("tenantId");

-- CreateIndex
CREATE INDEX "Person_householdId_idx" ON "Person"("householdId");

-- CreateIndex
CREATE INDEX "Person_tenantId_nameKana_idx" ON "Person"("tenantId", "nameKana");

-- CreateIndex
CREATE UNIQUE INDEX "DeathLedgerEntry_personId_key" ON "DeathLedgerEntry"("personId");

-- CreateIndex
CREATE INDEX "DeathLedgerEntry_tenantId_idx" ON "DeathLedgerEntry"("tenantId");

-- CreateIndex
CREATE INDEX "DeathLedgerEntry_tenantId_dateOfDeath_idx" ON "DeathLedgerEntry"("tenantId", "dateOfDeath");

-- CreateIndex
CREATE INDEX "MemorialService_tenantId_idx" ON "MemorialService"("tenantId");

-- CreateIndex
CREATE INDEX "MemorialService_tenantId_scheduledAt_idx" ON "MemorialService"("tenantId", "scheduledAt");

-- CreateIndex
CREATE INDEX "MemorialService_householdId_idx" ON "MemorialService"("householdId");

-- CreateIndex
CREATE INDEX "GravePlot_tenantId_idx" ON "GravePlot"("tenantId");

-- CreateIndex
CREATE INDEX "GravePlot_tenantId_status_idx" ON "GravePlot"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "GravePlot_tenantId_plotNumber_key" ON "GravePlot"("tenantId", "plotNumber");

-- CreateIndex
CREATE INDEX "Transaction_tenantId_idx" ON "Transaction"("tenantId");

-- CreateIndex
CREATE INDEX "Transaction_tenantId_paidAt_idx" ON "Transaction"("tenantId", "paidAt");

-- CreateIndex
CREATE INDEX "Transaction_householdId_idx" ON "Transaction"("householdId");

-- CreateIndex
CREATE INDEX "InteractionNote_tenantId_idx" ON "InteractionNote"("tenantId");

-- CreateIndex
CREATE INDEX "InteractionNote_householdId_occurredAt_idx" ON "InteractionNote"("householdId", "occurredAt");

-- CreateIndex
CREATE INDEX "Document_tenantId_idx" ON "Document"("tenantId");

-- CreateIndex
CREATE INDEX "Document_householdId_idx" ON "Document"("householdId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Household" ADD CONSTRAINT "Household_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Person" ADD CONSTRAINT "Person_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Person" ADD CONSTRAINT "Person_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeathLedgerEntry" ADD CONSTRAINT "DeathLedgerEntry_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeathLedgerEntry" ADD CONSTRAINT "DeathLedgerEntry_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemorialService" ADD CONSTRAINT "MemorialService_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemorialService" ADD CONSTRAINT "MemorialService_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GravePlot" ADD CONSTRAINT "GravePlot_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GravePlot" ADD CONSTRAINT "GravePlot_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InteractionNote" ADD CONSTRAINT "InteractionNote_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InteractionNote" ADD CONSTRAINT "InteractionNote_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE SET NULL ON UPDATE CASCADE;
