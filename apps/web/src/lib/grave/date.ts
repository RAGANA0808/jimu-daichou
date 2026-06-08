/**
 * 区画系 Server Action で共用する ISO 日付パーサ (@db.Date 用)。
 *
 * - 入力は `YYYY-MM-DD` (HTML の <input type="date">)。
 * - UTC 00:00 の Date を返す (CLAUDE.md §4.3: @db.Date は Date.UTC で保存・getUTC* で読み出し)。
 * - 実在しない日 (2月30日 等) は null を返す。
 */
export function parseIsoDate(raw: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const [y, m, d] = raw.split('-').map((s) => Number.parseInt(s, 10));
  if (
    typeof y !== 'number' ||
    typeof m !== 'number' ||
    typeof d !== 'number' ||
    Number.isNaN(y) ||
    Number.isNaN(m) ||
    Number.isNaN(d)
  ) {
    return null;
  }
  const date = new Date(Date.UTC(y, m - 1, d));
  if (
    date.getUTCFullYear() !== y ||
    date.getUTCMonth() + 1 !== m ||
    date.getUTCDate() !== d
  ) {
    return null;
  }
  return date;
}
