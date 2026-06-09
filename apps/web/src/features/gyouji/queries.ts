import 'server-only';
import type { TempleEvent } from '@prisma/client';
import { requireCurrentTenantId } from '@/lib/auth';
import { assertValidUuid, withTenant } from '@/lib/db';

export type TempleEventRow = TempleEvent;

function startOfTodayJst(): Date {
  const now = new Date();
  // Asia/Tokyo は UTC+9 固定なのでローカル時刻 0:00 をそのまま使ってよい
  // (CLAUDE.md §4.3 TZ=Asia/Tokyo 固定, .env にも設定済み)。
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/**
 * 寺行事の一覧。
 * - scope='upcoming' (既定): 今日以降 (scheduledAt 昇順, 上限 100)。
 * - scope='all': 過去含む全件 (scheduledAt 降順, 上限 200)。
 * いずれも論理削除 (deletedAt) は除外する。
 */
export async function listTempleEvents(opts?: {
  scope?: 'upcoming' | 'all';
}): Promise<TempleEventRow[]> {
  const scope = opts?.scope ?? 'upcoming';
  const tenantId = await requireCurrentTenantId();
  return withTenant(tenantId, (tx) =>
    scope === 'all'
      ? tx.templeEvent.findMany({
          where: { deletedAt: null },
          orderBy: { scheduledAt: 'desc' },
          take: 200,
        })
      : tx.templeEvent.findMany({
          where: { deletedAt: null, scheduledAt: { gte: startOfTodayJst() } },
          orderBy: { scheduledAt: 'asc' },
          take: 100,
        }),
  );
}

/**
 * 単一の寺行事を取得。論理削除済み (deletedAt!==null) は null を返す。
 * 他テナントの id は RLS で非表示。
 */
export async function getTempleEventById(
  id: string,
): Promise<TempleEventRow | null> {
  assertValidUuid(id, 'templeEventId');
  const tenantId = await requireCurrentTenantId();
  const event = await withTenant(tenantId, (tx) =>
    tx.templeEvent.findUnique({ where: { id } }),
  );
  if (!event || event.deletedAt !== null) return null;
  return event;
}
