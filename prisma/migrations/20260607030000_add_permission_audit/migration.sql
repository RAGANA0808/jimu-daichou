-- PERMISSION ウェーブ: 監査ログ AuditLog + User.isActive 追加。
-- 既存 20260605040000_add_maintenance_fee_models / 20260423022852_enable_rls の RLS パターンを踏襲する。

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'EXPORT', 'APPROVE', 'CONNECT', 'DISCONNECT', 'ROLE_CHANGE', 'OTHER');

-- AlterTable: 役割管理の有効/無効化・将来のログイン拒否のため User に isActive を追加。
-- 既定 true なので既存ユーザー (現在ログイン中の HEAD_PRIEST 含む) は全員有効のまま (締め出し回避)。
ALTER TABLE "User" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "actorId" UUID,
    "action" "AuditAction" NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "summary" VARCHAR(200) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditLog_tenantId_idx" ON "AuditLog"("tenantId");

-- CreateIndex
CREATE INDEX "AuditLog_tenantId_createdAt_idx" ON "AuditLog"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_tenantId_entityType_entityId_idx" ON "AuditLog"("tenantId", "entityType", "entityId");

-- AddForeignKey: テナントは RESTRICT (証跡が孤立しないように)。
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: 操作者は SET NULL (ユーザー消失後も証跡を残す)。
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Row Level Security: テナント分離ポリシーを適用する (既存パターン踏襲)。
-- セッション変数 app.current_tenant_id は lib/db/with-tenant.ts で SET LOCAL される。
-- NULLIF(..., '') ラップで未設定/空文字を NULL に畳み、未設定時は 0 行 (安全側) を保証する。
ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "AuditLog"
  USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
  WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
