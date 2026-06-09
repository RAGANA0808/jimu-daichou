/**
 * 科目テンプレ + 世帯別 初期金額 から、世帯ごとの科目行を解決する (純関数)。
 *
 * 各科目は連動元 (amountSource) を持ち、NONE なら defaultAmount を、
 * MAINTENANCE_FEE / GRAVE_MAINTENANCE ならその世帯の当年度請求額を初期値に使う。
 * 請求が無い世帯は defaultAmount にフォールバックする (請求未生成でも空にしない)。
 */

import type { PostalSubjectLine } from './amount';

/** 連動元の種別 (Prisma enum と同値だが、純関数を独立させるため文字列で受ける)。 */
export type AmountSourceKey = 'NONE' | 'MAINTENANCE_FEE' | 'GRAVE_MAINTENANCE';

/** 科目テンプレの解決に必要な最小情報。 */
export type SubjectTemplate = {
  id: string;
  name: string;
  defaultAmount: number;
  isVisible: boolean;
  amountSource: AmountSourceKey;
};

/** 世帯 1 件分の連動元別 初期金額 (請求が無い source は欠落)。 */
export type HouseholdSourceAmounts = Partial<Record<AmountSourceKey, number>>;

/**
 * 1 世帯分の科目行を解決する (純関数)。
 * - isVisible=false の科目は除外。
 * - 連動元に当年度請求額があればそれを、無ければ defaultAmount を採用。
 */
export function resolveSubjectLines(
  subjects: SubjectTemplate[],
  sourceAmounts: HouseholdSourceAmounts,
): PostalSubjectLine[] {
  return subjects
    .filter((s) => s.isVisible)
    .map((s) => {
      const fromSource =
        s.amountSource !== 'NONE' ? sourceAmounts[s.amountSource] : undefined;
      const amount =
        typeof fromSource === 'number' ? fromSource : s.defaultAmount;
      return { subjectId: s.id, name: s.name, amount };
    });
}
