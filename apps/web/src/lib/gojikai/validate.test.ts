import { describe, expect, it } from 'vitest';
import {
  parseDbDate,
  parseFiscalYear,
  parsePaymentAmount,
  parseYenAmount,
  validatePlanInput,
} from './validate';

describe('parseYenAmount', () => {
  it('非負整数を受け入れる', () => {
    expect(parseYenAmount('0')).toBe(0);
    expect(parseYenAmount('10000')).toBe(10000);
  });
  it('小数・記号・カンマ・負数は弾く', () => {
    expect(parseYenAmount('1000.5')).toBeNull();
    expect(parseYenAmount('1,000')).toBeNull();
    expect(parseYenAmount('-5')).toBeNull();
    expect(parseYenAmount('¥100')).toBeNull();
  });
  it('上限超過は弾く', () => {
    expect(parseYenAmount('10000001')).toBeNull();
  });
});

describe('parsePaymentAmount', () => {
  it('0 は入金として認めない', () => {
    expect(parsePaymentAmount('0')).toBeNull();
  });
  it('正の整数を受け入れる', () => {
    expect(parsePaymentAmount('5000')).toBe(5000);
  });
});

describe('parseFiscalYear', () => {
  it('4 桁西暦を受け入れる', () => {
    expect(parseFiscalYear('2026')).toBe(2026);
  });
  it('範囲外・桁数違いは弾く', () => {
    expect(parseFiscalYear('1999')).toBeNull();
    expect(parseFiscalYear('20260')).toBeNull();
    expect(parseFiscalYear('26')).toBeNull();
  });
});

describe('parseDbDate', () => {
  it('YYYY-MM-DD を UTC 0 時で保存する (既存慣習)', () => {
    const d = parseDbDate('2026-03-31');
    expect(d).not.toBeNull();
    expect(d!.getUTCFullYear()).toBe(2026);
    expect(d!.getUTCMonth() + 1).toBe(3);
    expect(d!.getUTCDate()).toBe(31);
    expect(d!.getUTCHours()).toBe(0);
  });
  it('存在しない日付は弾く', () => {
    expect(parseDbDate('2026-02-30')).toBeNull();
    expect(parseDbDate('2026-13-01')).toBeNull();
    expect(parseDbDate('2026/03/31')).toBeNull();
  });
});

describe('validatePlanInput', () => {
  it('正常入力を検証して値を返す', () => {
    const r = validatePlanInput({
      annualAmount: '10000',
      method: 'BANK_TRANSFER',
      note: '本家世帯',
    });
    expect(r.errors).toEqual({});
    expect(r.values).toEqual({
      annualAmount: 10000,
      method: 'BANK_TRANSFER',
      note: '本家世帯',
    });
  });

  it('金額未入力はエラー', () => {
    const r = validatePlanInput({
      annualAmount: '',
      method: 'CASH_COLLECTION',
      note: '',
    });
    expect(r.errors.annualAmount).toBeDefined();
  });

  it('不正な納入区分はエラー', () => {
    const r = validatePlanInput({
      annualAmount: '5000',
      method: 'INVALID',
      note: '',
    });
    expect(r.errors.method).toBeDefined();
  });

  it('空の備考は null になる', () => {
    const r = validatePlanInput({
      annualAmount: '5000',
      method: 'OTHER',
      note: '   ',
    });
    expect(r.values.note).toBeNull();
  });
});
