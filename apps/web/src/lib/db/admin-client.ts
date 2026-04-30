import { PrismaClient } from '@prisma/client';

/**
 * 管理権限 (postgres ロール) で **RLS を bypass する** Prisma クライアント。
 *
 * 通常のアプリケーション経路ではこのクライアントを使わない。
 * `prisma` (jimu_app, NOBYPASSRLS) + `withTenant()` を必ず使うこと。
 *
 * **使用してよいのは以下の narrow なケースのみ**:
 * - 認証ブートストラップ: Supabase session → 自前 User 行の解決
 *   （tenantId 解決前なので、仕組み上 withTenant で縛れない）
 * - シードスクリプト / マイグレーション補助
 * - 統合テストの setup / teardown
 *
 * DIRECT_URL に接続する (postgres ロール)。BYPASSRLS 属性を持つため、
 * このクライアント経由では RLS ポリシーは適用されない点に注意。
 */
declare global {
  // eslint-disable-next-line no-var
  var __adminPrisma: PrismaClient | undefined;
}

export const adminPrisma: PrismaClient =
  globalThis.__adminPrisma ??
  new PrismaClient({
    datasources: { db: { url: process.env.DIRECT_URL } },
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalThis.__adminPrisma = adminPrisma;
}
