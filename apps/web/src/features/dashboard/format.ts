/**
 * ダッシュボード表示用の共通フォーマッタ。
 * すべて JST 前提 (CLAUDE.md §4.3)。DateTime 列はローカル時刻として解釈する。
 */

export function formatYen(amount: number): string {
  return `${amount.toLocaleString('ja-JP')} 円`;
}

/** DateTime 列 (scheduledAt / occurredAt 等) を「M月D日」表記にする。 */
export function formatJaMonthDay(d: Date): string {
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

/** DateTime 列を「M月D日 HH:MM」表記にする。 */
export function formatJaDateTime(d: Date): string {
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${formatJaMonthDay(d)} ${hh}:${mm}`;
}

/** @db.Date 列 (UTC 0:00 保存) を「Y年M月D日」表記にする。 */
export function formatJaDateUtc(d: Date): string {
  return `${d.getUTCFullYear()}年${d.getUTCMonth() + 1}月${d.getUTCDate()}日`;
}
