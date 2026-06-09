import type { ChuinKey } from './types';

/**
 * 中陰の忌日一覧 (初七日〜七七日 + 百ヶ日)。
 * key は命日からの経過日数の名目値 (7 の倍数 / 100)。
 */
export const CHUIN_KEY_LIST: readonly ChuinKey[] = [
  7, 14, 21, 28, 35, 42, 49, 100,
] as const;

export const CHUIN_NAMES: Readonly<Record<ChuinKey, string>> = {
  7: '初七日',
  14: '二七日',
  21: '三七日',
  28: '四七日',
  35: '五七日',
  42: '六七日',
  49: '四十九日',
  100: '百ヶ日',
};

/** 忌日の別称 (慣習上の呼称)。無いものは null。 */
export const CHUIN_ALT_NAMES: Readonly<Record<ChuinKey, string | null>> = {
  7: null,
  14: null,
  21: null,
  28: null,
  35: null,
  42: null,
  49: '満中陰', // 七七日。中陰が満ちる日。
  100: '卒哭忌', // 百ヶ日。
};

/**
 * 各忌日の「命日を 1 日目と数えたときの日数」。
 *
 * 日本の数え方では命日当日を 1 日目とするため、初七日 (7 日目) は命日 + 6 日、
 * 四十九日 (49 日目) は命日 + 48 日になる。百ヶ日 (100 日目) は命日 + 99 日。
 * このマップはその「日目」の値そのものを保持し、計算側でオフセット (= 値 − 1) を取る。
 */
export const CHUIN_NOMINAL_DAYS: Readonly<Record<ChuinKey, number>> = {
  7: 7,
  14: 14,
  21: 21,
  28: 28,
  35: 35,
  42: 42,
  49: 49,
  100: 100,
};
