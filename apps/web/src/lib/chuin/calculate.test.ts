import { describe, expect, it } from 'vitest';
import { chuinDayOf, chuinScheduleOf, isValidChuinKey } from './calculate';
import { CHUIN_KEY_LIST } from './constants';
import type { ChuinBaseDate } from './types';

/** テスト用の参照実装: UTC で純粋に日数を足して暦日を得る。 */
function refAddDays(base: ChuinBaseDate, offset: number) {
  const d = new Date(Date.UTC(base.year, base.month - 1, base.day));
  d.setUTCDate(d.getUTCDate() + offset);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
  };
}

describe('isValidChuinKey', () => {
  it('忌日として有効な値を判定する', () => {
    expect(isValidChuinKey(7)).toBe(true);
    expect(isValidChuinKey(49)).toBe(true);
    expect(isValidChuinKey(100)).toBe(true);
  });

  it('無効な値を弾く', () => {
    expect(isValidChuinKey(1)).toBe(false);
    expect(isValidChuinKey(50)).toBe(false);
    expect(isValidChuinKey(0)).toBe(false);
  });
});

describe('chuinDayOf', () => {
  it('初七日は命日 + 6 日 (命日を 1 日目と数える)', () => {
    const base = { year: 2024, month: 1, day: 1 };
    expect(chuinDayOf(base, 7)).toMatchObject({
      key: 7,
      name: '初七日',
      altName: null,
      daysFromDeath: 7,
      year: 2024,
      month: 1,
      day: 7,
    });
  });

  it('四十九日 (満中陰) は命日 + 48 日で別称を持つ', () => {
    const base = { year: 2024, month: 1, day: 1 };
    expect(chuinDayOf(base, 49)).toMatchObject({
      key: 49,
      name: '四十九日',
      altName: '満中陰',
      daysFromDeath: 49,
      year: 2024,
      month: 2,
      day: 18, // 1/1 + 48 日
    });
  });

  it('百ヶ日 (卒哭忌) は命日 + 99 日', () => {
    const base = { year: 2024, month: 1, day: 1 };
    expect(chuinDayOf(base, 100)).toMatchObject({
      key: 100,
      name: '百ヶ日',
      altName: '卒哭忌',
      year: 2024,
      month: 4,
      day: 9, // 1/1 + 99 日 (閏年)
    });
  });
});

describe('chuinScheduleOf', () => {
  it('全忌日 (8 件) を昇順で返す', () => {
    const schedule = chuinScheduleOf({ year: 2024, month: 6, day: 5 });
    expect(schedule).toHaveLength(CHUIN_KEY_LIST.length);
    expect(schedule.map((c) => c.key)).toEqual([7, 14, 21, 28, 35, 42, 49, 100]);
  });

  it('参照実装 (UTC 日数加算) と一致する', () => {
    const base = { year: 2025, month: 3, day: 10 };
    for (const c of chuinScheduleOf(base)) {
      const expected = refAddDays(base, c.daysFromDeath - 1);
      expect({ year: c.year, month: c.month, day: c.day }).toEqual(expected);
    }
  });

  // --- 境界: 年跨ぎ ---
  it('年末命日で初七日が翌年に跨ぐ', () => {
    const schedule = chuinScheduleOf({ year: 2023, month: 12, day: 28 });
    const shonanoka = schedule.find((c) => c.key === 7)!;
    expect(shonanoka).toMatchObject({ year: 2024, month: 1, day: 3 });
  });

  // --- 境界: 月跨ぎ ---
  it('月末命日で四十九日が複数月を跨ぐ', () => {
    const schedule = chuinScheduleOf({ year: 2025, month: 1, day: 31 });
    const shijukunichi = schedule.find((c) => c.key === 49)!;
    // 1/31 + 48 日 = 3/20 (平年)
    expect(shijukunichi).toMatchObject({ year: 2025, month: 3, day: 20 });
  });

  // --- 境界: 閏年 (2/29 を跨ぐ) ---
  it('閏年の 2/29 を跨ぐ計算が正しい', () => {
    // 2024 は閏年。2/15 起点の四十九日 (+48 日) は 2/29 を含めて数える。
    const schedule = chuinScheduleOf({ year: 2024, month: 2, day: 15 });
    const shijukunichi = schedule.find((c) => c.key === 49)!;
    // 2/15 → 2/29 (14 日) 残り 34 日 → 3 月 (31 日) を超えて 4/3
    expect(shijukunichi).toMatchObject({ year: 2024, month: 4, day: 3 });
  });

  it('命日が 2/29 (閏年) でも忌日を算出できる', () => {
    const schedule = chuinScheduleOf({ year: 2024, month: 2, day: 29 });
    const shonanoka = schedule.find((c) => c.key === 7)!;
    expect(shonanoka).toMatchObject({ year: 2024, month: 3, day: 6 });
  });

  // --- 平年では 2/29 が存在しない月跨ぎ ---
  it('平年 2 月起点の計算 (2/29 なし)', () => {
    const schedule = chuinScheduleOf({ year: 2025, month: 2, day: 15 });
    const shijukunichi = schedule.find((c) => c.key === 49)!;
    // 平年: 2/15 → 2/28 (13 日) 残り 35 日 → 4/4
    expect(shijukunichi).toMatchObject({ year: 2025, month: 4, day: 4 });
  });
});
