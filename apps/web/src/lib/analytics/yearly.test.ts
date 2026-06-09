import { describe, expect, it } from 'vitest';
import {
  aggregateYearlyCountJst,
  aggregateYearlyFinance,
  buildFiscalYearAxis,
  fiscalYearOfJst,
  fiscalYearOfUtcDate,
  type YearlyFinanceInput,
} from './yearly';

function tx(
  direction: YearlyFinanceInput['direction'],
  category: YearlyFinanceInput['category'],
  amount: number,
  paidAtUtc: Date,
): YearlyFinanceInput {
  return { direction, category, amount, paidAt: paidAtUtc };
}

describe('fiscalYearOfUtcDate (paidAt @db.Date, 補正なし)', () => {
  it('UTC 3/31 は前年度', () => {
    expect(fiscalYearOfUtcDate(new Date(Date.UTC(2026, 2, 31)))).toBe(2025);
  });
  it('UTC 4/1 は当年度', () => {
    expect(fiscalYearOfUtcDate(new Date(Date.UTC(2026, 3, 1)))).toBe(2026);
  });
  it('UTC 12/31 は当年度', () => {
    expect(fiscalYearOfUtcDate(new Date(Date.UTC(2026, 11, 31)))).toBe(2026);
  });
  it('UTC 1/1 は前年度', () => {
    expect(fiscalYearOfUtcDate(new Date(Date.UTC(2027, 0, 1)))).toBe(2026);
  });
});

describe('fiscalYearOfJst (JST instant, +9h 補正)', () => {
  it('JST 2026-04-01 00:00 (= UTC 2026-03-31T15:00Z) は 2026 年度', () => {
    expect(fiscalYearOfJst(new Date('2026-03-31T15:00:00.000Z'))).toBe(2026);
  });
  it('JST 2026-03-31 23:59 (= UTC 2026-03-31T14:59Z) は 2025 年度', () => {
    // 2 系統取り違えの回帰防止: 補正なしだと UTC は 3/31 で同じく前年度になるが、
    // ここでは +9h 補正後も JST が 3/31 のため前年度であることを固定。
    expect(fiscalYearOfJst(new Date('2026-03-31T14:59:00.000Z'))).toBe(2025);
  });
});

describe('buildFiscalYearAxis', () => {
  it('昇順 inclusive [fromFy..toFy]', () => {
    expect(buildFiscalYearAxis(2020, 2026)).toEqual([
      2020, 2021, 2022, 2023, 2024, 2025, 2026,
    ]);
    expect(buildFiscalYearAxis(2020, 2026)).toHaveLength(7);
  });
  it('単年は length 1', () => {
    expect(buildFiscalYearAxis(2026, 2026)).toEqual([2026]);
  });
  it('toFy < fromFy なら []', () => {
    expect(buildFiscalYearAxis(2026, 2020)).toEqual([]);
  });
});

describe('aggregateYearlyFinance', () => {
  it('2 年度にまたがる tx で income/expense/net/maintenanceFee を集計', () => {
    const axis = buildFiscalYearAxis(2025, 2026);
    const points = aggregateYearlyFinance(
      [
        // 2025 年度 (UTC 4/1 2025 〜 3/31 2026)
        tx('INCOME', 'MAINTENANCE_FEE', 10000, new Date(Date.UTC(2025, 3, 15))),
        tx('INCOME', 'MAINTENANCE_FEE', 5000, new Date(Date.UTC(2026, 2, 31))), // 3/31 → 2025 年度
        tx('INCOME', 'OFFERING', 3000, new Date(Date.UTC(2025, 11, 1))),
        tx('EXPENSE', 'EXPENSE', 2000, new Date(Date.UTC(2025, 5, 10))),
        // 2026 年度
        tx('INCOME', 'MAINTENANCE_FEE', 8000, new Date(Date.UTC(2026, 3, 1))), // 4/1 → 2026 年度
        tx('EXPENSE', 'EXPENSE', 1000, new Date(Date.UTC(2026, 6, 20))),
      ],
      axis,
    );

    expect(points).toHaveLength(axis.length);
    expect(points.map((p) => p.fiscalYear)).toEqual([2025, 2026]);

    const fy2025 = points[0]!;
    expect(fy2025.income).toBe(18000); // 10000 + 5000 + 3000
    expect(fy2025.maintenanceFee).toBe(15000); // 10000 + 5000 (OFFERING は含まない)
    expect(fy2025.expense).toBe(2000);
    expect(fy2025.net).toBe(16000);

    const fy2026 = points[1]!;
    expect(fy2026.income).toBe(8000);
    expect(fy2026.maintenanceFee).toBe(8000);
    expect(fy2026.expense).toBe(1000);
    expect(fy2026.net).toBe(7000);
  });

  it('axis 外の tx は無視され、配列長は axis と一致する', () => {
    const axis = buildFiscalYearAxis(2026, 2026);
    const points = aggregateYearlyFinance(
      [
        tx('INCOME', 'OFFERING', 9999, new Date(Date.UTC(2024, 5, 1))), // 2024 年度 (axis 外)
        tx('INCOME', 'OFFERING', 500, new Date(Date.UTC(2026, 4, 1))), // 2026 年度
      ],
      axis,
    );
    expect(points).toHaveLength(1);
    expect(points[0]!.income).toBe(500);
  });

  it('空 axis は空配列', () => {
    expect(aggregateYearlyFinance([], [])).toEqual([]);
  });

  it('全 0 データでも axis 長の 0 埋め点を返す', () => {
    const points = aggregateYearlyFinance([], buildFiscalYearAxis(2024, 2026));
    expect(points).toHaveLength(3);
    expect(points.every((p) => p.income === 0 && p.expense === 0 && p.net === 0)).toBe(
      true,
    );
  });
});

describe('aggregateYearlyCountJst', () => {
  it('JST 会計年度境界 (3/31 と 4/1 相当の UTC instant) が正しい年度に入る', () => {
    const axis = buildFiscalYearAxis(2025, 2026);
    const counts = aggregateYearlyCountJst(
      [
        new Date('2026-03-31T14:59:00.000Z'), // JST 2026-03-31 23:59 → 2025 年度
        new Date('2026-03-31T15:00:00.000Z'), // JST 2026-04-01 00:00 → 2026 年度
        new Date('2025-04-01T00:00:00.000Z'), // JST 2025-04-01 09:00 → 2025 年度
      ],
      axis,
    );
    expect(counts).toEqual([2, 1]); // 2025 年度: 2 件, 2026 年度: 1 件
  });

  it('axis 外は無視され、配列長は axis と一致する', () => {
    const axis = buildFiscalYearAxis(2026, 2026);
    const counts = aggregateYearlyCountJst(
      [
        new Date('2023-06-01T00:00:00.000Z'), // 2023 年度 (axis 外)
        new Date('2026-06-01T00:00:00.000Z'), // 2026 年度
      ],
      axis,
    );
    expect(counts).toEqual([1]);
  });

  it('空入力は axis 長の 0 配列', () => {
    expect(aggregateYearlyCountJst([], buildFiscalYearAxis(2024, 2026))).toEqual([
      0, 0, 0,
    ]);
  });
});
