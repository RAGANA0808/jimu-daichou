import type { TransactionCategory, TransactionDirection } from '@prisma/client';

/**
 * 経年トレンド分析 (ANALYTICS-LATER) 用の純関数・DB 非依存ロジック。
 *
 * 重要 (TZ 2 系統規約 — 取り違え厳禁):
 * - Transaction.paidAt は @db.Date で UTC 0:00 保存 → fiscalYearOfUtcDate で getUTC* 直読み (補正なし)。
 * - MemorialService.scheduledAt / Household.createdAt は JST instant の timestamp
 *   → fiscalYearOfJst で +9h 補正してから getUTC* で判定 (crosstab.currentFiscalYearJst と同じ規約)。
 *
 * features 層を import してはならない (レイヤ逆転禁止)。会計年度ヘルパは自前で持つ。
 * 会計年度: 4 月始まり。月 >= 4 ならその年、月 < 4 (1-3 月) なら前年が会計年度。
 */

/** Transaction.paidAt (@db.Date, UTC 0:00) 用。補正なしで直読みする。 */
export function fiscalYearOfUtcDate(d: Date): number {
  const m = d.getUTCMonth() + 1;
  const y = d.getUTCFullYear();
  return m >= 4 ? y : y - 1;
}

/** scheduledAt / createdAt (JST instant) 用。+9h 補正してから判定する。 */
export function fiscalYearOfJst(d: Date): number {
  const jst = new Date(d.getTime() + 9 * 3600_000);
  const m = jst.getUTCMonth() + 1;
  const y = jst.getUTCFullYear();
  return m >= 4 ? y : y - 1;
}

/** 昇順 inclusive な会計年度の軸 [fromFy..toFy]。toFy < fromFy なら []。 */
export function buildFiscalYearAxis(fromFy: number, toFy: number): number[] {
  if (toFy < fromFy) return [];
  return Array.from({ length: toFy - fromFy + 1 }, (_, i) => fromFy + i);
}

/** aggregateYearlyFinance の入力 (最小フィールド)。 */
export type YearlyFinanceInput = {
  direction: TransactionDirection;
  category: TransactionCategory;
  amount: number;
  paidAt: Date;
};

/** 1 会計年度分の金額集計点。axis と同じ並び・同じ長さで返る。 */
export type YearlyFinancePoint = {
  fiscalYear: number;
  income: number;
  expense: number;
  net: number;
  maintenanceFee: number;
};

/**
 * 取引を会計年度ごとに集計する。axis と同じ並び・同じ長さで 1 点ずつ返す。
 * 各 tx を fiscalYearOfUtcDate(paidAt) で振り分け、axis 外の年度は無視する。
 */
export function aggregateYearlyFinance(
  txs: YearlyFinanceInput[],
  axis: number[],
): YearlyFinancePoint[] {
  const indexByFy = new Map<number, number>();
  const points: YearlyFinancePoint[] = axis.map((fiscalYear, i) => {
    indexByFy.set(fiscalYear, i);
    return { fiscalYear, income: 0, expense: 0, net: 0, maintenanceFee: 0 };
  });

  for (const t of txs) {
    const fy = fiscalYearOfUtcDate(t.paidAt);
    const idx = indexByFy.get(fy);
    if (idx === undefined) continue;
    const point = points[idx]!;
    if (t.direction === 'INCOME') {
      point.income += t.amount;
      if (t.category === 'MAINTENANCE_FEE') point.maintenanceFee += t.amount;
    } else {
      point.expense += t.amount;
    }
  }

  for (const point of points) {
    point.net = point.income - point.expense;
  }

  return points;
}

/**
 * JST instant の日付配列を会計年度ごとに件数集計する。
 * axis と同じ長さの number[] を返し、各 date を fiscalYearOfJst で振り分け、axis 外は無視する。
 */
export function aggregateYearlyCountJst(dates: Date[], axis: number[]): number[] {
  const indexByFy = new Map<number, number>();
  axis.forEach((fy, i) => indexByFy.set(fy, i));

  const counts = axis.map(() => 0);
  for (const d of dates) {
    const idx = indexByFy.get(fiscalYearOfJst(d));
    if (idx === undefined) continue;
    counts[idx]! += 1;
  }
  return counts;
}
