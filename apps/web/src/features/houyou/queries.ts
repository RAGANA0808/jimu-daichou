import 'server-only';
import type { Household, MemorialService, Prisma } from '@prisma/client';
import { requireCurrentTenantId } from '@/lib/auth';
import { assertValidUuid, withTenant, withTenantOrTx } from '@/lib/db';

export type MemorialServiceWithHousehold = MemorialService & {
  household: Pick<Household, 'id' | 'householderName' | 'nameKana'>;
};

function startOfTodayJst(): Date {
  const now = new Date();
  // Asia/Tokyo は UTC+9 固定なのでローカル時刻 0:00 をそのまま使ってよい
  // (CLAUDE.md §4.3 TZ=Asia/Tokyo 固定, .env にも設定済み)
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/**
 * 今日以降の法要を scheduledAt 昇順で取得 (全世帯横断)。
 * CANCELED も表示する (履歴追跡のため) が、過去の法要は除外する。
 * Phase 1 は 100 件上限。
 */
export async function listUpcomingMemorialServices(): Promise<
  MemorialServiceWithHousehold[]
> {
  const tenantId = await requireCurrentTenantId();
  return withTenant(tenantId, (tx) =>
    tx.memorialService.findMany({
      where: { scheduledAt: { gte: startOfTodayJst() } },
      include: {
        household: {
          select: { id: true, householderName: true, nameKana: true },
        },
      },
      orderBy: { scheduledAt: 'asc' },
      take: 100,
    }),
  );
}

/**
 * 指定世帯の法要一覧 (過去も含む)。世帯詳細ページの法要セクションで使う。
 * CANCELED も含めて全件返す (世帯ごとに件数は多くない想定)。
 */
export async function listMemorialServicesByHousehold(
  householdId: string,
  tx?: Prisma.TransactionClient,
): Promise<MemorialServiceWithHousehold[]> {
  assertValidUuid(householdId, 'householdId');
  return withTenantOrTx(tx, requireCurrentTenantId, (t) =>
    t.memorialService.findMany({
      where: { householdId },
      include: {
        household: {
          select: { id: true, householderName: true, nameKana: true },
        },
      },
      orderBy: { scheduledAt: 'asc' },
    }),
  );
}

/**
 * 単一の法要を取得。他テナントの id は RLS で非表示。
 */
export async function getMemorialServiceById(
  id: string,
): Promise<MemorialServiceWithHousehold | null> {
  assertValidUuid(id, 'memorialServiceId');
  const tenantId = await requireCurrentTenantId();
  return withTenant(tenantId, (tx) =>
    tx.memorialService.findUnique({
      where: { id },
      include: {
        household: {
          select: { id: true, householderName: true, nameKana: true },
        },
      },
    }),
  );
}
