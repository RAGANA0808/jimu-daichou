import 'server-only';
import type { ContactPoint } from '@prisma/client';
import { requireCurrentTenantId } from '@/lib/auth';
import { assertValidUuid, withTenant } from '@/lib/db';

/**
 * 指定世帯の連絡先 (ContactPoint) を表示順で取得する。
 * 論理削除 (deletedAt) されたものは除外する。
 * 並び: sortOrder 昇順 → createdAt 昇順 (担当者の手動並べ替えを尊重)。
 * 「更新順自動再配列」(特許回避線) はしない。
 */
export async function listContactPointsByHousehold(
  householdId: string,
): Promise<ContactPoint[]> {
  assertValidUuid(householdId, 'householdId');
  const tenantId = await requireCurrentTenantId();

  return withTenant(tenantId, (tx) =>
    tx.contactPoint.findMany({
      where: { householdId, deletedAt: null },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    }),
  );
}
