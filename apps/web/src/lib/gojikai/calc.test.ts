import { describe, expect, it } from 'vitest';
import {
  computeInvoiceStatus,
  generateInvoiceDrafts,
  reconcilePayment,
  summarizeFiscalYear,
  type FeePlanSource,
  type InvoiceForSummary,
} from './calc';

describe('computeInvoiceStatus', () => {
  it('入金 0 は未納', () => {
    expect(computeInvoiceStatus(0, 10000)).toBe('UNPAID');
  });
  it('一部入金は PARTIAL', () => {
    expect(computeInvoiceStatus(3000, 10000)).toBe('PARTIAL');
  });
  it('満額は完納', () => {
    expect(computeInvoiceStatus(10000, 10000)).toBe('PAID');
  });
  it('過入金も完納扱い', () => {
    expect(computeInvoiceStatus(12000, 10000)).toBe('PAID');
  });
  it('請求額 0 円は (入金 0 でも) 完納扱い', () => {
    expect(computeInvoiceStatus(0, 0)).toBe('PAID');
  });
  it('負の入金は未納', () => {
    expect(computeInvoiceStatus(-100, 10000)).toBe('UNPAID');
  });
});

describe('generateInvoiceDrafts', () => {
  const plans: FeePlanSource[] = [
    {
      householdId: 'hh-1',
      annualAmount: 10000,
      method: 'ANNUAL_LUMP',
      isActive: true,
    },
    {
      householdId: 'hh-2',
      annualAmount: 8000,
      method: 'BANK_TRANSFER',
      isActive: true,
    },
    {
      householdId: 'hh-3',
      annualAmount: 5000,
      method: 'CASH_COLLECTION',
      isActive: false,
    },
  ];

  it('当年度の請求が無い世帯のみドラフト化する', () => {
    const r = generateInvoiceDrafts(plans, 2026, []);
    expect(r.drafts).toHaveLength(2);
    expect(r.drafts.map((d) => d.householdId)).toEqual(['hh-1', 'hh-2']);
    expect(r.skippedInactive).toBe(1);
    expect(r.skippedExisting).toBe(0);
  });

  it('既存請求のある世帯は重複生成しない', () => {
    const r = generateInvoiceDrafts(plans, 2026, ['hh-1']);
    expect(r.drafts.map((d) => d.householdId)).toEqual(['hh-2']);
    expect(r.skippedExisting).toBe(1);
    expect(r.skippedInactive).toBe(1);
  });

  it('amount は台帳の annualAmount をスナップショットする', () => {
    const r = generateInvoiceDrafts(plans, 2027, []);
    const d1 = r.drafts.find((d) => d.householdId === 'hh-1');
    expect(d1).toMatchObject({
      fiscalYear: 2027,
      amount: 10000,
      method: 'ANNUAL_LUMP',
    });
  });

  it('全件既存なら空ドラフト', () => {
    const r = generateInvoiceDrafts(plans, 2026, ['hh-1', 'hh-2']);
    expect(r.drafts).toHaveLength(0);
    expect(r.skippedExisting).toBe(2);
  });
});

describe('reconcilePayment', () => {
  it('未納に満額入金で完納になり becamePaid=true', () => {
    const r = reconcilePayment({
      amount: 10000,
      currentPaidAmount: 0,
      payment: 10000,
    });
    expect(r.newPaidAmount).toBe(10000);
    expect(r.status).toBe('PAID');
    expect(r.becamePaid).toBe(true);
  });

  it('一部入金は PARTIAL で becamePaid=false', () => {
    const r = reconcilePayment({
      amount: 10000,
      currentPaidAmount: 0,
      payment: 3000,
    });
    expect(r.newPaidAmount).toBe(3000);
    expect(r.status).toBe('PARTIAL');
    expect(r.becamePaid).toBe(false);
  });

  it('一部入金済みに残額入金で完納に到達 (becamePaid=true)', () => {
    const r = reconcilePayment({
      amount: 10000,
      currentPaidAmount: 3000,
      payment: 7000,
    });
    expect(r.newPaidAmount).toBe(10000);
    expect(r.status).toBe('PAID');
    expect(r.becamePaid).toBe(true);
  });

  it('既に完納の請求に追加入金しても becamePaid=false (二重起票防止の判断材料)', () => {
    const r = reconcilePayment({
      amount: 10000,
      currentPaidAmount: 10000,
      payment: 5000,
    });
    expect(r.newPaidAmount).toBe(15000);
    expect(r.status).toBe('PAID');
    expect(r.becamePaid).toBe(false);
  });

  it('負の payment は 0 にクランプ', () => {
    const r = reconcilePayment({
      amount: 10000,
      currentPaidAmount: 2000,
      payment: -500,
    });
    expect(r.newPaidAmount).toBe(2000);
    expect(r.status).toBe('PARTIAL');
  });
});

describe('summarizeFiscalYear', () => {
  const invoices: InvoiceForSummary[] = [
    { amount: 10000, paidAmount: 10000, status: 'PAID' },
    { amount: 10000, paidAmount: 3000, status: 'PARTIAL' },
    { amount: 8000, paidAmount: 0, status: 'UNPAID' },
  ];

  it('件数・金額・未収を集計する', () => {
    const s = summarizeFiscalYear(invoices);
    expect(s.invoiceCount).toBe(3);
    expect(s.totalBilled).toBe(28000);
    expect(s.totalPaid).toBe(13000);
    expect(s.outstanding).toBe(15000);
    expect(s.unpaidCount).toBe(1);
    expect(s.partialCount).toBe(1);
    expect(s.paidCount).toBe(1);
  });

  it('進捗率は入金/請求の四捨五入整数', () => {
    const s = summarizeFiscalYear(invoices);
    // 13000 / 28000 = 46.4% → 46
    expect(s.collectionRate).toBe(46);
  });

  it('請求 0 件 (総額 0) のとき進捗 100%・未収 0', () => {
    const s = summarizeFiscalYear([]);
    expect(s.collectionRate).toBe(100);
    expect(s.outstanding).toBe(0);
    expect(s.invoiceCount).toBe(0);
  });

  it('過入金があっても未収は 0 未満にならない', () => {
    const s = summarizeFiscalYear([
      { amount: 10000, paidAmount: 12000, status: 'PAID' },
    ]);
    expect(s.outstanding).toBe(0);
    expect(s.collectionRate).toBe(100);
  });
});
