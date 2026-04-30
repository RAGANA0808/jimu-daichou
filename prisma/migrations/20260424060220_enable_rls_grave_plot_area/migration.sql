-- GravePlotArea に Row Level Security を有効化し、tenantId ベースのポリシーを適用する。
-- 既存の 20260423022852_enable_rls のパターンを踏襲。
--
-- セッション変数 app.current_tenant_id は lib/db/with-tenant.ts で SET LOCAL される。
-- current_setting(..., true) の第 2 引数 true により、未設定時は NULL → UUID キャストで何もマッチしない。

ALTER TABLE "GravePlotArea" ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "GravePlotArea"
  USING ("tenantId" = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK ("tenantId" = current_setting('app.current_tenant_id', true)::uuid);
