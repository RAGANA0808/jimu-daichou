import type { TransactionCategory, TransactionDirection } from '@prisma/client';
import { TRANSACTION_CATEGORY_ORDER } from './types';

/**
 * 会計クロス集計 (E08) 用の純関数・日時ヘルパー群。
 *
 * 重要 (TZ 規約): paidAt は @db.Date で UTC 0:00 保存されている。
 * 月レンジ・年度判定は必ず Date.UTC(...) 生成 + getUTC* 読み出しで行う。
 * (ローカル new Date(y, m, d) は TZ 環境依存で月境界がズレる潜在バグになるため使わない。)
 */

/** 1 セル (金額合計と件数)。 */
export type CrossTabCell = { total: number; count: number };

/** 科目 × 12 ヶ月のクロス集計行 (1 direction × 1 category)。 */
export type CrossTabRow = {
  direction: TransactionDirection;
  category: TransactionCategory;
  /** length 12。months[0]=4月 … months[11]=翌3月 (会計月順)。 */
  months: CrossTabCell[];
  /** 年計 (12 ヶ月の合算)。 */
  yearTotal: CrossTabCell;
};

export type CrossTabResult = {
  fiscalYear: number;
  /** 収入ブロックの行 (TRANSACTION_CATEGORY_ORDER 順、データのある科目のみ)。 */
  incomeRows: CrossTabRow[];
  /** 支出ブロックの行 (同上)。 */
  expenseRows: CrossTabRow[];
  /** 収入の月別合計 (length 12, 会計月順)。 */
  monthIncomeTotals: number[];
  /** 支出の月別合計 (length 12, 会計月順)。 */
  monthExpenseTotals: number[];
  /** 差引 (収入 − 支出) の月別 (length 12, 会計月順)。 */
  monthNetTotals: number[];
  /** 収入年計。 */
  yearIncomeTotal: number;
  /** 支出年計。 */
  yearExpenseTotal: number;
  /** 差引年計 (収入年計 − 支出年計)。 */
  yearNetTotal: number;
};

/** 集計対象の最小フィールド。 */
export type CrossTabInput = {
  direction: TransactionDirection;
  category: TransactionCategory;
  amount: number;
  paidAt: Date;
};

/**
 * 年度 (4 月始まり) → UTC ベースの半開区間 [from, to)。
 * fiscalYear=2026 → 2026-04-01 〜 2027-04-01 (UTC 0:00)。
 */
export function fiscalYearRangeUtc(fiscalYear: number): { from: Date; to: Date } {
  return {
    from: new Date(Date.UTC(fiscalYear, 3, 1)),
    to: new Date(Date.UTC(fiscalYear + 1, 3, 1)),
  };
}

/**
 * 現在の会計年度 (JST 基準)。月 < 4 なら前年が会計年度。
 * サーバの TZ に依存しないよう UTC+9h 補正 → getUTC* で判定する。
 */
export function currentFiscalYearJst(now: Date = new Date()): number {
  const jst = new Date(now.getTime() + 9 * 3600_000);
  const y = jst.getUTCFullYear();
  const m = jst.getUTCMonth() + 1; // 1-12
  return m >= 4 ? y : y - 1;
}

/**
 * paidAt (@db.Date, UTC 0:00) から会計月インデックスを算出。
 * 4月→0, 5月→1, … 3月→11。
 */
export function fiscalMonthIndex(paidAt: Date): number {
  return (paidAt.getUTCMonth() - 3 + 12) % 12;
}

/** 会計月インデックス (0..11) → 実暦の月 (1..12)。0→4月 … 11→3月。 */
export function calendarMonthForIndex(index: number): number {
  return ((index + 3) % 12) + 1;
}

/**
 * 会計月インデックス (0..11) と会計年度から実暦年を算出。
 * 4〜12月 (index 0..8) は fiscalYear、1〜3月 (index 9..11) は fiscalYear+1。
 */
export function calendarYearForIndex(index: number, fiscalYear: number): number {
  return index <= 8 ? fiscalYear : fiscalYear + 1;
}

function emptyCell(): CrossTabCell {
  return { total: 0, count: 0 };
}

function buildRow(
  direction: TransactionDirection,
  category: TransactionCategory,
): CrossTabRow {
  return {
    direction,
    category,
    months: Array.from({ length: 12 }, emptyCell),
    yearTotal: emptyCell(),
  };
}

/**
 * 取引リストをクロス集計する純関数 (DB アクセスなし・テスト対象)。
 * 収入 (INCOME) と支出 (EXPENSE) をブロックで分け、科目 × 会計月で集計する。
 */
export function aggregateCrossTab(
  txs: CrossTabInput[],
  fiscalYear: number,
): CrossTabResult {
  const incomeMap = new Map<TransactionCategory, CrossTabRow>();
  const expenseMap = new Map<TransactionCategory, CrossTabRow>();

  const monthIncomeTotals = Array.from({ length: 12 }, () => 0);
  const monthExpenseTotals = Array.from({ length: 12 }, () => 0);

  for (const t of txs) {
    const mi = fiscalMonthIndex(t.paidAt);
    const map = t.direction === 'INCOME' ? incomeMap : expenseMap;
    let row = map.get(t.category);
    if (!row) {
      row = buildRow(t.direction, t.category);
      map.set(t.category, row);
    }
    const cell = row.months[mi]!;
    cell.total += t.amount;
    cell.count += 1;
    row.yearTotal.total += t.amount;
    row.yearTotal.count += 1;

    if (t.direction === 'INCOME') monthIncomeTotals[mi]! += t.amount;
    else monthExpenseTotals[mi]! += t.amount;
  }

  const orderRows = (map: Map<TransactionCategory, CrossTabRow>): CrossTabRow[] =>
    TRANSACTION_CATEGORY_ORDER.flatMap((cat) => {
      const row = map.get(cat);
      return row ? [row] : [];
    });

  const monthNetTotals = monthIncomeTotals.map(
    (inc, i) => inc - monthExpenseTotals[i]!,
  );
  const yearIncomeTotal = monthIncomeTotals.reduce((a, b) => a + b, 0);
  const yearExpenseTotal = monthExpenseTotals.reduce((a, b) => a + b, 0);

  return {
    fiscalYear,
    incomeRows: orderRows(incomeMap),
    expenseRows: orderRows(expenseMap),
    monthIncomeTotals,
    monthExpenseTotals,
    monthNetTotals,
    yearIncomeTotal,
    yearExpenseTotal,
    yearNetTotal: yearIncomeTotal - yearExpenseTotal,
  };
}
