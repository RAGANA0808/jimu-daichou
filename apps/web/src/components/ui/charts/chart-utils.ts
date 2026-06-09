/**
 * 自作 SVG チャート共通ユーティリティ。
 * 新規依存を入れず、純粋関数のみで構成する (server component から利用可)。
 */

/** 金額・件数の既定フォーマッタ (日本語ロケールの桁区切り)。 */
export function defaultValueFormatter(n: number): string {
  return n.toLocaleString('ja-JP');
}

/**
 * 棒グラフ用の上端スケール。全値 0 以下 (全 0 / 全負) でも 0 除算しないよう
 * 最小でも 1 を返す。負値は 0 にクランプした正方向棒のみを扱う前提。
 */
export function barScaleMax(values: number[]): number {
  let max = 0;
  for (const v of values) {
    if (v > max) max = v;
  }
  return max <= 0 ? 1 : max;
}

/**
 * 折れ線用の {min,max} レンジ。負値 (返金・赤字) も折れ線が下に伸びるよう
 * min/max 双方を返す。全点同値 (典型的には全 0) で max-min===0 のときは
 * 0 除算を避けるためダミーレンジ [-1, +1] にフォールバックし全点を中央に描く。
 */
export function lineRange(values: number[]): { min: number; max: number } {
  const first = values[0];
  if (first === undefined) return { min: -1, max: 1 };
  let min = first;
  let max = first;
  for (const v of values) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  if (max - min === 0) {
    return { min: min - 1, max: max + 1 };
  }
  return { min, max };
}
