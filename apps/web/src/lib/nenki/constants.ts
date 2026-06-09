import type { Kaiki } from './types';

export const KAIKI_LIST: readonly Kaiki[] = [1, 3, 7, 13, 17, 23, 27, 33, 37, 50] as const;

/**
 * 弔い上げ (年忌打ち切り) として選べる回忌。
 * 慣習上、三十三回忌または五十回忌で年忌を終えることが多い。
 */
export const MEMORIAL_CUTOFF_OPTIONS: readonly Kaiki[] = [33, 50] as const;

export const KAIKI_NAMES: Readonly<Record<Kaiki, string>> = {
  1: '一周忌',
  3: '三回忌',
  7: '七回忌',
  13: '十三回忌',
  17: '十七回忌',
  23: '二十三回忌',
  27: '二十七回忌',
  33: '三十三回忌',
  37: '三十七回忌',
  50: '五十回忌',
};
