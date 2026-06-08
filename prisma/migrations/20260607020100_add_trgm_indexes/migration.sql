-- S-3 全文検索: pg_trgm + GIN(gin_trgm_ops) による ILIKE 部分一致の高速化。
-- 日本語横断検索は pgroonga/pg_bigm (Supabase で不確実) を避け、pg_trgm + ILIKE で担保する。
--
-- 冪等性に関する注記:
--   直前の 20260607020000_add_contact_succession で既に pg_trgm 拡張と
--   InteractionNote.content / Household.memo の GIN トリグラムインデックスを作成済み。
--   本マイグレーションはそれらを「CREATE ... IF NOT EXISTS」で再宣言して
--   再現性 (新規 DB 構築時に確実に存在すること) を高めつつ、
--   追加分として Household.nameKana のトリグラムインデックスを新設する。
--   既存環境では何も再作成されず安全な no-op となる。enum 等のトランザクション制約は無いので 1 ファイルで可。

-- Extension (既存環境では no-op)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 履歴本文・備考メモの全文検索 (再宣言: 既存なら no-op)
CREATE INDEX IF NOT EXISTS "InteractionNote_content_trgm_idx"
  ON "InteractionNote" USING GIN ("content" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Household_memo_trgm_idx"
  ON "Household" USING GIN ("memo" gin_trgm_ops);

-- 追加: かな氏名の中間一致 (nameKana ILIKE '%...%') を高速化する。
-- 既存の B-Tree @@index([tenantId, nameKana]) は前方一致しか効かないため、
-- 中間一致 (旧姓・名のみ等) を引く検索の暴走を防ぐためにトリグラム GIN を併設する。
CREATE INDEX IF NOT EXISTS "Household_nameKana_trgm_idx"
  ON "Household" USING GIN ("nameKana" gin_trgm_ops);
