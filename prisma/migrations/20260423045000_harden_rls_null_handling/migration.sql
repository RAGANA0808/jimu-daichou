-- 全テーブルの RLS ポリシーを NULLIF ラップに置き換える。
--
-- 背景:
--   PostgreSQL のカスタム GUC (app.current_tenant_id 等) は、
--   - 未設定: current_setting(..., true) が NULL を返す
--   - 同セッション内で一度でも SET LOCAL した後の別 Tx: 空文字列 "" を返すことがある
--   後者の場合、"" ::uuid は 22P02 (invalid input syntax) でエラーになり、
--   「withTenant() 呼び忘れ時に 0 行返る (安全側)」という期待挙動が破綻する。
--   NULLIF(x, '') で空文字を NULL に畳んでから uuid キャストすることで、
--   両ケースで「tenantId = NULL → 常に false → 0 行」の決定論的挙動を保証する。

-- Tenant
DROP POLICY IF EXISTS tenant_isolation ON "Tenant";
CREATE POLICY tenant_isolation ON "Tenant"
  USING (id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
  WITH CHECK (id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

-- User
DROP POLICY IF EXISTS tenant_isolation ON "User";
CREATE POLICY tenant_isolation ON "User"
  USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
  WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

-- Household
DROP POLICY IF EXISTS tenant_isolation ON "Household";
CREATE POLICY tenant_isolation ON "Household"
  USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
  WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

-- Person
DROP POLICY IF EXISTS tenant_isolation ON "Person";
CREATE POLICY tenant_isolation ON "Person"
  USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
  WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

-- DeathLedgerEntry
DROP POLICY IF EXISTS tenant_isolation ON "DeathLedgerEntry";
CREATE POLICY tenant_isolation ON "DeathLedgerEntry"
  USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
  WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

-- MemorialService
DROP POLICY IF EXISTS tenant_isolation ON "MemorialService";
CREATE POLICY tenant_isolation ON "MemorialService"
  USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
  WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

-- GravePlot
DROP POLICY IF EXISTS tenant_isolation ON "GravePlot";
CREATE POLICY tenant_isolation ON "GravePlot"
  USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
  WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

-- Transaction
DROP POLICY IF EXISTS tenant_isolation ON "Transaction";
CREATE POLICY tenant_isolation ON "Transaction"
  USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
  WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

-- InteractionNote
DROP POLICY IF EXISTS tenant_isolation ON "InteractionNote";
CREATE POLICY tenant_isolation ON "InteractionNote"
  USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
  WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

-- Document
DROP POLICY IF EXISTS tenant_isolation ON "Document";
CREATE POLICY tenant_isolation ON "Document"
  USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
  WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
