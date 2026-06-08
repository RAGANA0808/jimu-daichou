import { PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

/**
 * 開発時のみ、Prisma 自身のコネクションプール上限を絞る。
 *
 * withTenant は対話トランザクション (`$transaction`) を使い、1 トランザクションが
 * 1 コネクションを占有する。詳細ページ等で複数クエリを Promise.all 並列実行すると
 * その分だけ同時コネクションを掴むため、Supabase のセッションモード pooler 上限
 * (pool_size: 15) を超えて `EMAXCONNSESSION` になりうる。Prisma 側の connection_limit を
 * 上限未満に固定し、超過分はプール内で待たせる (枯渇させない)。
 *
 * 本番 (サーバーレス) では各インスタンスが少数コネクションで動くべきなので上書きしない。
 * 恒久対策は DATABASE_URL を Supabase の transaction モード pooler (port 6543) に切替えること。
 */
function developmentDbUrl(): string | undefined {
  if (process.env.NODE_ENV === 'production') return undefined;
  const url = process.env.DATABASE_URL;
  if (!url || url.includes('connection_limit=')) return undefined;
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}connection_limit=10&pool_timeout=20`;
}

const overrideUrl = developmentDbUrl();

export const prisma: PrismaClient =
  globalThis.__prisma ??
  new PrismaClient({
    ...(overrideUrl ? { datasources: { db: { url: overrideUrl } } } : {}),
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalThis.__prisma = prisma;
}
