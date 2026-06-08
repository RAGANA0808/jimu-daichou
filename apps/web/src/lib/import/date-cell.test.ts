import { describe, expect, it } from 'vitest';
import { parseDateCell } from './date-cell';

describe('parseDateCell', () => {
  it('空欄は null (未入力) として ok', () => {
    const r = parseDateCell('');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBeNull();
  });

  it('西暦ハイフン区切りを暦日に変換する', () => {
    const r = parseDateCell('2024-03-15');
    expect(r.ok).toBe(true);
    if (r.ok && r.value) {
      expect(r.value.getUTCFullYear()).toBe(2024);
      expect(r.value.getUTCMonth()).toBe(2);
      expect(r.value.getUTCDate()).toBe(15);
    }
  });

  it('和暦表記を西暦の暦日へ変換する', () => {
    const r = parseDateCell('令和6年3月15日');
    expect(r.ok).toBe(true);
    if (r.ok && r.value) {
      expect(r.value.getUTCFullYear()).toBe(2024);
      expect(r.value.getUTCMonth()).toBe(2);
      expect(r.value.getUTCDate()).toBe(15);
    }
  });

  it('全角数字・スラッシュ・年月日表記も受理する', () => {
    expect(parseDateCell('２０２４/３/５').ok).toBe(true);
    expect(parseDateCell('2024年3月5日').ok).toBe(true);
  });

  it('年のみ・年月のみは incomplete_date エラー', () => {
    const y = parseDateCell('2024');
    expect(y.ok).toBe(false);
    if (!y.ok) expect(y.error).toBe('incomplete_date');
    const ym = parseDateCell('2024-03');
    expect(ym.ok).toBe(false);
    if (!ym.ok) expect(ym.error).toBe('incomplete_date');
  });

  it('実在しない日付は invalid_calendar_date', () => {
    const r = parseDateCell('2024-02-30');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('invalid_calendar_date');
  });

  it('解釈不能な文字列は unrecognized_format', () => {
    const r = parseDateCell('近日中');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('unrecognized_format');
  });
});
