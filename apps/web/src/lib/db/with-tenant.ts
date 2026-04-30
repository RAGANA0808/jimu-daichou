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
