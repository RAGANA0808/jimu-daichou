-- 寺務台帳: アプリ専用 DB ロール "jimu_app" の作成と権限付与。
--
-- 背景:
--   Supabase のデフォルト "postgres" ロールは BYPASSRLS 属性を持つため、
--   Server Actions がこのロールで接続している限り RLS が素通りされる
--   (統合テスト `with-tenant.integration.test.ts` で検出済み)。
--
-- 目的:
--   NOBYPASSRLS なアプリ専用ロールを作成し、DATABASE_URL をそちらに切り替える。
--   これにより "withTenant() を呼び忘れた" 場合でも、RLS が最終防衛線として
--   機能する (= 他テナントのデータは空配列が返る)。
--
-- 実行手順:
--   1. 下記 <REPLACE_WITH_STRONG_PASSWORD> を強力なパスワードに置換
--      (例: 1Password 等で 32 文字以上のランダム文字列を生成)
--   2. Supabase Dashboard → SQL Editor で postgres ロールとして実行
--   3. リポジトリルートの .env の DATABASE_URL を新ロール経由に変更
--      (DIRECT_URL は postgres のまま維持 — マイグレーション実行に必要)
--   4. pnpm --filter @jimu-daichou/web test:integration で 5/5 緑を確認

-- 1. ロール作成 (既存ならスキップ)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'jimu_app') THEN
    CREATE ROLE jimu_app WITH
      LOGIN
      NOBYPASSRLS
      NOSUPERUSER
      NOCREATEDB
      NOCREATEROLE
      NOREPLICATION
      PASSWORD '<REPLACE_WITH_STRONG_PASSWORD>';
  END IF;
END
$$;

-- 2. public スキーマ使用権限
GRANT USAGE ON SCHEMA public TO jimu_app;

-- 3. 既存テーブルへの CRUD 権限
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO jimu_app;

-- 4. 既存シーケンスへの権限 (現状は UUID 主キーのみで未使用だが将来の保険)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO jimu_app;

-- 5. 今後 postgres が作成するテーブル/シーケンスにも自動付与
--    (Prisma マイグレーションは DIRECT_URL = postgres で実行されるため、
--     新テーブル追加時に毎回 GRANT を書き足す必要がなくなる)
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO jimu_app;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO jimu_app;

-- -----------------------------------------------------------
-- ロールバック (元に戻す場合のみ、以下のコメントアウトを外して実行)
-- -----------------------------------------------------------
-- ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM jimu_app;
-- ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM jimu_app;
-- REVOKE ALL ON ALL TABLES IN SCHEMA public FROM jimu_app;
-- REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM jimu_app;
-- REVOKE USAGE ON SCHEMA public FROM jimu_app;
-- DROP ROLE jimu_app;
