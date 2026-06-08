-- PAPERLESS-MOBILE ウェーブ: D-1 書類クラウド保管 (Supabase Storage 参照) + N-8 寺行事。
-- Document は既存 RLS tenant_isolation (20260423022852) を流用するため列追加のみ・新規ポリシー不要。
-- TempleEvent は新規テーブルなので RLS tenant_isolation を新規付与する。
-- RLS / FK パターンは 20260607010000_add_grave_core / 20260607040000_add_memorial_expiry を踏襲する。

-- =========================================
-- D-1: Document に紐付け先・操作者・論理削除・updatedAt を追加
-- =========================================
-- updatedAt は既存行へ DEFAULT CURRENT_TIMESTAMP で後埋め (NOT NULL)。他は nullable。
ALTER TABLE "Document" ADD COLUMN "gravePlotId" UUID;
ALTER TABLE "Document" ADD COLUMN "transactionId" UUID;
ALTER TABLE "Document" ADD COLUMN "deathLedgerEntryId" UUID;
ALTER TABLE "Document" ADD COLUMN "uploadedById" UUID;
ALTER TABLE "Document" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "Document" ADD COLUMN "deletedBy" UUID;
ALTER TABLE "Document" ADD COLUMN "deletedReason" TEXT;
ALTER TABLE "Document" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex (新規紐付け列 + 一覧用)
CREATE INDEX "Document_gravePlotId_idx" ON "Document"("gravePlotId");
CREATE INDEX "Document_transactionId_idx" ON "Document"("transactionId");
CREATE INDEX "Document_deathLedgerEntryId_idx" ON "Document"("deathLedgerEntryId");
CREATE INDEX "Document_tenantId_createdAt_idx" ON "Document"("tenantId", "createdAt");

-- AddForeignKey: 親エンティティは SET NULL (親削除/論理削除後も書類記録は残す)。
ALTER TABLE "Document" ADD CONSTRAINT "Document_gravePlotId_fkey"
  FOREIGN KEY ("gravePlotId") REFERENCES "GravePlot"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Document" ADD CONSTRAINT "Document_transactionId_fkey"
  FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Document" ADD CONSTRAINT "Document_deathLedgerEntryId_fkey"
  FOREIGN KEY ("deathLedgerEntryId") REFERENCES "DeathLedgerEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Prisma スキーマ (@updatedAt は DB DEFAULT を持たない) と drift しないよう、後埋め用 DEFAULT を解除する。
-- 既存行は後埋め済みの値を保持し、以降は Prisma が更新時にセットする。
ALTER TABLE "Document" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- =========================================
-- N-8: TempleEvent (寺行事) 新規テーブル
-- =========================================
CREATE TABLE "TempleEvent" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3),
    "location" TEXT,
    "memo" TEXT,
    "assignedUserId" UUID,
    "googleCalendarEventId" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" UUID,
    "deletedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TempleEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TempleEvent_tenantId_idx" ON "TempleEvent"("tenantId");
CREATE INDEX "TempleEvent_tenantId_scheduledAt_idx" ON "TempleEvent"("tenantId", "scheduledAt");

-- AddForeignKey: テナントは RESTRICT (記録が孤立しないように)。
ALTER TABLE "TempleEvent" ADD CONSTRAINT "TempleEvent_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Row Level Security: テナント分離ポリシーを新規付与 (既存パターン踏襲)。
-- セッション変数 app.current_tenant_id は lib/db/with-tenant.ts で SET LOCAL される。
ALTER TABLE "TempleEvent" ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "TempleEvent"
  USING ("tenantId" = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK ("tenantId" = current_setting('app.current_tenant_id', true)::uuid);
