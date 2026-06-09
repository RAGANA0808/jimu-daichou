import 'server-only';
import type {
  Household,
  Transaction,
  TransactionCategory,
  TransactionDirection,
} from '@prisma/client';
import { requireCurrentTenantId } from '@/lib/auth';
import { assertValidUuid, withTenant } from '@/lib/db';
import {
  aggregateCrossTab,
  fiscalYearRangeUtc,
  type CrossTabResult,
} from './crosstab';

export type TransactionWithHousehold = Transaction & {
  household: Pick<Household, 'id' | 'householderName' | 'nameKana'> | null;
};

/**
 * 指定年月の範囲 [startInclusive, endExclusive) を JST で計算する。
 * Asia/Tokyo は UTC+9 固定なのでローカル時刻 0:00 をそのまま使ってよい
 * (CLAUDE.md §4.3 TZ=Asia/Tokyo 固定)。
 */
function jstMonthRange(year: number, month: number): { from: Date; to: Date } {
  const from = new Date(year, month - 1, 1);
  const to = new Date(year, month, 1);
  return { from, to };
}

function jstYearRange(year: number): { from: Date; to: Date } {
  const from = new Date(year, 0, 1);
  const to = new Date(year + 1, 0, 1);
  return { from, to };
}

/** 一覧の追加絞り込み (会計クロス集計のセルからの遷移で使用)。 */
export type TransactionListFilter = {
  direction?: TransactionDirection;
  category?: TransactionCategory;
};

/**
 * 指定年月の入出金を paidAt 降順で取得する。
 * month を省略すると年全体。Phase 1 は 500 件上限 (1 ヶ月で 500 件超える運用は想定外)。
 * filter で direction / category の絞り込みも可能 (集計ビューからの遷移)。
 */
export async function listTransactionsByMonth(
  year: number,
  month?: number,
  filter: TransactionListFilter = {},
): Promise<TransactionWithHousehold[]> {
  const tenantId = await requireCurrentTenantId();
  const { from, to } =
    typeof month === 'number'
      ? jstMonthRange(year, month)
      : jstYearRange(year);

  return withTenant(tenantId, (tx) =>
    tx.transaction.findMany({
      where: {
        paidAt: { gte: from, lt: to },
        ...(filter.direction ? { direction: filter.direction } : {}),
        ...(filter.category ? { category: filter.category } : {}),
      },
      include: {
        household: {
          select: { id: true, householderName: true, nameKana: true },
        },
      },
      orderBy: [{ paidAt: 'desc' }, { createdAt: 'desc' }],
      take: 500,
    }),
  );
}

/**
 * 指定世帯の入出金履歴を paidAt 降順で取得 (世帯詳細ページで使用)。
 */
export async function listTransactionsByHousehold(
  householdId: string,
): Promise<TransactionWithHousehold[]> {
  assertValidUuid(householdId, 'householdId');
  const tenantId = await requireCurrentTenantId();
  return withTenant(tenantId, (tx) =>
    tx.transaction.findMany({
      where: { householdId },
      include: {
        household: {
          select: { id: true, householderName: true, nameKana: true },
        },
      },
      orderBy: [{ paidAt: 'desc' }, { createdAt: 'desc' }],
      take: 200,
    }),
  );
}

/**
 * 単一の入出金を取得 (詳細・編集ページで使用)。他テナントの id は RLS で非表示。
 */
export async function getTransactionById(
  id: string,
): Promise<TransactionWithHousehold | null> {
  assertValidUuid(id, 'transactionId');
  const tenantId = await requireCurrentTenantId();
  return withTenant(tenantId, (tx) =>
    tx.transaction.findUnique({
      where: { id },
      include: {
        household: {
          select: { id: true, householderName: true, nameKana: true },
        },
      },
    }),
  );
}

export type FinanceDashboardSummary = {
  /** 今月の収入合計 (円) */
  monthIncome: number;
  /** 今月の支出合計 (円) */
  monthExpense: number;
  /** 今月の差引 (円) */
  monthNet: number;
  /** 今年の護持会費 (MAINTENANCE_FEE) 入金件数 */
  maintenanceFeeCountThisYear: number;
  /** 今年の護持会費 入金合計 (円) */
  maintenanceFeeTotalThisYear: number;
};

