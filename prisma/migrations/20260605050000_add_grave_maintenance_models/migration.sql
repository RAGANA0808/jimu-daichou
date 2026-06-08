-- CreateEnum
CREATE TYPE "GraveMaintenanceMethod" AS ENUM ('BANK_TRANSFER', 'POSTAL_TRANSFER', 'ANNUAL_LUMP', 'CASH', 'OTHER');

-- CreateTable
CREATE TABLE "GraveMaintenancePlan" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "gravePlotId" UUID NOT NULL,
    "annualAmount" INTEGER NOT NULL,
    "basis" TEXT,
    "method" "GraveMaintenanceMethod" NOT NULL DEFAULT 'BANK_TRANSFER',
    "note" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GraveMaintenancePlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GraveMaintenanceInvoice" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "gravePlotId" UUID NOT NULL,
    "fiscalYear" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "paidAmount" INTEGER NOT NULL DEFAULT 0,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'UNPAID',
    "method" "GraveMaintenanceMethod" NOT NULL DEFAULT 'BANK_TRANSFER',
    "dueDate" DATE,
    "transactionId" UUID,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GraveMaintenanceInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GraveMaintenancePlan_gravePlotId_key" ON "GraveMaintenancePlan"("gravePlotId");

-- CreateIndex
CREATE INDEX "GraveMaintenancePlan_tenantId_idx" ON "GraveMaintenancePlan"("tenantId");

-- CreateIndex
CREATE INDEX "GraveMaintenancePlan_gravePlotId_idx" ON "GraveMaintenancePlan"("gravePlotId");

-- CreateIndex
CREATE UNIQUE INDEX "GraveMaintenanceInvoice_transactionId_key" ON "GraveMaintenanceInvoice"("transactionId");

-- CreateIndex
CREATE INDEX "GraveMaintenanceInvoice_tenantId_idx" ON "GraveMaintenanceInvoice"("tenantId");

-- CreateIndex
CREATE INDEX "GraveMaintenanceInvoice_tenantId_fiscalYear_idx" ON "GraveMaintenanceInvoice"("tenantId", "fiscalYear");

-- CreateIndex
CREATE INDEX "GraveMaintenanceInvoice_tenantId_fiscalYear_status_idx" ON "GraveMaintenanceInvoice"("tenantId", "fiscalYear", "status");

-- CreateIndex
CREATE INDEX "GraveMaintenanceInvoice_gravePlotId_idx" ON "GraveMaintenanceInvoice"("gravePlotId");

-- CreateIndex
CREATE UNIQUE INDEX "GraveMaintenanceInvoice_tenantId_gravePlotId_fiscalYear_key" ON "GraveMaintenanceInvoice"("tenantId", "gravePlotId", "fiscalYear");

-- AddForeignKey
ALTER TABLE "GraveMaintenancePlan" ADD CONSTRAINT "GraveMaintenancePlan_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GraveMaintenancePlan" ADD CONSTRAINT "GraveMaintenancePlan_gravePlotId_fkey" FOREIGN KEY ("gravePlotId") REFERENCES "GravePlot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GraveMaintenanceInvoice" ADD CONSTRAINT "GraveMaintenanceInvoice_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GraveMaintenanceInvoice" ADD CONSTRAINT "GraveMaintenanceInvoice_gravePlotId_fkey" FOREIGN KEY ("gravePlotId") REFERENCES "GravePlot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GraveMaintenanceInvoice" ADD CONSTRAINT "GraveMaintenanceInvoice_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Row Level Security: テナント分離ポリシーを適用する (既存 20260605040000_add_maintenance_fee_models のパターン踏襲)。
-- セッション変数 app.current_tenant_id は lib/db/with-tenant.ts で SET LOCAL される。
-- current_setting(..., true) の第 2 引数 true により、未設定時は NULL → UUID キャストで何もマッチしない。
ALTER TABLE "GraveMaintenancePlan" ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "GraveMaintenancePlan"
  USING ("tenantId" = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK ("tenantId" = current_setting('app.current_tenant_id', true)::uuid);

ALTER TABLE "GraveMaintenanceInvoice" ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "GraveMaintenanceInvoice"
  USING ("tenantId" = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK ("tenantId" = current_setting('app.current_tenant_id', true)::uuid);
