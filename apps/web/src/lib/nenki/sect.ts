/**
 * 宗派キー。Prisma の `Sect` enum の値と文字列が一致する (純粋に保つため
 * Prisma 型を import せず、ここで独立に定義する)。
 */
export type SectKey =
  | 'SOTO'
  | 'RINZAI'
  | 'OBAKU'
  | 'TENDAI'
  | 'SHINGON'
  | 'JODO'
  | 'JODO_SHINSHU_HONGANJI'
  | 'SHINSHU_OTANI'
  | 'NICHIREN'
  | 'JISHU'
  | 'OTHER';

/** 宗派の日本語表示ラベル。 */
export const SECT_LABELS: Record<SectKey, string> = {
  SOTO: '曹洞宗',
  RINZAI: '臨済宗',
  OBAKU: '黄檗宗',
  TENDAI: '天台宗',
  SHINGON: '真言宗',
  JODO: '浄土宗',
  JODO_SHINSHU_HONGANJI: '浄土真宗本願寺派',
  SHINSHU_OTANI: '真宗大谷派',
  NICHIREN: '日蓮宗',
  JISHU: '時宗',
  OTHER: 'その他',
};

/** UI の select 用 {value,label}[]。表示順は SECT_LABELS の宣言順に従う。 */
export const SECT_OPTIONS: ReadonlyArray<{ value: SectKey; label: string }> = (
  Object.keys(SECT_LABELS) as SectKey[]
).map((value) => ({ value, label: SECT_LABELS[value] }));

/**
 * 宗派ごとの年忌「既定弔い上げ」プリセット (目安)。
 * - 浄土真宗系 (本願寺派・大谷派) のみ三十三回忌 (33) を既定とする。
 * - それ以外は null = 打ち切りなし (五十回忌まで=現状維持)。
 * これは「目安の既定」であり、故人ごとの memorialCutoffAnniversary が常に優先される。
 */
export const NENKI_SECT_PRESETS: Record<SectKey, { defaultCutoff: number | null }> = {
  SOTO: { defaultCutoff: null },
  RINZAI: { defaultCutoff: null },
  OBAKU: { defaultCutoff: null },
  TENDAI: { defaultCutoff: null },
  SHINGON: { defaultCutoff: null },
  JODO: { defaultCutoff: null },
  JODO_SHINSHU_HONGANJI: { defaultCutoff: 33 },
  SHINSHU_OTANI: { defaultCutoff: 33 },
  NICHIREN: { defaultCutoff: null },
  JISHU: { defaultCutoff: null },
  OTHER: { defaultCutoff: null },
};

/** SectKey として有効な文字列かを型ガードで判定する (DB 由来の string 検証等に使う)。 */
export function isValidSect(value: string): value is SectKey {
  return value in SECT_LABELS;
}

/**
 * 宗派の既定弔い上げ回忌を返す。
 * - 未設定 (null) / 未知の文字列は null = 標準スケジュール (五十回忌まで)。
 * - 故人ごとの cutoff は呼び出し側で `entryCutoff ?? getSectDefaultCutoff(sect)` と
 *   合成すること (per-entry が常に優先)。
 */
export function getSectDefaultCutoff(sect: string | null): number | null {
  if (sect === null || !isValidSect(sect)) return null;
  return NENKI_SECT_PRESETS[sect].defaultCutoff;
}
