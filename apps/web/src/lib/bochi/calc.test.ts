import { describe, expect, it } from 'vitest';
import {
  aggregateDelinquencies,
  computeInvoiceStatus,
  generateInvoiceDrafts,
  reconcilePayment,
  summarizeFiscalYear,
  type DelinquencyInvoiceInput,
  type GravePlanSource,
  type InvoiceForSummary,
} from './calc';

describe('computeInvoiceStatus', () => {
  it('入金 0 は未納', () => {
    expect(computeInvoiceStatus(0, 12000)).toBe('UNPAID');
  });
  it('一部入金は PARTIAL', () => {
    expect(computeInvoiceStatus(5000, 12000)).toBe('PARTIAL');
  });
  it('満額は完納', () => {
    expect(computeInvoiceStatus(12000, 12000)).toBe('PAID');
  });
  it('過入金も完納扱い', () => {
    expect(computeInvoiceStatus(15000, 12000)).toBe('PAID');
  });
  it('請求額 0 円は (入金 0 でも) 完納扱い', () => {
    expect(computeInvoiceStatus(0, 0)).toBe('PAID');
  });
  it('負の入金は未納', () => {
    expect(computeInvoiceStatus(-100, 12000)).toBe('UNPAID');
  });
});

describe('generateInvoiceDrafts', () => {
  const plans: GravePlanSource[] = [
    {
      gravePlotId: 'plot-1',
      annualAmount: 12000,
      method: 'BANK_TRANSFER',
      isActive: true,
    },
    {
      gravePlotId: 'plot-2',
      annualAmount: 8000,
      method: 'POSTAL_TRANSFER',
      isActive: true,
    },
    {
      gravePlotId: 'plot-3',
      annualAmount: 5000,
      method: 'CASH',
      isActive: false,
    },
  ];

  it('有効な区画ぶんだけドラフトを作る (休止は除外)', () => {
    const r = generateInvoiceDrafts(plans, 2026, []);
    expect(r.drafts).toHaveLength(2);
    expect(r.skippedInactive).toBe(1);
    expect(r.skippedExisting).toBe(0);
    expect(r.drafts.map((d) => d.gravePlotId)).toEqual(['plot-1', 'plot-2']);
  });

  it('既に当年度請求のある区画は重複生成しない', () => {
    const r = generateInvoiceDrafts(plans, 2026, ['plot-1']);
    expect(r.drafts).toHaveLength(1);
    expect(r.drafts[0]!.gravePlotId).toBe('plot-2');
    expect(r.skippedExisting).toBe(1);
  });

  it('amount は台帳の annualAmount をスナップショットする', () => {
    const r = generateInvoiceDrafts(plans, 2026, []);
    expect(r.drafts[0]!.amount).toBe(12000);
    expect(r.drafts[0]!.method).toBe('BANK_TRANSFER');
  });
});

describe('reconcilePayment', () => {
  it('一部入金で PARTIAL に遷移する', () => {
    const r = reconcilePayment({
      amount: 12000,
      currentPaidAmount: 0,
      payment: 5000,
    });
    expect(r.newPaidAmount).toBe(5000);
    expect(r.status).toBe('PARTIAL');
    expect(r.becamePaid).toBe(false);
  });

  it('残額の入金で完納に到達する (becamePaid=true)', () => {
    const r = reconcilePayment({
      amount: 12000,
      currentPaidAmount: 5000,
      payment: 7000,
    });
    expect(r.newPaidAmount).toBe(12000);
    expect(r.status).toBe('PAID');
    expect(r.becamePaid).toBe(true);
  });

  it('既に完納済みへの追加入金は becamePaid=false', () => {
    const r = reconcilePayment({
      amount: 12000,
      currentPaidAmount: 12000,
      payment: 1000,
    });
    expect(r.newPaidAmount).toBe(13000);
    expect(r.becamePaid).toBe(false);
  });

  it('負の入金は 0 にクランプして累計を変えない', () => {
    const r = reconcilePayment({
      amount: 12000,
      currentPaidAmount: 3000,
      payment: -500,
    });
    expect(r.newPaidAmount).toBe(3000);
    expect(r.status).toBe('PARTIAL');
  });
});

