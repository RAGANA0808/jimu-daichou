import 'server-only';
import type { HouseholdSuccession, Prisma, SuccessionReason } from '@prisma/client';
import { requireCurrentTenantId } from '@/lib/auth';
import { assertValidUuid, withTenant, withTenantOrTx } from '@/lib/db';

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
  tx?: Prisma.TransactionClient,
): Promise<SuccessionWithPersons[]> {
  assertValidUuid(householdId, 'householdId');
  return withTenantOrTx(tx, requireCurrentTenantId, (t) =>
    t.householdSuccession.findMany({
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

/** ダッシュボードの「承継の承認待ち」気づき 1 件分。 */
export type PendingSuccession = {
  id: string;
  householdId: string;
  householderName: string;
  previousHouseholderName: string | null;
  nextHouseholderName: string | null;
  reason: SuccessionReason;
  /** 交代発生日 (死亡日等)。@db.Date のため UTC 0:00。月日不明は null。 */
  occurredAt: Date | null;
};

/**
 * テナント内の未承認の承継候補 (status=PROPOSED) を横断取得する。
 * ダッシュボードの気づき用 (各行はカルテの承継承認へ遷移)。
 *
 * 並びは occurredAt (交代発生日=死亡日等) の降順固定。**updatedAt 等の「更新順」では
 * 並べない** (せいざん JP7282407 の更新順ポータル回避線を維持)。
 */
export async function listPendingSuccessions(
  limit = 50,
): Promise<PendingSuccession[]> {
  const tenantId = await requireCurrentTenantId();
  const rows = await withTenant(tenantId, (tx) =>
    tx.householdSuccession.findMany({
      where: { status: 'PROPOSED' },
      include: { household: { select: { id: true, householderName: true } } },
      orderBy: [
        { occurredAt: { sort: 'desc', nulls: 'last' } },
        { createdAt: 'desc' },
      ],
      take: limit,
    }),
  );
  return rows.map((s) => ({
    id: s.id,
    householdId: s.householdId,
    householderName: s.household.householderName,
    previousHouseholderName: s.previousHouseholderName,
    nextHouseholderName: s.nextHouseholderName,
    reason: s.reason,
    occurredAt: s.occurredAt,
  }));
}
