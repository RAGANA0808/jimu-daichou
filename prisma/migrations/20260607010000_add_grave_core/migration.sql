-- GRAVE-CORE: 納骨 (Burial) / 区画契約 (GraveContract) / 墓標名・刻名列
-- enum GravePlotStatus への値追加は別マイグレーション (20260607010100_extend_grave_plot_status) に分離する。
-- PostgreSQL は ALTER TYPE ... ADD VALUE を実行したトランザクション内で新値を即時利用できないため。

-- CreateEnum
CREATE TYPE "GraveContractType" AS ENUM ('ETERNAL_MEMORIAL', 'STANDARD', 'TEMPORARY', 'OTHER');

-- CreateEnum
CREATE TYPE "GraveContractStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'TERMINATED');

-- AlterTable (GravePlot に 墓標名・刻名)
ALTER TABLE "GravePlot" ADD COLUMN "monumentName" TEXT;
ALTER TABLE "GravePlot" ADD COLUMN "inscription" TEXT;

-- CreateTable
CREATE TABLE "Burial" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "gravePlotId" UUID NOT NULL,
    "personId" UUID NOT NULL,
    "interredAt" DATE,
    "removedAt" DATE,
    "memo" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" UUID,
    "deletedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Burial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GraveContract" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "gravePlotId" UUID NOT NULL,
    "householdId" UUID,
    "contractType" "GraveContractType" NOT NULL DEFAULT 'STANDARD',
    "startDate" DATE,
    "termYears" INTEGER,
    "expiryDate" DATE,
    "status" "GraveContractStatus" NOT NULL DEFAULT 'ACTIVE',
    "feeAmount" INTEGER,
    "memo" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GraveContract_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Burial_tenantId_idx" ON "Burial"("tenantId");

-- CreateIndex
CREATE INDEX "Burial_gravePlotId_idx" ON "Burial"("gravePlotId");

-- CreateIndex
CREATE INDEX "Burial_personId_idx" ON "Burial"("personId");

-- CreateIndex
CREATE INDEX "GraveContract_tenantId_idx" ON "GraveContract"("tenantId");

-- CreateIndex
CREATE INDEX "GraveContract_gravePlotId_idx" ON "GraveContract"("gravePlotId");

-- CreateIndex
CREATE INDEX "GraveContract_householdId_idx" ON "GraveContract"("householdId");

-- CreateIndex
CREATE INDEX "GraveContract_tenantId_expiryDate_idx" ON "GraveContract"("tenantId", "expiryDate");

-- AddForeignKey (Burial: 全て RESTRICT。歴史記録は親を消させない)
ALTER TABLE "Burial" ADD CONSTRAINT "Burial_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Burial" ADD CONSTRAINT "Burial_gravePlotId_fkey" FOREIGN KEY ("gravePlotId") REFERENCES "GravePlot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Burial" ADD CONSTRAINT "Burial_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey (GraveContract)
ALTER TABLE "GraveContract" ADD CONSTRAINT "GraveContract_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GraveContract" ADD CONSTRAINT "GraveContract_gravePlotId_fkey" FOREIGN KEY ("gravePlotId") REFERENCES "GravePlot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GraveContract" ADD CONSTRAINT "GraveContract_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Row Level Security: テナント分離ポリシーを適用する (既存 20260605040000_add_maintenance_fee_models のパターン踏襲)。
-- セッション変数 app.current_tenant_id は lib/db/with-tenant.ts で SET LOCAL される。
-- current_setting(..., true) の第 2 引数 true により、未設定時は NULL → UUID キャストで何もマッチしない。
ALTER TABLE "Burial" ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "Burial"
  USING ("tenantId" = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK ("tenantId" = current_setting('app.current_tenant_id', true)::uuid);

ALTER TABLE "GraveContract" ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "GraveContract"
  USING ("tenantId" = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK ("tenantId" = current_setting('app.current_tenant_id', true)::uuid);
