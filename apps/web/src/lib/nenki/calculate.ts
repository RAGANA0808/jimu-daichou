import { KAIKI_LIST, KAIKI_NAMES } from './constants';
import type { Anniversary, DeathDate, Kaiki } from './types';

export function isValidKaiki(n: number): n is Kaiki {
  return (KAIKI_LIST as readonly number[]).includes(n);
}

/**
 * 法要年を計算する。
 * - 一周忌: 没年 + 1
 * - 三回忌以降: 没年 + (回忌数 − 1)
 */
export function anniversaryYear(deathYear: number, kaiki: Kaiki): number {
  if (kaiki === 1) return deathYear + 1;
  return deathYear + (kaiki - 1);
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * 命日が 2/29 で、法要年が閏年ではない場合は 3/1 にずらす（寺院慣習）。
 * それ以外はそのまま返す。
 */
function adjustForLeapDay(
  month: number | null,
  day: number | null,
  targetYear: number,
): { month: number | null; day: number | null } {
  if (month === 2 && day === 29 && !isLeapYear(targetYear)) {
    return { month: 3, day: 1 };
  }
  return { month, day };
}

/** 1 人の故人について、全回忌の予定を配列で返す */
export function allAnniversariesOf(deathDate: DeathDate): Anniversary[] {
  return KAIKI_LIST.map((kaiki) => {
    const year = anniversaryYear(deathDate.year, kaiki);
    const { month, day } = adjustForLeapDay(deathDate.month, deathDate.day, year);
    return {
      kaiki,
      name: KAIKI_NAMES[kaiki],
      year,
      month,
      day,
    };
  });
}

/** 指定の故人について、指定年に該当する回忌があれば返す (無ければ null) */
export function anniversaryInYearFor(
  deathDate: DeathDate,
  targetYear: number,
): Anniversary | null {
  for (const kaiki of KAIKI_LIST) {
    if (anniversaryYear(deathDate.year, kaiki) === targetYear) {
      const { month, day } = adjustForLeapDay(deathDate.month, deathDate.day, targetYear);
      return {
        kaiki,
        name: KAIKI_NAMES[kaiki],
        year: targetYear,
        month,
        day,
      };
    }
  }
  return null;
}

/**
 * 故人リストと対象年を渡すと、その年に年忌を迎える人を抽出する。
 * 年忌表（案内状）生成の中核ヘルパ。
 */
export function findAnniversariesInYear<T extends { deathDate: DeathDate }>(
  deceasedList: readonly T[],
  targetYear: number,
): Array<T & { anniversary: Anniversary }> {
  const results: Array<T & { anniversary: Anniversary }> = [];
  for (const d of deceasedList) {
    const anniversary = anniversaryInYearFor(d.deathDate, targetYear);
    if (anniversary) {
      results.push({ ...d, anniversary });
    }
  }
  return results;
}
