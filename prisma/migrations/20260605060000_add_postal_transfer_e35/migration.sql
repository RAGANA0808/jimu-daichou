-- CreateEnum
CREATE TYPE "PostalTransferAmountSource" AS ENUM ('NONE', 'MAINTENANCE_FEE', 'GRAVE_MAINTENANCE');

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "postalAccountName" TEXT,
ADD COLUMN     "postalAccountNumber" TEXT,
ADD COLUMN     "postalAccountSymbol" TEXT,
ADD COLUMN     "postalPrintOffsetXMm" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "postalPrintOffsetYMm" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "postalTransferNote" TEXT;

-- CreateTable
CREATE TABLE "PostalTransferSubject" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "defaultAmount" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "amountSource" "PostalTransferAmountSource" NOT NULL DEFAULT 'NONE',
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PostalTransferSubject_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PostalTransferSubject_tenantId_idx" ON "PostalTransferSubject"("tenantId");

-- CreateIndex
CREATE INDEX "PostalTransferSubject_tenantId_sortOrder_idx" ON "PostalTransferSubject"("tenantId", "sortOrder");

-- AddForeignKey
ALTER TABLE "PostalTransferSubject" ADD CONSTRAINT "PostalTransferSubject_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Row Level Security: テナント分離ポリシーを適用する (既存 20260605040000_add_maintenance_fee_models のパターン踏襲)。
-- セッション変数 app.current_tenant_id は lib/db/with-tenant.ts で SET LOCAL される。
-- current_setting(..., true) の第 2 引数 true により、未設定時は NULL → UUID キャストで何もマッチしない。
ALTER TABLE "PostalTransferSubject" ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "PostalTransferSubject"
  USING ("tenantId" = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK ("tenantId" = current_setting('app.current_tenant_id', true)::uuid);
