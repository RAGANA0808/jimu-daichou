import { describe, expect, it } from 'vitest';
import {
  blankIfNull,
  formatCategory,
  formatDateCell,
  formatDeathDate,
  formatDirection,
  formatGravePlotStatus,
  formatGravePlotType,
  formatIntCell,
} from './format';

describe('blankIfNull', () => {
  it('null/undefined を空文字へ', () => {
    expect(blankIfNull(null)).toBe('');
    expect(blankIfNull(undefined)).toBe('');
    expect(blankIfNull('x')).toBe('x');
  });
});

describe('formatDateCell', () => {
  it('UTC の年月日を YYYY-MM-DD で出す', () => {
    expect(formatDateCell(new Date(Date.UTC(2024, 2, 5)))).toBe('2024-03-05');
  });
  it('null は空文字', () => {
    expect(formatDateCell(null)).toBe('');
  });
});

describe('formatIntCell', () => {
  it('数値を文字列へ、null は空文字', () => {
    expect(formatIntCell(1000)).toBe('1000');
    expect(formatIntCell(0)).toBe('0');
    expect(formatIntCell(null)).toBe('');
  });
});

describe('enum ラベル (インポート互換)', () => {
  it('区画種別', () => {
    expect(formatGravePlotType('INDIVIDUAL')).toBe('個人墓');
    expect(formatGravePlotType('ETERNAL_MEMORIAL')).toBe('永代供養墓');
    expect(formatGravePlotType('OSSUARY')).toBe('納骨堂');
  });
  it('区画状態', () => {
    expect(formatGravePlotStatus('AVAILABLE')).toBe('空き');
    expect(formatGravePlotStatus('CLOSED')).toBe('墓じまい済');
  });
  it('入出金区分', () => {
    expect(formatDirection('INCOME')).toBe('収入');
    expect(formatDirection('EXPENSE')).toBe('支出');
  });
  it('項目', () => {
    expect(formatCategory('MAINTENANCE_FEE')).toBe('護持会費');
    expect(formatCategory('EXPENSE')).toBe('経費');
    expect(formatCategory('OTHER')).toBe('その他');
  });
});

describe('formatDeathDate', () => {
  it('FULL は YYYY-MM-DD', () => {
    expect(
      formatDeathDate({ precision: 'FULL', year: 2024, month: 3, day: 5 }),
    ).toBe('2024-03-05');
  });
  it('YEAR_MONTH は YYYY-MM', () => {
    expect(
      formatDeathDate({ precision: 'YEAR_MONTH', year: 1988, month: 12, day: null }),
    ).toBe('1988-12');
  });
  it('YEAR は YYYY', () => {
    expect(
      formatDeathDate({ precision: 'YEAR', year: 1900, month: null, day: null }),
    ).toBe('1900');
  });
  it('UNKNOWN は空文字', () => {
    expect(
      formatDeathDate({ precision: 'UNKNOWN', year: null, month: null, day: null }),
    ).toBe('');
  });
});
