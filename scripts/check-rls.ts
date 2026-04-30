// public スキーマのテーブルの RLS 状態を確認するワンショット診断スクリプト。
// Supabase の "Table publicly accessible" 警告がどのテーブルに対するものかを特定する。
//
// 実行: pnpm tsx scripts/check-rls.ts

import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";

config();

const prisma = new PrismaClient();

type Row = {
  schemaname: string;
  tablename: string;
  rowsecurity: boolean;
  forcerowsecurity: boolean;
};

async function main() {
  const rows = await prisma.$queryRawUnsafe<Row[]>(`
    SELECT
      n.nspname AS schemaname,
      c.relname AS tablename,
      c.relrowsecurity AS rowsecurity,
      c.relforcerowsecurity AS forcerowsecurity
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'r'
      AND n.nspname = 'public'
    ORDER BY c.relname;
  `);

  console.log("=== public スキーマのテーブル RLS 状態 ===\n");
  for (const r of rows) {
    const flag = r.rowsecurity ? "[OK]" : "[NG]";
    console.log(`${flag}  ${r.tablename}  (rls=${r.rowsecurity}, force=${r.forcerowsecurity})`);
  }

  const noRls = rows.filter((r) => !r.rowsecurity);
  console.log(`\n→ RLS 未有効: ${noRls.length} 件`);
  if (noRls.length > 0) {
    console.log("  対象:");
    for (const r of noRls) console.log(`  - ${r.tablename}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
