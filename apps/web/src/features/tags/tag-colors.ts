/**
 * 自由タグの配色定義。
 *
 * Tag.color は String? カラムだが、許容値はここで列挙する固定キーに限定する。
 * Tailwind JIT purge 対策で配色は完全クラス文字列をベタ書きし、動的連結は禁止
 * (既存 INTERACTION_CATEGORY_CHIP_CLASS と同方針)。
 */

export const TAG_COLORS = [
  'NEUTRAL',
  'AMBER',
  'ROSE',
  'SKY',
  'EMERALD',
  'VIOLET',
  'SLATE',
] as const;

export type TagColor = (typeof TAG_COLORS)[number];

export const DEFAULT_TAG_COLOR: TagColor = 'NEUTRAL';

/** color 文字列を許容キーへ正規化する。未知値・null は既定 NEUTRAL。 */
export function normalizeTagColor(value: string | null | undefined): TagColor {
  if (value && (TAG_COLORS as readonly string[]).includes(value)) {
    return value as TagColor;
  }
  return DEFAULT_TAG_COLOR;
}

/**
 * タグチップの配色。JIT purge 対策で完全クラス文字列をベタ書きする。
 */
export const TAG_COLOR_CHIP_CLASS: Record<TagColor, string> = {
  NEUTRAL: 'border-border bg-muted text-muted-foreground',
  AMBER: 'border-amber-300 bg-amber-50 text-amber-800',
  ROSE: 'border-rose-300 bg-rose-50 text-rose-800',
  SKY: 'border-sky-300 bg-sky-50 text-sky-800',
  EMERALD: 'border-emerald-300 bg-emerald-50 text-emerald-800',
  VIOLET: 'border-violet-300 bg-violet-50 text-violet-800',
  SLATE: 'border-slate-300 bg-slate-100 text-slate-700',
};

/** 色選択 UI 用の日本語ラベル。 */
export const TAG_COLOR_LABELS: Record<TagColor, string> = {
  NEUTRAL: 'グレー',
  AMBER: '琥珀',
  ROSE: '桃',
  SKY: '空',
  EMERALD: '緑',
  VIOLET: '菫',
  SLATE: '灰',
};

/**
 * 色選択 UI の見本 (スウォッチ) 用の塗り色クラス。
 * 漢字ラベルだけでは色が伝わらないため、実際の色丸で選べるようにする。
 * JIT purge 対策で完全クラス文字列をベタ書きする。
 */
export const TAG_COLOR_SWATCH_CLASS: Record<TagColor, string> = {
  NEUTRAL: 'bg-gray-300',
  AMBER: 'bg-amber-400',
  ROSE: 'bg-rose-400',
  SKY: 'bg-sky-400',
  EMERALD: 'bg-emerald-400',
  VIOLET: 'bg-violet-400',
  SLATE: 'bg-slate-400',
};
