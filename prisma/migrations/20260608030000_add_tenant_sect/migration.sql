-- TENANT-SECT (O-2/O-3): テナントに宗派カラムを追加する。
-- 年忌の既定弔い上げ (defaultCutoff) の「目安」に使う表示用カラム。
-- 単一テナント自身 (Tenant) のカラムのため RLS / index 変更は不要。
-- ENUM 書式は 20260608020000_add_circuit_tour を踏襲する。

-- =========================================
-- ENUM
-- =========================================
CREATE TYPE "Sect" AS ENUM (
  'SOTO',
  'RINZAI',
  'OBAKU',
  'TENDAI',
  'SHINGON',
  'JODO',
  'JODO_SHINSHU_HONGANJI',
  'SHINSHU_OTANI',
  'NICHIREN',
  'JISHU',
  'OTHER'
);

-- =========================================
-- Tenant.sect カラム追加 (nullable・既定 NULL=標準スケジュール)
-- =========================================
ALTER TABLE "Tenant" ADD COLUMN "sect" "Sect";
