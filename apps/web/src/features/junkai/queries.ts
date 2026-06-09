import 'server-only';
import type {
  CircuitStop,
  CircuitTour,
  GravePlot,
  Household,
} from '@prisma/client';
import { requireCurrentTenantId } from '@/lib/auth';
import { assertValidUuid, withTenant } from '@/lib/db';
import { listHouseholds } from '@/features/danshintoto/queries';
import { listGravePlots } from '@/features/kukaku/queries';

/** 一覧行: 巡回本体 + 訪問先件数 (_count)。 */
export type CircuitTourListRow = CircuitTour & {
  _count: { stops: number };
};

/**
 * 巡回 (棚経・月参り) の一覧。
 * - scope='upcoming' (既定): 今日以降 (scheduledDate 昇順, 上限 100)。
 * - scope='all': 過去含む全件 (scheduledDate 降順, 上限 200)。
 * いずれも論理削除 (deletedAt) は除外する。
 * scheduledDate は @db.Date (UTC0時保存) なので比較境界も UTC 基準で作る。
 */
export async function listCircuitTours(opts?: {
  scope?: 'upcoming' | 'all';
}): Promise<CircuitTourListRow[]> {
  const scope = opts?.scope ?? 'upcoming';
  const tenantId = await requireCurrentTenantId();
  const now = new Date();
  const todayUtc = new Date(
    Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()),
  );
  return withTenant(tenantId, (tx) =>
    scope === 'all'
      ? tx.circuitTour.findMany({
          where: { deletedAt: null },
          orderBy: { scheduledDate: 'desc' },
          take: 200,
          include: { _count: { select: { stops: true } } },
        })
      : tx.circuitTour.findMany({
          where: { deletedAt: null, scheduledDate: { gte: todayUtc } },
          orderBy: { scheduledDate: 'asc' },
          take: 100,
          include: { _count: { select: { stops: true } } },
        }),
  );
}

export type CircuitStopWithRelations = CircuitStop & {
  household: Pick<Household, 'id' | 'householderName'> | null;
  gravePlot: Pick<GravePlot, 'id' | 'plotNumber' | 'monumentName'> | null;
};

export type CircuitTourWithStops = CircuitTour & {
  stops: CircuitStopWithRelations[];
};

/**
 * 単一の巡回を取得 (訪問先を sortOrder 昇順で include)。
 * 論理削除済み (deletedAt!==null) は null を返す。他テナントの id は RLS で非表示。
 */
export async function getCircuitTourById(
  id: string,
): Promise<CircuitTourWithStops | null> {
  assertValidUuid(id, 'circuitTourId');
  const tenantId = await requireCurrentTenantId();
  const tour = await withTenant(tenantId, (tx) =>
    tx.circuitTour.findUnique({
      where: { id },
      include: {
        stops: {
          orderBy: { sortOrder: 'asc' },
          include: {
            household: { select: { id: true, householderName: true } },
            gravePlot: {
              select: { id: true, plotNumber: true, monumentName: true },
            },
          },
        },
      },
    }),
  );
  if (!tour || tour.deletedAt !== null) return null;
  return tour;
}

/**
 * 訪問先の追加候補 (世帯 / 区画)。新規 DB クエリは書かず既存関数へ委譲する。
 * 両関数とも内部で requireCurrentTenantId + withTenant 済みのため追加処理不要。
 */
export async function listStopCandidates() {
  const [households, gravePlots] = await Promise.all([
    listHouseholds(),
    listGravePlots(),
  ]);
  return { households, gravePlots };
}

export type AssigneeOption = { id: string; name: string };

/**
 * 担当者候補 (テナント内の有効な寺族)。巡回フォームとシフト表で再利用する。
 * User.displayName を UI 用の name へ写像する (氏名は担当割当の必要情報)。
 * displayName 昇順。
 */
export async function listActiveUsersForAssignee(): Promise<AssigneeOption[]> {
  const tenantId = await requireCurrentTenantId();
  const users = await withTenant(tenantId, (tx) =>
    tx.user.findMany({
      where: { isActive: true },
      select: { id: true, displayName: true },
      orderBy: { displayName: 'asc' },
    }),
  );
  return users.map((u) => ({ id: u.id, name: u.displayName }));
}
