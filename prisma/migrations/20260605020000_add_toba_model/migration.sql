-- CreateTable
CREATE TABLE "Toba" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "memorialServiceId" UUID NOT NULL,
    "householdId" UUID,
    "applicantName" TEXT NOT NULL,
    "targetPersonId" UUID,
    "count" INTEGER NOT NULL DEFAULT 1,
    "inscription" TEXT NOT NULL,
    "readingOrder" INTEGER NOT NULL DEFAULT 0,
    "offeringAmount" INTEGER,
    "memo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Toba_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Toba_tenantId_idx" ON "Toba"("tenantId");

-- CreateIndex
CREATE INDEX "Toba_tenantId_memorialServiceId_readingOrder_idx" ON "Toba"("tenantId", "memorialServiceId", "readingOrder");

-- CreateIndex
CREATE INDEX "Toba_memorialServiceId_idx" ON "Toba"("memorialServiceId");

-- AddForeignKey
ALTER TABLE "Toba" ADD CONSTRAINT "Toba_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Toba" ADD CONSTRAINT "Toba_memorialServiceId_fkey" FOREIGN KEY ("memorialServiceId") REFERENCES "MemorialService"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Toba" ADD CONSTRAINT "Toba_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Toba" ADD CONSTRAINT "Toba_targetPersonId_fkey" FOREIGN KEY ("targetPersonId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Row Level Security: テナント分離ポリシーを適用する (既存 20260423022852_enable_rls のパターン踏襲)。
-- セッション変数 app.current_tenant_id は lib/db/with-tenant.ts で SET LOCAL される。
-- current_setting(..., true) の第 2 引数 true により、未設定時は NULL → UUID キャストで何もマッチしない。
ALTER TABLE "Toba" ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "Toba"
  USING ("tenantId" = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK ("tenantId" = current_setting('app.current_tenant_id', true)::uuid);
