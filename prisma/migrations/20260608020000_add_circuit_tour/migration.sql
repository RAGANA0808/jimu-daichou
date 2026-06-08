-- CIRCUIT-TOUR ウェーブ (T-4): 巡回 (棚経・月参り) の巡回計画 + 訪問先順序リスト。
-- 特許回避 (YMFG JP2022036640A): 地図経路・座標ルート・最適化は持たない。
-- RLS / FK / index パターンは 20260608010000_add_paperless_mobile を踏襲する。

-- =========================================
-- ENUM
-- =========================================
CREATE TYPE "CircuitTourType" AS ENUM ('TANAGYO', 'TSUKIMAIRI', 'OTHER');
CREATE TYPE "CircuitTourStatus" AS ENUM ('PLANNED', 'DONE', 'CANCELED');
CREATE TYPE "CircuitStopStatus" AS ENUM ('PENDING', 'VISITED', 'SKIPPED');

-- =========================================
-- CircuitTour (巡回計画)
-- =========================================
CREATE TABLE "CircuitTour" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "tourType" "CircuitTourType" NOT NULL DEFAULT 'TANAGYO',
    "scheduledDate" DATE NOT NULL,
    "assignedUserId" UUID,
    "status" "CircuitTourStatus" NOT NULL DEFAULT 'PLANNED',
    "memo" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" UUID,
    "deletedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CircuitTour_pkey" PRIMARY KEY ("id")
);

-- =========================================
-- CircuitStop (巡回訪問先・順序リスト)
-- =========================================
CREATE TABLE "CircuitStop" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "circuitTourId" UUID NOT NULL,
    "householdId" UUID,
    "gravePlotId" UUID,
    "visitLabel" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" "CircuitStopStatus" NOT NULL DEFAULT 'PENDING',
    "memo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CircuitStop_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CircuitTour_tenantId_idx" ON "CircuitTour"("tenantId");
CREATE INDEX "CircuitTour_tenantId_scheduledDate_idx" ON "CircuitTour"("tenantId", "scheduledDate");
CREATE INDEX "CircuitStop_tenantId_idx" ON "CircuitStop"("tenantId");
CREATE INDEX "CircuitStop_circuitTourId_sortOrder_idx" ON "CircuitStop"("circuitTourId", "sortOrder");
CREATE INDEX "CircuitStop_householdId_idx" ON "CircuitStop"("householdId");
CREATE INDEX "CircuitStop_gravePlotId_idx" ON "CircuitStop"("gravePlotId");

-- AddForeignKey: テナントは RESTRICT (記録が孤立しないように)。
ALTER TABLE "CircuitTour" ADD CONSTRAINT "CircuitTour_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 親巡回削除で訪問先も連鎖削除 (CASCADE)。世帯/区画は SET NULL (訪問先記録は残す)。
ALTER TABLE "CircuitStop" ADD CONSTRAINT "CircuitStop_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CircuitStop" ADD CONSTRAINT "CircuitStop_circuitTourId_fkey"
  FOREIGN KEY ("circuitTourId") REFERENCES "CircuitTour"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CircuitStop" ADD CONSTRAINT "CircuitStop_householdId_fkey"
  FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CircuitStop" ADD CONSTRAINT "CircuitStop_gravePlotId_fkey"
  FOREIGN KEY ("gravePlotId") REFERENCES "GravePlot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Row Level Security: テナント分離ポリシーを新規付与 (既存パターン踏襲)。
-- セッション変数 app.current_tenant_id は lib/db/with-tenant.ts で SET LOCAL される。
ALTER TABLE "CircuitTour" ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "CircuitTour"
  USING ("tenantId" = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK ("tenantId" = current_setting('app.current_tenant_id', true)::uuid);

ALTER TABLE "CircuitStop" ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "CircuitStop"
  USING ("tenantId" = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK ("tenantId" = current_setting('app.current_tenant_id', true)::uuid);
