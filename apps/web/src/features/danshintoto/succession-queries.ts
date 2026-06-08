import 'server-only';
import type { HouseholdSuccession } from '@prisma/client';
import { requireCurrentTenantId } from '@/lib/auth';
import { assertValidUuid, withTenant } from '@/lib/db';

export type SuccessionWithPersons = HouseholdSuccession & {
  previousPerson: { id: string; name: string } | null;
  nextPerson: { id: string; name: string } | null;
};

/**
 * 指定世帯の承継履歴を取得する。
 * 並びは occurredAt 降順固定 (発生日不明=null は末尾)。createdAt 降順を補助キーにする。
 * 「更新順自動再配列」(特許回避線) はしない=承継起票を契機に並びを動かさない。
 */
export async function listSuccessionsByHousehold(
  householdId: string,
): Promise<SuccessionWithPersons[]> {
  assertValidUuid(householdId, 'householdId');
  const tenantId = await requireCurrentTenantId();

  return withTenant(tenantId, (tx) =>
    tx.householdSuccession.findMany({
      where: { householdId },
      include: {
        previousPerson: { select: { id: true, name: true } },
        nextPerson: { select: { id: true, name: true } },
      },
      orderBy: [
        { occurredAt: { sort: 'desc', nulls: 'last' } },
        { createdAt: 'desc' },
      ],
    }),
  );
}

/**
 * テナント内の未承認の承継候補 (status=PROPOSED) の件数。
 * ダッシュボードの気づきカード用 (件数バッジに留め、更新順の行リストにはしない)。
 */
export async function countPendingSuccessions(): Promise<number> {
  const tenantId = await requireCurrentTenantId();
  return withTenant(tenantId, (tx) =>
    tx.householdSuccession.count({ where: { status: 'PROPOSED' } }),
  );
}
