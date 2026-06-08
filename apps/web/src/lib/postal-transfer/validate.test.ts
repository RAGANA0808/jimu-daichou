import { describe, expect, it } from 'vitest';
import {
  parseAmount,
  validateAccountInput,
  validateSubjectInput,
} from './validate';

describe('parseAmount', () => {
  it('非負整数を受理する', () => {
    expect(parseAmount('10000')).toBe(10000);
    expect(parseAmount('0')).toBe(0);
  });
  it('不正値は null', () => {
    expect(parseAmount('-1')).toBeNull();
    expect(parseAmount('1.5')).toBeNull();
    expect(parseAmount('1,000')).toBeNull();
    expect(parseAmount('abc')).toBeNull();
  });
});

describe('validateSubjectInput', () => {
  it('正常入力を受理する', () => {
    const r = validateSubjectInput({
      name: '護持会費',
      defaultAmount: '10000',
      sortOrder: '1',
      amountSource: 'MAINTENANCE_FEE',
    });
    expect(r.errors).toEqual({});
    expect(r.values.defaultAmount).toBe(10000);
    expect(r.values.amountSource).toBe('MAINTENANCE_FEE');
  });
  it('科目名が空ならエラー', () => {
    const r = validateSubjectInput({
      name: '   ',
      defaultAmount: '0',
      sortOrder: '',
      amountSource: 'NONE',
    });
    expect(r.errors.name).toBeDefined();
  });
  it('既定金額が空なら 0 として扱う', () => {
    const r = validateSubjectInput({
      name: 'お布施',
      defaultAmount: '',
      sortOrder: '',
      amountSource: 'NONE',
    });
    expect(r.errors.defaultAmount).toBeUndefined();
    expect(r.values.defaultAmount).toBe(0);
  });
  it('不正な連動元はエラー', () => {
    const r = validateSubjectInput({
      name: 'お布施',
      defaultAmount: '0',
      sortOrder: '',
      amountSource: 'BOGUS',
    });
    expect(r.errors.amountSource).toBeDefined();
  });
});

describe('validateAccountInput', () => {
  it('正常入力を受理しオフセットをパースする', () => {
    const r = validateAccountInput({
      postalAccountName: '○○寺',
      postalAccountSymbol: '00100',
      postalAccountNumber: '1234567',
      postalTransferNote: 'いつもありがとうございます',
      postalPrintOffsetXMm: '1.5',
      postalPrintOffsetYMm: '-2',
    });
    expect(r.errors).toEqual({});
    expect(r.values.postalPrintOffsetXMm).toBe(1.5);
    expect(r.values.postalPrintOffsetYMm).toBe(-2);
    expect(r.values.postalAccountName).toBe('○○寺');
  });
  it('空欄は null に正規化しオフセットは 0', () => {
    const r = validateAccountInput({
      postalAccountName: '',
      postalAccountSymbol: '',
      postalAccountNumber: '',
      postalTransferNote: '',
      postalPrintOffsetXMm: '',
      postalPrintOffsetYMm: '',
    });
    expect(r.values.postalAccountName).toBeNull();
    expect(r.values.postalPrintOffsetXMm).toBe(0);
  });
  it('記号に英字が混じるとエラー', () => {
    const r = validateAccountInput({
      postalAccountName: '',
      postalAccountSymbol: 'ABC',
      postalAccountNumber: '',
      postalTransferNote: '',
      postalPrintOffsetXMm: '0',
      postalPrintOffsetYMm: '0',
    });
    expect(r.errors.postalAccountSymbol).toBeDefined();
  });
  it('オフセットが安全域外ならエラー', () => {
    const r = validateAccountInput({
      postalAccountName: '',
      postalAccountSymbol: '',
      postalAccountNumber: '',
      postalTransferNote: '',
      postalPrintOffsetXMm: '999',
      postalPrintOffsetYMm: '0',
    });
    expect(r.errors.postalPrintOffsetXMm).toBeDefined();
  });
});
