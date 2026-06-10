import type { Prisma } from '@prisma/client';
import { prisma } from './client';
import { assertValidUuid } from './uuid';

/**
 * テナント境界を持つ Prisma クエリを実行するラッパ。
 *
 * - `tenantId` を UUID バリデートしてから `SET LOCAL app.current_tenant_id` を発行する。
 * - RLS ポリシー (20260423022852_enable_rls) が有効なので、この中でしかテナントのデータは見えない。
 * - `SET LOCAL` はトランザクション終了で自動解除されるため、コネクションプール返却時に影響を残さない。
 *
 * **Server Actions / Route Handlers 経由の全 DB アクセスは必ずこの関数でラップする。**
 */
export async function withTenant<T>(
  tenantId: string,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  assertValidUuid(tenantId, 'tenantId');

  return prisma.$transaction(async (tx) => {
    // UUID は事前検証済み (RFC 4122 形式以外は弾かれている) なので安全。
    // $executeRawUnsafe を使うのは、SET LOCAL のキー/値をテンプレートバインドできないため。
    await tx.$executeRawUnsafe(
      `SET LOCAL app.current_tenant_id = '${tenantId}'`,
    );
    return fn(tx);
  });
}

/**
 * 単一トランザクションへの集約用ヘルパ (問題A 接続プール枯渇の根治)。
 *
 * - `tx` が渡されればそれをそのまま使う (呼び出し元が既にテナント検証 + SET LOCAL 済みの
 *   トランザクションを開いている前提)。新しいコネクションを張らない。
 * - `tx` が無ければ従来どおり `resolveTenantId()` でテナントを解決してから `withTenant` で
 *   専用トランザクションを開く (= 単独呼び出しは完全に後方互換)。
 *
 * これにより各クエリ関数を「単独呼び出し (認可 + 専用 tx)」と「集約呼び出し (呼び出し元の
 * 1 tx に相乗り)」の両対応にできる。檀信徒カルテ詳細のように多数の世帯別クエリを引くページで、
 * コネクション占有を 1 本に抑える (Supabase pooler 上限 15 に対する同時アクセス耐性) ために使う。
 *
 * **重要 (認可の責務)**: `tx` 経路では `resolveTenantId` を呼ばない。`tx` を渡す呼び出し元が
 * 事前に認可を済ませていること (例: ページ側で `requireCapability('read')` を 1 回) が前提。
 * tenant-check は `'use server'` ファイルのみ検査するため、本パターンはテナント境界検査を壊さない。
 */
export async function withTenantOrTx<T>(
  tx: Prisma.TransactionClient | undefined,
  resolveTenantId: () => Promise<string>,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  if (tx) return fn(tx);
  const tenantId = await resolveTenantId();
  return withTenant(tenantId, fn);
}
