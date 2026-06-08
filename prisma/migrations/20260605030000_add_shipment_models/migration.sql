-- CreateEnum
CREATE TYPE "ShipmentDocumentType" AS ENUM ('NOTICE_LETTER', 'ADDRESS_LABEL', 'ENVELOPE', 'CSV');

-- CreateTable
CREATE TABLE "ShipmentBatch" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "documentType" "ShipmentDocumentType" NOT NULL DEFAULT 'NOTICE_LETTER',
    "serviceDate" TIMESTAMP(3),
    "location" TEXT,
    "offeringGuide" TEXT,
    "replyDeadline" DATE,
    "bodyNote" TEXT,
    "targetYear" INTEGER,
    "recipientCount" INTEGER NOT NULL DEFAULT 0,
    "sentById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShipmentBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShipmentRecipient" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "batchId" UUID NOT NULL,
    "householdId" UUID,
    "householderName" TEXT NOT NULL,
    "postalCode" TEXT,
    "address" TEXT,
    "summary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShipmentRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ShipmentBatch_tenantId_idx" ON "ShipmentBatch"("tenantId");

-- CreateIndex
CREATE INDEX "ShipmentBatch_tenantId_createdAt_idx" ON "ShipmentBatch"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "ShipmentRecipient_tenantId_idx" ON "ShipmentRecipient"("tenantId");

-- CreateIndex
CREATE INDEX "ShipmentRecipient_batchId_idx" ON "ShipmentRecipient"("batchId");

-- CreateIndex
CREATE INDEX "ShipmentRecipient_householdId_idx" ON "ShipmentRecipient"("householdId");

-- AddForeignKey
ALTER TABLE "ShipmentBatch" ADD CONSTRAINT "ShipmentBatch_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipmentRecipient" ADD CONSTRAINT "ShipmentRecipient_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipmentRecipient" ADD CONSTRAINT "ShipmentRecipient_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ShipmentBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipmentRecipient" ADD CONSTRAINT "ShipmentRecipient_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Row Level Security: テナント分離ポリシーを適用する (既存 20260423022852_enable_rls / 20260605020000_add_toba_model のパターン踏襲)。
-- セッション変数 app.current_tenant_id は lib/db/with-tenant.ts で SET LOCAL される。
-- current_setting(..., true) の第 2 引数 true により、未設定時は NULL → UUID キャストで何もマッチしない。
ALTER TABLE "ShipmentBatch" ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "ShipmentBatch"
  USING ("tenantId" = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK ("tenantId" = current_setting('app.current_tenant_id', true)::uuid);

ALTER TABLE "ShipmentRecipient" ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "ShipmentRecipient"
  USING ("tenantId" = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK ("tenantId" = current_setting('app.current_tenant_id', true)::uuid);
