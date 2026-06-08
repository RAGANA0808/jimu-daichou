import { describe, expect, it } from 'vitest';
import {
  aggregateCrossTab,
  calendarMonthForIndex,
  calendarYearForIndex,
  currentFiscalYearJst,
  fiscalMonthIndex,
  fiscalYearRangeUtc,
  type CrossTabInput,
} from './crosstab';

function tx(
  direction: CrossTabInput['direction'],
  category: CrossTabInput['category'],
  amount: number,
  isoDate: string,
): CrossTabInput {
  return { direction, category, amount, paidAt: new Date(isoDate) };
}

describe('fiscalYearRangeUtc', () => {
  it('4月始まりの UTC 半開区間を返す', () => {
    const { from, to } = fiscalYearRangeUtc(2026);
    expect(from.toISOString()).toBe('2026-04-01T00:00:00.000Z');
    expect(to.toISOString()).toBe('2027-04-01T00:00:00.000Z');
  });
});

describe('currentFiscalYearJst', () => {
  it('JST で 4月以降は当年が会計年度', () => {
    // 2026-04-01 00:00 JST = 2026-03-31 15:00 UTC
    expect(currentFiscalYearJst(new Date('2026-03-31T15:00:00.000Z'))).toBe(2026);
  });
  it('JST で 3月は前年が会計年度', () => {
    // 2026-03-31 23:59 JST = 2026-03-31 14:59 UTC
    expect(currentFiscalYearJst(new Date('2026-03-31T14:59:00.000Z'))).toBe(2025);
  });
  it('JST で 1月は前年が会計年度', () => {
    // 2027-01-15 09:00 JST = 2027-01-15 00:00 UTC
    expect(currentFiscalYearJst(new Date('2027-01-15T00:00:00.000Z'))).toBe(2026);
  });
});

describe('fiscalMonthIndex', () => {
  it('4月→0, 3月→11 (UTC 0:00 基準)', () => {
    expect(fiscalMonthIndex(new Date(Date.UTC(2026, 3, 1)))).toBe(0); // 4月
    expect(fiscalMonthIndex(new Date(Date.UTC(2026, 11, 31)))).toBe(8); // 12月
    expect(fiscalMonthIndex(new Date(Date.UTC(2027, 0, 1)))).toBe(9); // 1月
    expect(fiscalMonthIndex(new Date(Date.UTC(2027, 2, 31)))).toBe(11); // 3月
  });
});

describe('calendarMonthForIndex / calendarYearForIndex', () => {
  it('index → 実暦の月', () => {
    expect(calendarMonthForIndex(0)).toBe(4);
    expect(calendarMonthForIndex(8)).toBe(12);
    expect(calendarMonthForIndex(9)).toBe(1);
    expect(calendarMonthForIndex(11)).toBe(3);
  });
  it('index → 実暦の年 (年度跨ぎ)', () => {
    expect(calendarYearForIndex(0, 2026)).toBe(2026); // 4月
    expect(calendarYearForIndex(8, 2026)).toBe(2026); // 12月
    expect(calendarYearForIndex(9, 2026)).toBe(2027); // 1月
    expect(calendarYearForIndex(11, 2026)).toBe(2027); // 3月
  });
});

describe('aggregateCrossTab', () => {
  it('空データは全て 0', () => {
    const r = aggregateCrossTab([], 2026);
    expect(r.incomeRows).toHaveLength(0);
    expect(r.expenseRows).toHaveLength(0);
    expect(r.yearIncomeTotal).toBe(0);
    expect(r.yearExpenseTotal).toBe(0);
    expect(r.yearNetTotal).toBe(0);
    expect(r.monthIncomeTotals).toEqual(Array.from({ length: 12 }, () => 0));
  });

  it('収入・支出をブロックで分け、科目×会計月で集計', () => {
    const r = aggregateCrossTab(
      [
        tx('INCOME', 'MAINTENANCE_FEE', 10000, '2026-04-15'),
        tx('INCOME', 'MAINTENANCE_FEE', 5000, '2026-04-20'),
        tx('INCOME', 'OFFERING', 30000, '2026-12-01'),
        tx('EXPENSE', 'EXPENSE', 8000, '2027-01-10'),
      ],
      2026,
    );

    expect(r.incomeRows).toHaveLength(2);
    expect(r.expenseRows).toHaveLength(1);

    const fee = r.incomeRows.find((x) => x.category === 'MAINTENANCE_FEE')!;
    expect(fee.months[0]).toEqual({ total: 15000, count: 2 }); // 4月
    expect(fee.yearTotal).toEqual({ total: 15000, count: 2 });

    const offering = r.incomeRows.find((x) => x.category === 'OFFERING')!;
    expect(offering.months[8]).toEqual({ total: 30000, count: 1 }); // 12月

    const exp = r.expenseRows.find((x) => x.category === 'EXPENSE')!;
    expect(exp.months[9]).toEqual({ total: 8000, count: 1 }); // 1月

    expect(r.yearIncomeTotal).toBe(45000);
    expect(r.yearExpenseTotal).toBe(8000);
    expect(r.yearNetTotal).toBe(37000);
    expect(r.monthIncomeTotals[0]).toBe(15000);
    expect(r.monthIncomeTotals[8]).toBe(30000);
    expect(r.monthExpenseTotals[9]).toBe(8000);
    expect(r.monthNetTotals[9]).toBe(-8000);
  });

  it('科目行は TRANSACTION_CATEGORY_ORDER 順', () => {
    const r = aggregateCrossTab(
      [
        tx('INCOME', 'OTHER', 100, '2026-05-01'),
        tx('INCOME', 'MAINTENANCE_FEE', 200, '2026-05-01'),
        tx('INCOME', 'OFFERING', 300, '2026-05-01'),
      ],
      2026,
    );
    expect(r.incomeRows.map((x) => x.category)).toEqual([
      'MAINTENANCE_FEE',
      'OFFERING',
      'OTHER',
    ]);
  });

  it('年度末 3月末と年度跨ぎ 4月頭が正しく分かれる (UTC境界)', () => {
    const r2026 = aggregateCrossTab(
      [tx('INCOME', 'OFFERING', 1000, '2027-03-31')],
      2026,
    );
    // 2027-03-31 は 2026年度の 3月 (index 11)
    expect(r2026.incomeRows[0]!.months[11]).toEqual({ total: 1000, count: 1 });
  });
});
