-- Prisma がマイグレーション履歴管理用に自動生成する _prisma_migrations テーブルへ
-- Row Level Security を有効化する。
--
-- 背景:
--   Supabase Advisor が "Table publicly accessible (rls_disabled_in_public)" を検知。
--   public スキーマに置かれている _prisma_migrations は anon/authenticated ロールから
--   素通しで読み書きできる状態だった。マイグレーション履歴の改ざん経路になりうるため塞ぐ。
--
-- 方針:
--   - ENABLE ROW LEVEL SECURITY のみ実施し、ポリシーは作成しない
--     (= テーブルオーナー以外は全アクセス拒否)
--   - FORCE ROW LEVEL SECURITY は付けない
--     (= マイグレーション実行ユーザーである postgres は従来通りバイパスできる)
--   - 既存の RLS マイグレーション (20260423022852_enable_rls) と同じ慣習に揃える

ALTER TABLE IF EXISTS "_prisma_migrations" ENABLE ROW LEVEL SECURITY;
