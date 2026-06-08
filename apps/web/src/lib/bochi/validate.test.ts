import { describe, expect, it } from 'vitest';
import {
  parseDbDate,
  parseFiscalYear,
  parsePaymentAmount,
  parseYenAmount,
  validatePlanInput,
} from './validate';

describe('parseYenAmount', () => {
  it('非負整数を受け付ける', () => {
    expect(parseYenAmount('12000')).toBe(12000);
    expect(parseYenAmount('0')).toBe(0);
  });
  it('小数・カンマ・記号・全角・負数は弾く', () => {
    expect(parseYenAmount('1.5')).toBeNull();
    expect(parseYenAmount('1,000')).toBeNull();
    expect(parseYenAmount('-100')).toBeNull();
    expect(parseYenAmount('１２')).toBeNull();
  });
  it('上限超過は弾く', () => {
    expect(parseYenAmount('10000001')).toBeNull();
  });
});

describe('parsePaymentAmount', () => {
  it('0 は入金として認めない', () => {
    expect(parsePaymentAmount('0')).toBeNull();
  });
  it('正の整数は受け付ける', () => {
    expect(parsePaymentAmount('5000')).toBe(5000);
  });
});

describe('parseFiscalYear', () => {
  it('範囲内の西暦 4 桁を受け付ける', () => {
    expect(parseFiscalYear('2026')).toBe(2026);
  });
  it('範囲外・桁数違いは弾く', () => {
    expect(parseFiscalYear('1999')).toBeNull();
    expect(parseFiscalYear('2201')).toBeNull();
    expect(parseFiscalYear('26')).toBeNull();
  });
});

describe('parseDbDate', () => {
  it('正当な日付を UTC 0 時として保存用に変換する', () => {
    const d = parseDbDate('2026-06-05');
    expect(d).not.toBeNull();
    expect(d!.getUTCFullYear()).toBe(2026);
    expect(d!.getUTCMonth() + 1).toBe(6);
    expect(d!.getUTCDate()).toBe(5);
    expect(d!.getUTCHours()).toBe(0);
  });
  it('存在しない日付・形式違いは弾く', () => {
    expect(parseDbDate('2026-02-30')).toBeNull();
    expect(parseDbDate('2026/06/05')).toBeNull();
    expect(parseDbDate('')).toBeNull();
  });
});

describe('validatePlanInput', () => {
  it('正当な入力を通す (賦課根拠つき)', () => {
    const r = validatePlanInput({
      annualAmount: '12000',
      method: 'BANK_TRANSFER',
      basis: '一般区画 1 聖地ぶん',
      note: '',
    });
    expect(r.errors).toEqual({});
    expect(r.values.annualAmount).toBe(12000);
    expect(r.values.method).toBe('BANK_TRANSFER');
    expect(r.values.basis).toBe('一般区画 1 聖地ぶん');
    expect(r.values.note).toBeNull();
  });

  it('金額未入力・不正な納入区分はエラー', () => {
    const r = validatePlanInput({
      annualAmount: '',
      method: 'INVALID',
      basis: '',
      note: '',
    });
    expect(r.errors.annualAmount).toBeDefined();
    expect(r.errors.method).toBeDefined();
  });

  it('賦課根拠・備考の文字数上限を検証する', () => {
    const long = 'あ'.repeat(1001);
    const r = validatePlanInput({
      annualAmount: '12000',
      method: 'CASH',
      basis: long,
      note: long,
    });
    expect(r.errors.basis).toBeDefined();
    expect(r.errors.note).toBeDefined();
  });
});
