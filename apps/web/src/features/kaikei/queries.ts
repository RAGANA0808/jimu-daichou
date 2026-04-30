import 'server-only';
import type {
  Household,
  Transaction,
  TransactionCategory,
  TransactionDirection,
} from '@prisma/client';
import { requireCurrentTenantId } from '@/lib/auth';
import { assertValidUuid, withTenant } from '@/lib/db';

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

/**
 * 指定年月の入出金を paidAt 降順で取得する。
 * month を省略すると年全体。Phase 1 は 500 件上限 (1 ヶ月で 500 件超える運用は想定外)。
 */
export async function listTransactionsByMonth(
  year: number,
  month?: number,
): Promise<TransactionWithHousehold[]> {
  const tenantId = await requireCurrentTenantId();
  const { from, to } =
    typeof month === 'number'
      ? jstMonthRange(year, month)
      : jstYearRange(year);

  return withTenant(tenantId, (tx) =>
    tx.transaction.findMany({
      where: { paidAt: { gte: from, lt: to } },
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