describe('summarizeFiscalYear', () => {
  const invoices: InvoiceForSummary[] = [
    { amount: 12000, paidAmount: 12000, status: 'PAID' },
    { amount: 12000, paidAmount: 4000, status: 'PARTIAL' },
    { amount: 8000, paidAmount: 0, status: 'UNPAID' },
  ];

  it('件数・金額・未収を集計する', () => {
    const s = summarizeFiscalYear(invoices);
    expect(s.invoiceCount).toBe(3);
    expect(s.totalBilled).toBe(32000);
    expect(s.totalPaid).toBe(16000);
    expect(s.outstanding).toBe(16000);
    expect(s.paidCount).toBe(1);
    expect(s.partialCount).toBe(1);
    expect(s.unpaidCount).toBe(1);
    expect(s.collectionRate).toBe(50);
  });

  it('請求が空なら進捗 100% (集めるべき額がない)', () => {
    const s = summarizeFiscalYear([]);
    expect(s.collectionRate).toBe(100);
    expect(s.outstanding).toBe(0);
  });
});

describe('aggregateDelinquencies', () => {
  const currentYear = 2026;

  it('未収の残る区画だけを返し、経過年数・累積未納額を計算する', () => {
    const invoices: DelinquencyInvoiceInput[] = [
      // plot-1: 2024 未納 + 2025 一部 (累計 17000、最古 2024 → 3 年滞納)
      { gravePlotId: 'plot-1', fiscalYear: 2024, amount: 12000, paidAmount: 0, status: 'UNPAID' },
      { gravePlotId: 'plot-1', fiscalYear: 2025, amount: 12000, paidAmount: 7000, status: 'PARTIAL' },
      // plot-2: 2026 のみ未納 (累計 8000、最古 2026 → 1 年滞納)
      { gravePlotId: 'plot-2', fiscalYear: 2026, amount: 8000, paidAmount: 0, status: 'UNPAID' },
      // plot-3: 完納のみ → 対象外
      { gravePlotId: 'plot-3', fiscalYear: 2026, amount: 5000, paidAmount: 5000, status: 'PAID' },
    ];

    const r = aggregateDelinquencies(invoices, currentYear);
    expect(r).toHaveLength(2);

    // 累積未納額の多い順 → plot-1 (17000) が先頭
    expect(r[0]!.gravePlotId).toBe('plot-1');
    expect(r[0]!.totalOutstanding).toBe(17000);
    expect(r[0]!.oldestUnpaidYear).toBe(2024);
    expect(r[0]!.latestUnpaidYear).toBe(2025);
    expect(r[0]!.elapsedYears).toBe(3);
    expect(r[0]!.unpaidYearCount).toBe(2);

    expect(r[1]!.gravePlotId).toBe('plot-2');
    expect(r[1]!.totalOutstanding).toBe(8000);
    expect(r[1]!.elapsedYears).toBe(1);
  });

  it('完納のみの場合は空配列を返す', () => {
    const invoices: DelinquencyInvoiceInput[] = [
      { gravePlotId: 'plot-1', fiscalYear: 2026, amount: 12000, paidAmount: 12000, status: 'PAID' },
    ];
    expect(aggregateDelinquencies(invoices, currentYear)).toEqual([]);
  });

  it('経過年数は下限 1 (未来年度の未納でも 1 を返す)', () => {
    const invoices: DelinquencyInvoiceInput[] = [
      { gravePlotId: 'plot-1', fiscalYear: 2030, amount: 12000, paidAmount: 0, status: 'UNPAID' },
    ];
    const r = aggregateDelinquencies(invoices, currentYear);
    expect(r[0]!.elapsedYears).toBe(1);
  });

  it('累積未納額が同額なら経過年数の多い順', () => {
    const invoices: DelinquencyInvoiceInput[] = [
      { gravePlotId: 'plot-new', fiscalYear: 2026, amount: 10000, paidAmount: 0, status: 'UNPAID' },
      { gravePlotId: 'plot-old', fiscalYear: 2023, amount: 10000, paidAmount: 0, status: 'UNPAID' },
    ];
    const r = aggregateDelinquencies(invoices, currentYear);
    expect(r[0]!.gravePlotId).toBe('plot-old');
  });
});