/**
 * ダッシュボード用の会計サマリ。
 * 護持会費台帳 (E07) は未実装のため、既存 Transaction から算出できる指標に留める。
 * - 今月の収支
 * - 今年の護持会費入金状況 (未納の網羅判定はできないが「集まり具合」の気づきになる)
 */
export async function getFinanceDashboardSummary(
  now: Date = new Date(),
): Promise<FinanceDashboardSummary> {
  const tenantId = await requireCurrentTenantId();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const monthRange = jstMonthRange(year, month);
  const yearRange = jstYearRange(year);

  return withTenant(tenantId, async (tx) => {
    const [monthIncomeAgg, monthExpenseAgg, feeAgg] = await Promise.all([
      tx.transaction.aggregate({
        _sum: { amount: true },
        where: {
          direction: 'INCOME',
          paidAt: { gte: monthRange.from, lt: monthRange.to },
        },
      }),
      tx.transaction.aggregate({
        _sum: { amount: true },
        where: {
          direction: 'EXPENSE',
          paidAt: { gte: monthRange.from, lt: monthRange.to },
        },
      }),
      tx.transaction.aggregate({
        _sum: { amount: true },
        _count: { _all: true },
        where: {
          category: 'MAINTENANCE_FEE',
          direction: 'INCOME',
          paidAt: { gte: yearRange.from, lt: yearRange.to },
        },
      }),
    ]);

    const monthIncome = monthIncomeAgg._sum.amount ?? 0;
    const monthExpense = monthExpenseAgg._sum.amount ?? 0;
    return {
      monthIncome,
      monthExpense,
      monthNet: monthIncome - monthExpense,
      maintenanceFeeCountThisYear: feeAgg._count._all,
      maintenanceFeeTotalThisYear: feeAgg._sum.amount ?? 0,
    };
  });
}

export type TransactionSummary = {
  income: number;
  expense: number;
  net: number;
  byCategory: Array<{
    category: TransactionCategory;
    direction: TransactionDirection;
    total: number;
    count: number;
  }>;
};

/**
 * 取引リストから集計を作成する純関数 (DB アクセスなし)。
 * 一覧ページでクエリ結果をそのまま渡して使う。
 */
export function summarizeTransactions(
  txs: TransactionWithHousehold[],
): TransactionSummary {
  let income = 0;
  let expense = 0;
  const map = new Map<
    string,
    {
      category: TransactionCategory;
      direction: TransactionDirection;
      total: number;
      count: number;
    }
  >();

  for (const t of txs) {
    if (t.direction === 'INCOME') income += t.amount;
    else expense += t.amount;

    const key = `${t.direction}:${t.category}`;
    const cur = map.get(key);
    if (cur) {
      cur.total += t.amount;
      cur.count += 1;
    } else {
      map.set(key, {
        category: t.category,
        direction: t.direction,
        total: t.amount,
        count: 1,
      });
    }
  }

  return {
    income,
    expense,
    net: income - expense,
    byCategory: Array.from(map.values()),
  };
}

/**
 * 会計クロス集計 (E08): 指定会計年度 (4月始まり) の取引を 1 回取得し、
 * 科目 × 会計月でクロス集計して返す。
 *
 * 月レンジは @db.Date (UTC 0:00 保存) に厳密一致させるため
 * fiscalYearRangeUtc (Date.UTC ベース) で生成する。月軸のビン分けは
 * 取得後に getUTCMonth() ベースの純関数 aggregateCrossTab で行う。
 */
export async function getCrossTabByFiscalYear(
  fiscalYear: number,
): Promise<CrossTabResult> {
  const tenantId = await requireCurrentTenantId();
  const { from, to } = fiscalYearRangeUtc(fiscalYear);

  const txs = await withTenant(tenantId, (tx) =>
    tx.transaction.findMany({
      where: { paidAt: { gte: from, lt: to } },
      select: {
        direction: true,
        category: true,
        amount: true,
        paidAt: true,
      },
    }),
  );

  return aggregateCrossTab(txs, fiscalYear);
}
