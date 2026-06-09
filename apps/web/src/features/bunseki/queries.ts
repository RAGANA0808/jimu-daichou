import 'server-only';
import { PreparationStatus } from '@prisma/client';
import { requireCapability, requireCurrentTenantId } from '@/lib/auth';
import { withTenant } from '@/lib/db';
import { currentFiscalYearJst, fiscalYearRangeUtc } from '@/features/kaikei/crosstab';
import {
  aggregateYearlyCountJst,
  aggregateYearlyFinance,
  buildFiscalYearAxis,
  type YearlyFinancePoint,
} from '@/lib/analytics/yearly';

/** 経年トレンドの 1 ページ分の集計結果。axis と各系列配列は同じ並び・同じ長さ。 */
export type YearlyTrends = {
  /** 会計年度の昇順軸 [fromFy..toFy]。 */
  axis: number[];
  fromFy: number;
  toFy: number;
  /** 表示年数 (3〜15 にクランプ済み)。 */
  years: number;
  /** 会計年度別の金額集計 (axis と同じ並び・長さ)。 */
  finance: YearlyFinancePoint[];
  /** 会計年度別の法要件数 (axis と同じ並び・長さ)。 */
  serviceCounts: number[];
  /** 会計年度別の新規世帯登録件数 (axis と同じ並び・長さ)。 */
  householdCounts: number[];
  /** 今年度スナップショット KPI (トレンドレンジに依存しない全期間カウントを含む)。 */
  kpi: {
    /** 有効世帯数 (isActive=true・全期間)。 */
    activeHouseholds: number;
    /** 過去帳の故人数 (論理削除を除く・全期間)。 */
    deceasedCount: number;
    /** 今年度 (toFy) の法要件数。 */
    servicesThisFy: number;
    /** 今年度 (toFy) の差引 (純額)。 */
    netThisFy: number;
  };
};

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

/**
 * 会計年度 (4 月始まり) 別の経年トレンドを取得する (読み取り専用)。
 *
 * 日時 2 系統 (取り違え厳禁):
 * - Transaction.paidAt は @db.Date (UTC 0:00) → fiscalYearRangeUtc の UTC 半開区間で取得し、
 *   aggregateYearlyFinance が getUTC* 直読み (補正なし) で年度判定する。
 * - MemorialService.scheduledAt / Household.createdAt は JST instant の timestamp →
 *   +9h 補正した JST 半開区間で取得し、aggregateYearlyCountJst が +9h 補正で年度判定する。
 *
 * 取得窓の instant 範囲は 2 系統で 9 時間ずれるが、各 aggregator が per-record で
 * 再ビン分けして axis 外を捨てるため最終集計は正しい (yearly.test.ts で境界を固定)。
 */
export async function getYearlyTrends(opts?: {
  years?: number;
}): Promise<YearlyTrends> {
  await requireCapability('read');
  const tenantId = await requireCurrentTenantId();

  const years = clamp(opts?.years ?? 7, 3, 15);
  const toFy = currentFiscalYearJst();
  const fromFy = toFy - (years - 1);
  const axis = buildFiscalYearAxis(fromFy, toFy);

  // Transaction レンジ (paidAt = @db.Date, UTC 0:00 の半開区間)。
  const txFrom = fiscalYearRangeUtc(fromFy).from;
  const txTo = fiscalYearRangeUtc(toFy).to;

  // scheduledAt / createdAt は JST instant。+9h 補正した JST 半開区間で取得する。
  const jstFrom = new Date(Date.UTC(fromFy, 3, 1) - 9 * 3600_000);
  const jstTo = new Date(Date.UTC(toFy + 1, 3, 1) - 9 * 3600_000);

  // 接続枯渇を避けるため全 read を 1 つの withTenant コールバック内 (=1 コネクション) で発行する。
  const { txs, services, households, activeHouseholds, deceasedCount } =
    await withTenant(tenantId, async (db) => {
      const [txs, services, households, activeHouseholds, deceasedCount] =
        await Promise.all([
          db.transaction.findMany({
            where: { paidAt: { gte: txFrom, lt: txTo } },
            select: {
              direction: true,
              category: true,
              amount: true,
              paidAt: true,
            },
          }),
          db.memorialService.findMany({
            where: {
              scheduledAt: { gte: jstFrom, lt: jstTo },
              preparationStatus: { not: PreparationStatus.CANCELED },
            },
            select: { scheduledAt: true },
          }),
          db.household.findMany({
            where: { createdAt: { gte: jstFrom, lt: jstTo } },
            select: { createdAt: true },
          }),
          db.household.count({ where: { isActive: true } }),
          db.deathLedgerEntry.count({ where: { deletedAt: null } }),
        ]);
      return { txs, services, households, activeHouseholds, deceasedCount };
    });

  const finance = aggregateYearlyFinance(txs, axis);
  const serviceCounts = aggregateYearlyCountJst(
    services.map((s) => s.scheduledAt),
    axis,
  );
  const householdCounts = aggregateYearlyCountJst(
    households.map((h) => h.createdAt),
    axis,
  );

  // toFy は axis 末尾だが、暗黙の並び依存を避けて明示検索で引く。
  const toFyIndex = axis.indexOf(toFy);
  const servicesThisFy = toFyIndex >= 0 ? (serviceCounts[toFyIndex] ?? 0) : 0;
  const netThisFy = finance.find((p) => p.fiscalYear === toFy)?.net ?? 0;

  return {
    axis,
    fromFy,
    toFy,
    years,
    finance,
    serviceCounts,
    householdCounts,
    kpi: {
      activeHouseholds,
      deceasedCount,
      servicesThisFy,
      netThisFy,
    },
  };
}
