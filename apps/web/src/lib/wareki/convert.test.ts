import { describe, expect, it } from 'vitest';
import { seirekiToWareki, warekiToSeireki } from './convert';

describe('seirekiToWareki', () => {
  it('明治元年の始まりの日 (1868-01-25) は 明治1年', () => {
    expect(seirekiToWareki({ year: 1868, month: 1, day: 25 })).toEqual({
      era: 'meiji',
      year: 1,
      month: 1,
      day: 25,
    });
  });

  it('明治最終日 (1912-07-29) は 明治45年', () => {
    expect(seirekiToWareki({ year: 1912, month: 7, day: 29 })).toEqual({
      era: 'meiji',
      year: 45,
      month: 7,
      day: 29,
    });
  });

  it('大正初日 (1912-07-30) は 大正1年', () => {
    expect(seirekiToWareki({ year: 1912, month: 7, day: 30 })).toEqual({
      era: 'taisho',
      year: 1,
      month: 7,
      day: 30,
    });
  });

  it('昭和最終日 (1989-01-07) は 昭和64年', () => {
    expect(seirekiToWareki({ year: 1989, month: 1, day: 7 })).toEqual({
      era: 'showa',
      year: 64,
      month: 1,
      day: 7,
    });
  });

  it('平成初日 (1989-01-08) は 平成1年', () => {
    expect(seirekiToWareki({ year: 1989, month: 1, day: 8 })).toEqual({
      era: 'heisei',
      year: 1,
      month: 1,
      day: 8,
    });
  });

  it('平成最終日 (2019-04-30) は 平成31年', () => {
    expect(seirekiToWareki({ year: 2019, month: 4, day: 30 })).toEqual({
      era: 'heisei',
      year: 31,
      month: 4,
      day: 30,
    });
  });

  it('令和初日 (2019-05-01) は 令和1年', () => {
    expect(seirekiToWareki({ year: 2019, month: 5, day: 1 })).toEqual({
      era: 'reiwa',
      year: 1,
      month: 5,
      day: 1,
    });
  });

  it('令和6年 (2024) 普通の日付', () => {
    expect(seirekiToWareki({ year: 2024, month: 3, day: 15 })).toEqual({
      era: 'reiwa',
      year: 6,
      month: 3,
      day: 15,
    });
  });

  it('明治以前 (1867-12-31) はエラー', () => {
    expect(() => seirekiToWareki({ year: 1867, month: 12, day: 31 })).toThrow(RangeError);
  });

  it('不正な日付 (2024-02-30) はエラー', () => {
    expect(() => seirekiToWareki({ year: 2024, month: 2, day: 30 })).toThrow(RangeError);
  });

  it('2024-02-29 (うるう年) は有効', () => {
    expect(seirekiToWareki({ year: 2024, month: 2, day: 29 })).toEqual({
      era: 'reiwa',
      year: 6,
      month: 2,
      day: 29,
    });
  });
});

describe('warekiToSeireki', () => {
  it('令和元年5月1日 は 2019-05-01', () => {
    expect(warekiToSeireki({ era: 'reiwa', year: 1, month: 5, day: 1 })).toEqual({
      year: 2019,
      month: 5,
      day: 1,
    });
  });

  it('昭和64年1月7日 は 1989-01-07', () => {
    expect(warekiToSeireki({ era: 'showa', year: 64, month: 1, day: 7 })).toEqual({
      year: 1989,
      month: 1,
      day: 7,
    });
  });

  it('昭和64年1月8日 はエラー (昭和は 1/7 で終わり)', () => {
    expect(() => warekiToSeireki({ era: 'showa', year: 64, month: 1, day: 8 })).toThrow(RangeError);
  });

  it('平成元年1月7日 はエラー (平成は 1/8 から)', () => {
    expect(() => warekiToSeireki({ era: 'heisei', year: 1, month: 1, day: 7 })).toThrow(RangeError);
  });

  it('平成元年1月8日 は 1989-01-08', () => {
    expect(warekiToSeireki({ era: 'heisei', year: 1, month: 1, day: 8 })).toEqual({
      year: 1989,
      month: 1,
      day: 8,
    });
  });

  it('明治1年1月24日 はエラー (明治は 1/25 から)', () => {
    expect(() => warekiToSeireki({ era: 'meiji', year: 1, month: 1, day: 24 })).toThrow(RangeError);
  });

  it('年=0 はエラー', () => {
    expect(() => warekiToSeireki({ era: 'reiwa', year: 0, month: 5, day: 1 })).toThrow(RangeError);
  });

  it('不正な日付 (令和6年2月30日) はエラー', () => {
    expect(() => warekiToSeireki({ era: 'reiwa', year: 6, month: 2, day: 30 })).toThrow(RangeError);
  });
});

describe('ラウンドトリップ', () => {
  const samples: { year: number; month: number; day: number }[] = [
    { year: 1868, month: 1, day: 25 },
    { year: 1900, month: 6, day: 15 },
    { year: 1925, month: 12, day: 24 },
    { year: 1926, month: 12, day: 25 },
    { year: 1989, month: 1, day: 7 },
    { year: 1989, month: 1, day: 8 },
    { year: 2019, month: 4, day: 30 },
    { year: 2019, month: 5, day: 1 },
    { year: 2024, month: 2, day: 29 },
    { year: 2026, month: 4, day: 23 },
  ];

  for (const s of samples) {
    it(`${s.year}-${s.month}-${s.day} を変換しても元に戻る`, () => {
      const w = seirekiToWareki(s);
      expect(warekiToSeireki(w)).toEqual(s);
    });
  }
});
