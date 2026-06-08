-- CreateEnum
CREATE TYPE "DateOfDeathPrecision" AS ENUM ('FULL', 'YEAR_MONTH', 'YEAR', 'UNKNOWN');

-- AlterTable
ALTER TABLE "DeathLedgerEntry" ADD COLUMN     "datePrecision" "DateOfDeathPrecision" NOT NULL DEFAULT 'FULL',
ADD COLUMN     "deathDay" INTEGER,
ADD COLUMN     "deathMonth" INTEGER,
ADD COLUMN     "deathYear" INTEGER,
ADD COLUMN     "deletedBy" UUID,
ADD COLUMN     "deletedReason" TEXT,
ALTER COLUMN "dateOfDeath" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "DeathLedgerEntry_tenantId_deathYear_deathMonth_deathDay_idx" ON "DeathLedgerEntry"("tenantId", "deathYear", "deathMonth", "deathDay");

-- Backfill: 既存行は dateOfDeath (DATE) を真のソースとして構造化フィールドへ展開する。
-- 既存データはすべて完全な年月日なので datePrecision は FULL のまま。後方互換を保つ。
UPDATE "DeathLedgerEntry"
SET "deathYear"  = EXTRACT(YEAR  FROM "dateOfDeath")::int,
    "deathMonth" = EXTRACT(MONTH FROM "dateOfDeath")::int,
    "deathDay"   = EXTRACT(DAY   FROM "dateOfDeath")::int
WHERE "dateOfDeath" IS NOT NULL
  AND "deathYear" IS NULL;
