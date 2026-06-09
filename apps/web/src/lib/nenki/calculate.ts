import { KAIKI_LIST, KAIKI_NAMES, MEMORIAL_CUTOFF_OPTIONS } from './constants';
import type { Anniversary, DeathDate, Kaiki } from './types';

export function isValidKaiki(n: number): n is Kaiki {
  return (KAIKI_LIST as readonly number[]).includes(n);
}

/**
 * 弔い上げ回忌として有効な値か判定する (33 / 50)。
 * 故人ごとの打ち切り設定のバリデーションに使う。
 */
export function isValidMemorialCutoff(n: number): n is Kaiki {
  return (MEMORIAL_CUTOFF_OPTIONS as readonly number[]).includes(n);
}

/**
 * 指定の回忌が、弔い上げ設定の範囲内 (案内対象) かを判定する。
 * - cutoff が null/undefined の場合は打ち切りなし (従来どおり全回忌が対象)。
 * - cutoff が設定されている場合は、その回忌までを対象とし、超えた回忌は除外する
 *   (例: cutoff=33 なら三十三回忌までが対象、三十七回忌以降は対象外)。
 */
export function isKaikiWithinCutoff(
  kaiki: Kaiki,
  cutoff: number | null | undefined,
): boolean {
  if (cutoff === null || cutoff === undefined) return true;
  return kaiki <= cutoff;
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

/**
 * 1 人の故人について、全回忌の予定を配列で返す。
 *
 * @param cutoff 弔い上げ回忌 (33/50 等)。指定すると、その回忌を超える年忌は除外する。
 *               null/undefined は打ち切りなし (五十回忌まで全て返す)。
 */
export function allAnniversariesOf(
  deathDate: DeathDate,
  cutoff?: number | null,
): Anniversary[] {
  return KAIKI_LIST.filter((kaiki) => isKaikiWithinCutoff(kaiki, cutoff)).map(
    (kaiki) => {
      const year = anniversaryYear(deathDate.year, kaiki);
      const { month, day } = adjustForLeapDay(deathDate.month, deathDate.day, year);
      return {
        kaiki,
        name: KAIKI_NAMES[kaiki],
        year,
        month,
        day,
      };
    },
  );
}

/**
 * 指定の故人について、指定年に該当する回忌があれば返す (無ければ null)。
 *
 * @param cutoff 弔い上げ回忌。該当回忌が打ち切りを超えていれば、弔い上げ済みとして null を返す。
 */
export function anniversaryInYearFor(
  deathDate: DeathDate,
  targetYear: number,
  cutoff?: number | null,
): Anniversary | null {
  for (const kaiki of KAIKI_LIST) {
    if (anniversaryYear(deathDate.year, kaiki) === targetYear) {
      if (!isKaikiWithinCutoff(kaiki, cutoff)) {
        // 弔い上げ済み (打ち切り回忌を超えている) ため、案内対象外。
        return null;
      }
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
 *
 * 各故人が `memorialCutoff` (弔い上げ回忌) を持つ場合、打ち切り回忌を超えた年忌は
 * 対象から除外する (弔い上げ済みの故人は年忌表・案内対象に含めない)。
 */
export function findAnniversariesInYear<
  T extends { deathDate: DeathDate; memorialCutoff?: number | null },
>(
  deceasedList: readonly T[],
  targetYear: number,
): Array<T & { anniversary: Anniversary }> {
  const results: Array<T & { anniversary: Anniversary }> = [];
  for (const d of deceasedList) {
    const anniversary = anniversaryInYearFor(d.deathDate, targetYear, d.memorialCutoff);
    if (anniversary) {
      results.push({ ...d, anniversary });
    }
  }
  return results;
}
