import 'server-only';
import type { Household, Prisma } from '@prisma/client';
import { requireCurrentTenantId } from '@/lib/auth';
import { assertValidUuid, withTenant, withTenantOrTx } from '@/lib/db';

/**
 * 自テナントの世帯一覧を取得する。
 * 並びは nameKana 昇順 (検索用かな表記) → 施主名の順。
 * 離檀 (isActive=false) は除外する。Phase 1 では 100 件まで (ページング未実装)。
 */
export async function listHouseholds(): Promise<Household[]> {
  const tenantId = await requireCurrentTenantId();
  return withTenant(tenantId, (tx) =>
    tx.household.findMany({
      where: { isActive: true },
      orderBy: [{ nameKana: 'asc' }, { householderName: 'asc' }],
      take: 100,
    }),
  );
}

/**
 * 世帯を id で取得。他テナントの id を渡しても RLS で null が返るため安全。
 * UUID 形式チェックは assertValidUuid に委譲する (SQL インジェクション対策)。
 */
export async function getHouseholdById(
  id: string,
  tx?: Prisma.TransactionClient,
): Promise<Household | null> {
  assertValidUuid(id, 'householdId');
  return withTenantOrTx(tx, requireCurrentTenantId, (t) =>
    t.household.findUnique({ where: { id } }),
  );
}
