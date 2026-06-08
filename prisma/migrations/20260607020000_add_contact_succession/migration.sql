-- CONTACT-SEARCH: 多階層連絡先 (ContactPoint) / 承継履歴 (HouseholdSuccession)
--                 + 全文検索 (pg_trgm) 用の GIN(gin_trgm_ops) インデックス
-- RLS テンプレは 20260605080000_add_household_tags / 20260605040000_add_maintenance_fee_models を踏襲。
-- gen_random_uuid() (pgcrypto) は Supabase 既定で有効。万一無効なら下記 CREATE EXTENSION で作成される。

-- Extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto; -- gen_random_uuid() の backfill 用
CREATE EXTENSION IF NOT EXISTS pg_trgm; -- ILIKE/部分一致を GIN で高速化

-- CreateEnum
CREATE TYPE "SuccessionReason" AS ENUM ('DEATH', 'RELOCATION', 'OTHER');

-- CreateEnum
CREATE TYPE "SuccessionStatus" AS ENUM ('PROPOSED', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "ContactPoint" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "householdId" UUID NOT NULL,
    "personId" UUID,
    "relationLabel" TEXT NOT NULL,
    "name" TEXT,
    "phone" TEXT,
    "mobile" TEXT,
    "email" TEXT,
    "postalCode" TEXT,
    "address" TEXT,
    "note" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContactPoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HouseholdSuccession" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "householdId" UUID NOT NULL,
    "previousHouseholderName" TEXT,
    "previousPersonId" UUID,
    "nextHouseholderName" TEXT,
    "nextPersonId" UUID,
    "reason" "SuccessionReason" NOT NULL DEFAULT 'DEATH',
    "occurredAt" DATE,
    "status" "SuccessionStatus" NOT NULL DEFAULT 'PROPOSED',
    "approvedById" UUID,
    "approvedAt" TIMESTAMP(3),
    "rejectedById" UUID,
    "rejectedAt" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HouseholdSuccession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContactPoint_tenantId_idx" ON "ContactPoint"("tenantId");
CREATE INDEX "ContactPoint_householdId_idx" ON "ContactPoint"("householdId");
CREATE INDEX "ContactPoint_householdId_sortOrder_idx" ON "ContactPoint"("householdId", "sortOrder");
CREATE INDEX "ContactPoint_personId_idx" ON "ContactPoint"("personId");

-- CreateIndex
CREATE INDEX "HouseholdSuccession_tenantId_idx" ON "HouseholdSuccession"("tenantId");
CREATE INDEX "HouseholdSuccession_householdId_occurredAt_idx" ON "HouseholdSuccession"("householdId", "occurredAt");
CREATE INDEX "HouseholdSuccession_tenantId_status_idx" ON "HouseholdSuccession"("tenantId", "status");

-- AddForeignKey (ContactPoint)
ALTER TABLE "ContactPoint" ADD CONSTRAINT "ContactPoint_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ContactPoint" ADD CONSTRAINT "ContactPoint_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContactPoint" ADD CONSTRAINT "ContactPoint_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey (HouseholdSuccession)
ALTER TABLE "HouseholdSuccession" ADD CONSTRAINT "HouseholdSuccession_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HouseholdSuccession" ADD CONSTRAINT "HouseholdSuccession_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HouseholdSuccession" ADD CONSTRAINT "HouseholdSuccession_previousPersonId_fkey" FOREIGN KEY ("previousPersonId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "HouseholdSuccession" ADD CONSTRAINT "HouseholdSuccession_nextPersonId_fkey" FOREIGN KEY ("nextPersonId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: 既存 Household.secondaryContact (非空) を ContactPoint 1 件へ移送する。
-- 自由記述 (例: "長男 一郎 (090-...)") は無加工で name に保持し、運用者が後から手で構造化する。
-- WHERE NOT EXISTS で冪等にし、手動再実行による二重作成を防ぐ。個人情報は SQL 内処理でログに出ない。
INSERT INTO "ContactPoint" (
    "id", "tenantId", "householdId", "relationLabel", "name",
    "sortOrder", "isPrimary", "createdAt", "updatedAt"
)
SELECT
    gen_random_uuid(),
    h."tenantId",
    h."id",
    '第2連絡先',
    btrim(h."secondaryContact"),
    0,
    false,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "Household" h
WHERE h."secondaryContact" IS NOT NULL
  AND btrim(h."secondaryContact") <> ''
  AND NOT EXISTS (
    SELECT 1 FROM "ContactPoint" cp
    WHERE cp."householdId" = h."id"
      AND cp."relationLabel" = '第2連絡先'
  );

-- 全文検索 (S-3) 用 GIN(gin_trgm_ops)。InteractionNote.content / Household.memo の ILIKE を高速化する。
-- pgroonga/pg_bigm は Supabase で不確実なため使わず、pg_trgm + ILIKE で日本語横断検索を担保する。
CREATE INDEX "InteractionNote_content_trgm_idx" ON "InteractionNote" USING GIN ("content" gin_trgm_ops);
CREATE INDEX "Household_memo_trgm_idx" ON "Household" USING GIN ("memo" gin_trgm_ops);

-- Row Level Security (tenant_isolation)。
-- セッション変数 app.current_tenant_id は lib/db/with-tenant.ts で SET LOCAL される。
-- current_setting(..., true) の第 2 引数 true により、未設定時は NULL → UUID キャストで何もマッチしない。
ALTER TABLE "ContactPoint" ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "ContactPoint"
  USING ("tenantId" = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK ("tenantId" = current_setting('app.current_tenant_id', true)::uuid);

ALTER TABLE "HouseholdSuccession" ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "HouseholdSuccession"
  USING ("tenantId" = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK ("tenantId" = current_setting('app.current_tenant_id', true)::uuid);
