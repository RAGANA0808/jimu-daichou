import 'server-only';
import type {
  GravePlot,
  GravePlotArea,
  GravePlotStatus,
  Household,
  Prisma,
} from '@prisma/client';
import { requireCurrentTenantId } from '@/lib/auth';
import { assertValidUuid, withTenant } from '@/lib/db';
import { GRAVE_PLOT_VACANT_STATUSES } from './types';

export type GravePlotWithRelations = GravePlot & {
  household: Pick<Household, 'id' | 'householderName'> | null;
  area: Pick<GravePlotArea, 'id' | 'name'> | null;
};

/**
 * 区画一覧。plotNumber 昇順。
 * 離檀した世帯の区画でも household が null になる場合あり (FK は維持)。
 * status 絞り込み (空き区画検索 G-7 等) も任意で受ける。
 */
export async function listGravePlots(options?: {
  areaId?: string | null;
  status?: GravePlotStatus | GravePlotStatus[];
}): Promise<GravePlotWithRelations[]> {
  const tenantId = await requireCurrentTenantId();
  const where: Prisma.GravePlotWhereInput = {};
  if (options && 'areaId' in options) {
    where.areaId = options.areaId ?? null;
  }
  if (options?.status !== undefined) {
    where.status = Array.isArray(options.status)
      ? { in: options.status }
      : options.status;
  }
  return withTenant(tenantId, (tx) =>
    tx.gravePlot.findMany({
      where,
      include: {
        household: { select: { id: true, householderName: true } },
        area: { select: { id: true, name: true } },
      },
      orderBy: { plotNumber: 'asc' },
    }),
  );
}

/**
 * 空き区画一覧 (G-7)。実質空き (GRAVE_PLOT_VACANT_STATUSES) のみを返す。
 */
export async function listAvailableGravePlots(options?: {
  areaId?: string | null;
}): Promise<GravePlotWithRelations[]> {
  return listGravePlots({
    ...(options && 'areaId' in options ? { areaId: options.areaId ?? null } : {}),
    status: GRAVE_PLOT_VACANT_STATUSES,
  });
}

/**
 * 指定世帯が契約中の区画一覧 (世帯詳細ページ用)。
 * 墓じまい済 (CLOSED) も含む (履歴参照)。
 */
export async function listGravePlotsByHousehold(
  householdId: string,
): Promise<GravePlotWithRelations[]> {
  assertValidUuid(householdId, 'householdId');
  const tenantId = await requireCurrentTenantId();
  return withTenant(tenantId, (tx) =>
    tx.gravePlot.findMany({
      where: { householdId },
      include: {
        household: { select: { id: true, householderName: true } },
        area: { select: { id: true, name: true } },
      },
      orderBy: { plotNumber: 'asc' },
    }),
  );
}

export type GravePlotStatusCounts = {
  available: number;
  inUse: number;
  reserved: number;
  closed: number;
  overdue: number;
  unclaimed: number;
  interredTogether: number;
  total: number;
};

/**
 * ダッシュボード用: 区画ステータスごとの件数を集計する。
 * 空き区画数 (status=AVAILABLE) を中心に「気づき」へつなぐ。
 */
export async function countGravePlotsByStatus(): Promise<GravePlotStatusCounts> {
  const tenantId = await requireCurrentTenantId();
  const grouped = await withTenant(tenantId, (tx) =>
    tx.gravePlot.groupBy({
      by: ['status'],
      _count: { _all: true },
    }),
  );

  const counts: GravePlotStatusCounts = {
    available: 0,
    inUse: 0,
    reserved: 0,
    closed: 0,
    overdue: 0,
    unclaimed: 0,
    interredTogether: 0,
    total: 0,
  };
  for (const g of grouped) {
    const n = g._count._all;
    counts.total += n;
    switch (g.status) {
      case 'AVAILABLE':
        counts.available = n;
        break;
      case 'IN_USE':
        counts.inUse = n;
        break;
      case 'RESERVED':
        counts.reserved = n;
        break;
      case 'CLOSED':
        counts.closed = n;
        break;
      case 'OVERDUE':
        counts.overdue = n;
        break;
      case 'UNCLAIMED':
        counts.unclaimed = n;
        break;
      case 'INTERRED_TOGETHER':
        counts.interredTogether = n;
        break;
    }
  }
  return counts;
}

export async function getGravePlotById(
  id: string,
): Promise<GravePlotWithRelations | null> {
  assertValidUuid(id, 'gravePlotId');
  const tenantId = await requireCurrentTenantId();
  return withTenant(tenantId, (tx) =>
    tx.gravePlot.findUnique({
      where: { id },
      include: {
        household: { select: { id: true, householderName: true } },
        area: { select: { id: true, name: true } },
      },
    }),
  );
}

export async function listHouseholdsForSelect(): Promise<
  Array<Pick<Household, 'id' | 'householderName' | 'nameKana'>>
> {
  const tenantId = await requireCurrentTenantId();
  // 区画 select でも離檀済 (isActive=false) は候補から除外。
  // 「離檀した世帯と新規に区画契約することはない」前提。
  // ただし編集ページで既存契約の世帯が離檀済の場合、ページ側で別途取得して補完する。
  return withTenant(tenantId, (tx) =>
    tx.household.findMany({
      where: { isActive: true },
      select: { id: true, householderName: true, nameKana: true },
      orderBy: { nameKana: 'asc' },
    }),
  );
}

/**
 * 編集画面用: 「既存契約の世帯が listHouseholdsForSelect に含まれない (離檀済)」場合の補完取得。
 * 1 件分の最小情報だけ select する。
 */
export async function getHouseholdMinimalById(
  householdId: string,
): Promise<Pick<Household, 'id' | 'householderName' | 'nameKana'> | null> {
  assertValidUuid(householdId, 'householdId');
  const tenantId = await requireCurrentTenantId();
  return withTenant(tenantId, (tx) =>
    tx.household.findUnique({
      where: { id: householdId },
      select: { id: true, householderName: true, nameKana: true },
    }),
  );
}
