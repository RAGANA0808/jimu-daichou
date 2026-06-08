import { describe, expect, it } from 'vitest';
import { parseDeathDateCell } from './death-date-parse';

describe('parseDeathDateCell', () => {
  it('西暦 YYYY-MM-DD を FULL として解釈する', () => {
    const r = parseDeathDateCell('2024-03-15');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.precision).toBe('FULL');
      expect(r.value.year).toBe(2024);
      expect(r.value.month).toBe(3);
      expect(r.value.day).toBe(15);
      expect(r.value.date).not.toBeNull();
    }
  });

  it('スラッシュ・ドット区切りも解釈する', () => {
    expect(parseDeathDateCell('2024/3/15').ok).toBe(true);
    expect(parseDeathDateCell('2024.3.15').ok).toBe(true);
  });

  it('和暦 年月日 を西暦化する', () => {
    const r = parseDeathDateCell('令和6年3月15日');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.precision).toBe('FULL');
      expect(r.value.year).toBe(2024);
      expect(r.value.month).toBe(3);
      expect(r.value.day).toBe(15);
    }
  });

  it('和暦 元年 を西暦化する', () => {
    const r = parseDeathDateCell('令和元年5月1日');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.year).toBe(2019);
  });

  it('年のみ (西暦) は YEAR 精度', () => {
    const r = parseDeathDateCell('2024');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.precision).toBe('YEAR');
      expect(r.value.month).toBeNull();
      expect(r.value.date).toBeNull();
    }
  });

  it('年のみ (和暦・明治以前) は YEAR 精度', () => {
    const r = parseDeathDateCell('明治12年');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.precision).toBe('YEAR');
      expect(r.value.year).toBe(1879);
    }
  });

  it('年月のみは YEAR_MONTH 精度', () => {
    const r = parseDeathDateCell('2024年3月');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.precision).toBe('YEAR_MONTH');
      expect(r.value.month).toBe(3);
      expect(r.value.day).toBeNull();
    }
  });

  it('空・不明トークンは UNKNOWN 精度で取り込み可', () => {
    for (const t of ['', '不明', '不詳', '－']) {
      const r = parseDeathDateCell(t);
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.value.precision).toBe('UNKNOWN');
    }
  });

  it('全角数字を吸収する', () => {
    const r = parseDeathDateCell('２０２４年３月１５日');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.year).toBe(2024);
  });

  it('実在しない日付はエラー', () => {
    const r = parseDeathDateCell('2024-02-30');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('invalid_calendar_date');
  });

  it('読み取れない形式はエラー', () => {
    const r = parseDeathDateCell('去年の春');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('unrecognized_format');
  });
});
