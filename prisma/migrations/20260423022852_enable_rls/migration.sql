-- 全テーブルで Row Level Security を有効化し、tenant_id に基づくポリシーを適用する。
--
-- 設計方針 (docs/architecture/multi-tenancy.md):
-- - セッション変数 app.current_tenant_id をリクエスト毎に SET LOCAL で設定する (lib/db/with-tenant.ts)
-- - current_setting(..., true) の第 2 引数 true により、未設定時は NULL を返す → UUID キャストで何もマッチしない安全側挙動
-- - USING (読取) + WITH CHECK (書込) の両方を付ける
-- - Tenant 本体は id カラムを使ってフィルタ (他テーブルは tenantId)
-- - FORCE ROW LEVEL SECURITY は付けない: DB オーナー (マイグレーション実行者) まで制限されるとマイグレーション自体が通らなくなる

-- ========================================
-- Tenant: id カラムでフィルタ
-- ========================================
ALTER TABLE "Tenant" ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "Tenant"
  USING (id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (id = current_setting('app.current_tenant_id', true)::uuid);

-- ========================================
-- User
-- ========================================
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "User"
  USING ("tenantId" = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK ("tenantId" = current_setting('app.current_tenant_id', true)::uuid);

-- ========================================
-- Household
-- ========================================
ALTER TABLE "Household" ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "Household"
  USING ("tenantId" = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK ("tenantId" = current_setting('app.current_tenant_id', true)::uuid);

-- ========================================
-- Person
-- ========================================
ALTER TABLE "Person" ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "Person"
  USING ("tenantId" = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK ("tenantId" = current_setting('app.current_tenant_id', true)::uuid);

-- ========================================
-- DeathLedgerEntry (過去帳 — 論理削除のみ)
-- ========================================
ALTER TABLE "DeathLedgerEntry" ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "DeathLedgerEntry"
  USING ("tenantId" = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK ("tenantId" = current_setting('app.current_tenant_id', true)::uuid);

-- ========================================
-- MemorialService
-- ========================================
ALTER TABLE "MemorialService" ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "MemorialService"
  USING ("tenantId" = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK ("tenantId" = current_setting('app.current_tenant_id', true)::uuid);

-- ========================================
-- GravePlot
-- ========================================
ALTER TABLE "GravePlot" ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "GravePlot"
  USING ("tenantId" = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK ("tenantId" = current_setting('app.current_tenant_id', true)::uuid);

-- ========================================
-- Transaction
-- ========================================
ALTER TABLE "Transaction" ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "Transaction"
  USING ("tenantId" = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK ("tenantId" = current_setting('app.current_tenant_id', true)::uuid);

-- ========================================
-- InteractionNote
-- ========================================
ALTER TABLE "InteractionNote" ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "InteractionNote"
  USING ("tenantId" = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK ("tenantId" = current_setting('app.current_tenant_id', true)::uuid);

-- ========================================
-- Document
-- ========================================
ALTER TABLE "Document" ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "Document"
  USING ("tenantId" = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK ("tenantId" = current_setting('app.current_tenant_id', true)::uuid);
