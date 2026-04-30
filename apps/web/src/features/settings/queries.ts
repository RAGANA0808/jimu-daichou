import 'server-only';
import type { Tenant } from '@prisma/client';
import { requireCurrentTenantId } from '@/lib/auth';
import { withTenant } from '@/lib/db';

/**
 * ログイン中ユーザーが属するテナント (寺院) の情報を取得。
 * RLS ポリシー `tenant_isolation` により、`withTenant` 内では自テナントの行のみ読める。
 */
export async function getCurrentTenant(): Promise<Tenant | null> {
  const tenantId = await requireCurrentTenantId();
  return withTenant(tenantId, (tx) =>
    tx.tenant.findUnique({ where: { id: tenantId } }),
  );
}
