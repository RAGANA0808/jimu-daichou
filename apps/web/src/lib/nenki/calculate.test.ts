import { describe, expect, it } from 'vitest';
import {
  allAnniversariesOf,
  anniversaryInYearFor,
  anniversaryYear,
  findAnniversariesInYear,
  isValidKaiki,
} from './calculate';
import { KAIKI_LIST } from './constants';

describe('anniversaryYear', () => {
  it('一周忌は 没年 + 1', () => {
    expect(anniversaryYear(2020, 1)).toBe(2021);
  });

  it('三回忌は 没年 + 2', () => {
    expect(anniversaryYear(2020, 3)).toBe(2022);
  });

  it('七回忌は 没年 + 6', () => {
    expect(anniversaryYear(2020, 7)).toBe(2026);
  });

  it('十三回忌は 没年 + 12', () => {
    expect(anniversaryYear(2020, 13)).toBe(2032);
  });

  it('五十回忌は 没年 + 49', () => {
    expect(anniversaryYear(2020, 50)).toBe(2069);
  });
});

describe('isValidKaiki', () => {
  it('正しい回忌は true', () => {
    for (const k of KAIKI_LIST) {
      expect(isValidKaiki(k)).toBe(true);
    }
  });

  it('定義外の回忌は false', () => {
    expect(isValidKaiki(2)).toBe(false);
    expect(isValidKaiki(5)).toBe(false);
    expect(isValidKaiki(100)).toBe(false);
    expect(isValidKaiki(0)).toBe(false);
  });
});

describe('allAnniversariesOf', () => {
  it('仕様ドキュメントの例: 2020-03-15 の年忌一覧が一致する', () => {
    const result = allAnniversariesOf({ year: 2020, month: 3, day: 15 });
    const byKaiki = Object.fromEntries(result.map((a) => [a.kaiki, a.year]));
    expect(byKaiki[1]).toBe(2021);
    expect(byKaiki[3]).toBe(2022);
    expect(byKaiki[7]).toBe(2026);
    expect(byKaiki[13]).toBe(2032);
    expect(byKaiki[50]).toBe(2069);
  });

  it('全 10 回忌ぶん返る', () => {
    const result = allAnniversariesOf({ year: 2020, month: 3, day: 15 });
    expect(result).toHaveLength(10);
  });

  it('名称が付与される', () => {
    const result = allAnniversariesOf({ year: 2020, month: 3, day: 15 });
    expect(result.find((a) => a.kaiki === 1)?.name).toBe('一周忌');
    expect(result.find((a) => a.kaiki === 33)?.name).toBe('三十三回忌');
  });

  it('月日不明 (null) はそのまま null で返される', () => {
    const result = allAnniversariesOf({ year: 2020, month: null, day: null });
    for (const a of result) {
      expect(a.month).toBeNull();
      expect(a.day).toBeNull();
    }
  });

  it('命日 2/29: 法要年が閏年なら 2/29 のまま、非閏年なら 3/1 に補正', () => {
    // 2020-02-29 没。一周忌 = 2021 (非閏年) → 3/1
    const result = allAnniversariesOf({ year: 2020, month: 2, day: 29 });
    const isshuuki = result.find((a) => a.kaiki === 1);
    expect(isshuuki).toEqual({ kaiki: 1, name: '一周忌', year: 2021, month: 3, day: 1 });

    // 二十七回忌 = 2046 (非閏) → 3/1
    const nijuunanakaiki = result.find((a) => a.kaiki === 27);
    expect(nijuunanakaiki?.month).toBe(3);
    expect(nijuunanakaiki?.day).toBe(1);

    // 三十三回忌 = 2052 (閏年) → 2/29 のまま
    const sanjuusankaiki = result.find((a) => a.kaiki === 33);
    expect(sanjuusankaiki?.month).toBe(2);
    expect(sanjuusankaiki?.day).toBe(29);
  });
});

describe('anniversaryInYearFor', () => {
  it('該当年なら回忌を返す', () => {
    const result = anniversaryInYearFor({ year: 2020, month: 3, day: 15 }, 2026);
    expect(result).toEqual({
      kaiki: 7,
      name: '七回忌',
      year: 2026,
      month: 3,
      day: 15,
    });
  });

  it('該当年でなければ null', () => {
    expect(anniversaryInYearFor({ year: 2020, month: 3, day: 15 }, 2025)).toBeNull();
  });

  it('没年自体 (0 年目) は null (年忌対象外)', () => {
    expect(anniversaryInYearFor({ year: 2020, month: 3, day: 15 }, 2020)).toBeNull();
  });

  it('2/29 命日の閏年補正が効く', () => {
    const result = anniversaryInYearFor({ year: 2020, month: 2, day: 29 }, 2021);
    expect(result?.month).toBe(3);
    expect(result?.day).toBe(1);
  });
});

describe('findAnniversariesInYear', () => {
  const deceased = [
    { id: 'a', deathDate: { year: 2020, month: 3, day: 15 } },
    { id: 'b', deathDate: { year: 2019, month: 5, day: 20 } }, // 七回忌 2025
    { id: 'c', deathDate: { year: 2013, month: 12, day: 1 } }, // 十三回忌 2025
    { id: 'd', deathDate: { year: 2018, month: 1, day: 1 } }, // どれにも該当しない
  ];

  it('2025 年の年忌該当者を抽出', () => {
    const result = findAnniversariesInYear(deceased, 2025);
    const ids = result.map((r) => r.id).sort();
    expect(ids).toEqual(['b', 'c']);
  });

  it('2026 年の年忌該当者を抽出 (七回忌 a)', () => {
    const result = findAnniversariesInYear(deceased, 2026);
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe('a');
    expect(result[0]!.anniversary.kaiki).toBe(7);
  });

  it('該当者ゼロ年は空配列', () => {
    // 2023 は a/b/c/d いずれの年忌年にも該当しない
    const result = findAnniversariesInYear(deceased, 2023);
    expect(result).toEqual([]);
  });

  it('元オブジェクトのフィールドは保持される', () => {
    const extended = [
      { id: 'x', kaimyo: '釈浄雲', deathDate: { year: 2020, month: 3, day: 15 } },
    ];
    const result = findAnniversariesInYear(extended, 2021);
    expect(result[0]?.kaimyo).toBe('釈浄雲');
    expect(result[0]?.anniversary.kaiki).toBe(1);
  });
});
