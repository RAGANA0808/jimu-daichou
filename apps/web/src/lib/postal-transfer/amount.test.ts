import { describe, expect, it } from 'vitest';
import {
  buildPostalSlip,
  formatAmountDigits,
  payableSlips,
  sumSubjectAmounts,
  visibleLines,
  type PostalSlip,
  type PostalSubjectLine,
} from './amount';

const lines: PostalSubjectLine[] = [
  { subjectId: 'a', name: '護持会費', amount: 10000 },
  { subjectId: 'b', name: '墓地管理費', amount: 5000 },
  { subjectId: 'c', name: 'お布施', amount: 0 },
  { subjectId: 'd', name: '寄付', amount: -100 },
];

describe('visibleLines', () => {
  it('金額が正の科目だけを残す', () => {
    expect(visibleLines(lines).map((l) => l.subjectId)).toEqual(['a', 'b']);
  });
});

describe('sumSubjectAmounts', () => {
  it('正の金額のみ合算する (負は 0 扱い)', () => {
    expect(sumSubjectAmounts(lines)).toBe(15000);
  });
  it('空配列は 0', () => {
    expect(sumSubjectAmounts([])).toBe(0);
  });
});

describe('formatAmountDigits', () => {
  it('3 桁区切りにする', () => {
    expect(formatAmountDigits(1234567)).toBe('1,234,567');
  });
  it('負・小数は 0 以上の整数に丸める', () => {
    expect(formatAmountDigits(-50)).toBe('0');
    expect(formatAmountDigits(1000.9)).toBe('1,000');
  });
});

describe('buildPostalSlip', () => {
  it('金額 0 を除外し合計を算出する', () => {
    const slip = buildPostalSlip({
      householdId: 'h1',
      householderName: '山田太郎',
      postalCode: '1234567',
      address: '東京都...',
      lines,
    });
    expect(slip.lines).toHaveLength(2);
    expect(slip.total).toBe(15000);
  });
});

describe('payableSlips', () => {
  it('合計 0 円の世帯を除外する', () => {
    const slips: PostalSlip[] = [
      {
        householdId: 'h1',
        householderName: 'A',
        postalCode: null,
        address: null,
        lines: [{ subjectId: 'a', name: '護持会費', amount: 10000 }],
        total: 10000,
      },
      {
        householdId: 'h2',
        householderName: 'B',
        postalCode: null,
        address: null,
        lines: [],
        total: 0,
      },
    ];
    expect(payableSlips(slips).map((s) => s.householdId)).toEqual(['h1']);
  });
});
