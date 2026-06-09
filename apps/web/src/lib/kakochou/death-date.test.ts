import { describe, expect, it } from 'vitest';
import {
  deathDateSortKey,
  formatDeathDateSeireki,
  monthDaySortKey,
  parseDeathDate,
} from './death-date';

describe('parseDeathDate', () => {
  it('年月日すべて揃えば FULL で Date を持つ', () => {
    const r = parseDeathDate({ year: 2024, month: 3, day: 15 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.precision).toBe('FULL');
    expect(r.value.date?.getUTCFullYear()).toBe(2024);
    expect(r.value.date?.getUTCMonth()).toBe(2);
    expect(r.value.date?.getUTCDate()).toBe(15);
  });

  it('年月のみは YEAR_MONTH、date は null', () => {
    const r = parseDeathDate({ year: 1945, month: 8, day: null });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.precision).toBe('YEAR_MONTH');
    expect(r.value.day).toBeNull();
    expect(r.value.date).toBeNull();
  });

  it('年のみは YEAR', () => {
    const r = parseDeathDate({ year: 1700, month: null, day: null });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.precision).toBe('YEAR');
    expect(r.value.year).toBe(1700);
    expect(r.value.month).toBeNull();
  });

  it('明治以前 (江戸期) の年も受け付ける', () => {
    const r = parseDeathDate({ year: 1650, month: 12, day: 1 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.precision).toBe('FULL');
  });

  it('すべて未入力は UNKNOWN', () => {
    const r = parseDeathDate({ year: null, month: null, day: null });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.precision).toBe('UNKNOWN');
    expect(r.value.date).toBeNull();
  });

  it('年なしで月だけ入れるとエラー', () => {
    const r = parseDeathDate({ year: null, month: 5, day: null });
    expect(r).toEqual({ ok: false, error: 'year_required_for_month' });
  });

  it('月なしで日だけ入れるとエラー', () => {
    const r = parseDeathDate({ year: 2000, month: null, day: 10 });
    expect(r).toEqual({ ok: false, error: 'month_required_for_day' });
  });

  it('実在しない日 (2/30) を弾く', () => {
    const r = parseDeathDate({ year: 2023, month: 2, day: 30 });
    expect(r).toEqual({ ok: false, error: 'invalid_calendar_date' });
  });

  it('閏年の 2/29 は許容する', () => {
    const r = parseDeathDate({ year: 2024, month: 2, day: 29 });
    expect(r.ok).toBe(true);
  });

  it('平年の 2/29 は弾く', () => {
    const r = parseDeathDate({ year: 2023, month: 2, day: 29 });
    expect(r).toEqual({ ok: false, error: 'invalid_calendar_date' });
  });

  it('範囲外の月を弾く', () => {
    expect(parseDeathDate({ year: 2000, month: 13, day: null })).toEqual({
      ok: false,
      error: 'month_out_of_range',
    });
  });

  it('範囲外の年を弾く', () => {
    expect(parseDeathDate({ year: 0, month: null, day: null })).toEqual({
      ok: false,
      error: 'year_out_of_range',
    });
  });
});

describe('formatDeathDateSeireki', () => {
  it('精度ごとに欠落を伏せる', () => {
    expect(
      formatDeathDateSeireki({ precision: 'FULL', year: 2024, month: 3, day: 15 }),
    ).toBe('2024年3月15日');
    expect(
      formatDeathDateSeireki({ precision: 'YEAR_MONTH', year: 2024, month: 3, day: null }),
    ).toBe('2024年3月');
    expect(
      formatDeathDateSeireki({ precision: 'YEAR', year: 2024, month: null, day: null }),
    ).toBe('2024年');
    expect(
      formatDeathDateSeireki({ precision: 'UNKNOWN', year: null, month: null, day: null }),
    ).toBe('不明');
  });
});

describe('deathDateSortKey', () => {
  it('年→月→日の昇順キーを返す', () => {
    expect(deathDateSortKey({ year: 2024, month: 3, day: 15 })).toEqual([2024, 3, 15]);
  });

  it('不明欄は最後に回る (巨大値)', () => {
    const known = deathDateSortKey({ year: 2024, month: null, day: null });
    const unknown = deathDateSortKey({ year: null, month: null, day: null });
    expect(known[0]).toBeLessThan(unknown[0]);
    expect(known[1]).toBeGreaterThan(0);
  });

  it('配列比較で昇順に並ぶ', () => {
    const rows = [
      { year: 2020, month: 5, day: 1 },
      { year: 1999, month: 12, day: 31 },
      { year: 2020, month: 5, day: null },
    ];
    const sorted = [...rows].sort((a, b) => {
      const ka = deathDateSortKey(a);
      const kb = deathDateSortKey(b);
      return ka[0] - kb[0] || ka[1] - kb[1] || ka[2] - kb[2];
    });
    expect(sorted.map((r) => r.year)).toEqual([1999, 2020, 2020]);
    // 同年同月で日不明は後ろ
    expect(sorted[1]?.day).toBe(1);
    expect(sorted[2]?.day).toBeNull();
  });
});

describe('monthDaySortKey', () => {
  it('月→日の昇順キー、不明は最後', () => {
    expect(monthDaySortKey({ month: 3, day: 15 })).toEqual([3, 15]);
    expect(monthDaySortKey({ month: null, day: null })).toEqual([99, 99]);
  });
});
