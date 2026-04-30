/**
 * 区画地図の座標制約・スナップ関連ユーティリティ。
 * サーバー / クライアント両方から参照される純粋関数。
 */

export const TILE_SIZE = 48;
export const GRID_SNAP = 24;

export function snapToGrid(value: number): number {
  return Math.round(value / GRID_SNAP) * GRID_SNAP;
}

export function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

/**
 * 配置座標を canvas 内に収める (タイル全体が canvas 内に入るように)。
 */
export function normalizePosition(
  rawX: number,
  rawY: number,
  canvasWidth: number,
  canvasHeight: number,
): { x: number; y: number } {
  const x = clamp(snapToGrid(rawX), 0, Math.max(0, canvasWidth - TILE_SIZE));
  const y = clamp(snapToGrid(rawY), 0, Math.max(0, canvasHeight - TILE_SIZE));
  return { x, y };
}
