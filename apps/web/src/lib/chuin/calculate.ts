import {
  CHUIN_ALT_NAMES,
  CHUIN_KEY_LIST,
  CHUIN_NAMES,
  CHUIN_NOMINAL_DAYS,
} from './constants';
import type { ChuinBaseDate, ChuinDay, ChuinKey } from './types';

export function isValidChuinKey(n: number): n is ChuinKey {
  return (CHUIN_KEY_LIST as readonly number[]).includes(n);
}

/**
 * 命日からのオフセット日数を加算した暦日を返す。
 *
 * 暦演算は JST 固定だが、加減算自体はタイムゾーンに依存しない (Date.UTC を使って
 * 正規化し、月跨ぎ・閏年・年跨ぎを JS の Date に正しく委ねる)。
 */
function addDays(base: ChuinBaseDate, offsetDays: number): ChuinBaseDate {
  // UTC 正午起点でずれを避けつつ日数を加算する。
  const d = new Date(Date.UTC(base.year, base.month - 1, base.day));
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
  };
}

/**
 * 命日から、指定の忌日 (ChuinKey) の暦日を算出する。
 *
 * 命日を 1 日目と数える日本の慣習に従い、初七日は命日 + 6 日、四十九日は命日 + 48 日、
 * 百ヶ日は命日 + 99 日となる。
 */
export function chuinDayOf(base: ChuinBaseDate, key: ChuinKey): ChuinDay {
  const nominal = CHUIN_NOMINAL_DAYS[key];
  const offset = nominal - 1; // 命日当日を 1 日目とするため −1。
  const resolved = addDays(base, offset);
  return {
    key,
    name: CHUIN_NAMES[key],
    altName: CHUIN_ALT_NAMES[key],
    daysFromDeath: nominal,
    year: resolved.year,
    month: resolved.month,
    day: resolved.day,
  };
}

/**
 * 命日を起点に、全忌日 (初七日〜四十九日 + 百ヶ日) の中陰表を算出する純関数。
 *
 * E05 中陰の中核。年忌 (lib/nenki) と同様、計算はここに集約しインライン計算を禁止する。
 *
 * @param base 命日 (年月日すべて判明している FULL 精度であること)。
 */
export function chuinScheduleOf(base: ChuinBaseDate): ChuinDay[] {
  return CHUIN_KEY_LIST.map((key) => chuinDayOf(base, key));
}
