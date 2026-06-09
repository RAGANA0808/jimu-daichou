-- CreateEnum
CREATE TYPE "MaintenanceFeeMethod" AS ENUM ('ANNUAL_LUMP', 'BON_HIGAN', 'BANK_TRANSFER', 'CASH_COLLECTION', 'OTHER');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('UNPAID', 'PARTIAL', 'PAID');

-- CreateTable
CREATE TABLE "MaintenanceFeePlan" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "householdId" UUID NOT NULL,
    "annualAmount" INTEGER NOT NULL,
    "method" "MaintenanceFeeMethod" NOT NULL DEFAULT 'CASH_COLLECTION',
    "note" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaintenanceFeePlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaintenanceFeeInvoice" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "householdId" UUID NOT NULL,
    "fiscalYear" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "paidAmount" INTEGER NOT NULL DEFAULT 0,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'UNPAID',
    "method" "MaintenanceFeeMethod" NOT NULL DEFAULT 'CASH_COLLECTION',
    "dueDate" DATE,
    "transactionId" UUID,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaintenanceFeeInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MaintenanceFeePlan_householdId_key" ON "MaintenanceFeePlan"("householdId");

-- CreateIndex
CREATE INDEX "MaintenanceFeePlan_tenantId_idx" ON "MaintenanceFeePlan"("tenantId");

-- CreateIndex
CREATE INDEX "MaintenanceFeePlan_householdId_idx" ON "MaintenanceFeePlan"("householdId");

-- CreateIndex
CREATE UNIQUE INDEX "MaintenanceFeeInvoice_transactionId_key" ON "MaintenanceFeeInvoice"("transactionId");

-- CreateIndex
CREATE INDEX "MaintenanceFeeInvoice_tenantId_idx" ON "MaintenanceFeeInvoice"("tenantId");

-- CreateIndex
CREATE INDEX "MaintenanceFeeInvoice_tenantId_fiscalYear_idx" ON "MaintenanceFeeInvoice"("tenantId", "fiscalYear");

-- CreateIndex
CREATE INDEX "MaintenanceFeeInvoice_tenantId_fiscalYear_status_idx" ON "MaintenanceFeeInvoice"("tenantId", "fiscalYear", "status");

-- CreateIndex
CREATE INDEX "MaintenanceFeeInvoice_householdId_idx" ON "MaintenanceFeeInvoice"("householdId");

-- CreateIndex
CREATE UNIQUE INDEX "MaintenanceFeeInvoice_tenantId_householdId_fiscalYear_key" ON "MaintenanceFeeInvoice"("tenantId", "householdId", "fiscalYear");

-- AddForeignKey
ALTER TABLE "MaintenanceFeePlan" ADD CONSTRAINT "MaintenanceFeePlan_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceFeePlan" ADD CONSTRAINT "MaintenanceFeePlan_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceFeeInvoice" ADD CONSTRAINT "MaintenanceFeeInvoice_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceFeeInvoice" ADD CONSTRAINT "MaintenanceFeeInvoice_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceFeeInvoice" ADD CONSTRAINT "MaintenanceFeeInvoice_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Row Level Security: テナント分離ポリシーを適用する (既存 20260423022852_enable_rls / 20260605030000_add_shipment_models のパターン踏襲)。
-- セッション変数 app.current_tenant_id は lib/db/with-tenant.ts で SET LOCAL される。
-- current_setting(..., true) の第 2 引数 true により、未設定時は NULL → UUID キャストで何もマッチしない。
ALTER TABLE "MaintenanceFeePlan" ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "MaintenanceFeePlan"
  USING ("tenantId" = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK ("tenantId" = current_setting('app.current_tenant_id', true)::uuid);

ALTER TABLE "MaintenanceFeeInvoice" ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "MaintenanceFeeInvoice"
  USING ("tenantId" = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK ("tenantId" = current_setting('app.current_tenant_id', true)::uuid);

