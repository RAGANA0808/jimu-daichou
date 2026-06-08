/** 墓地 年間管理料 UI 共通の表示ヘルパ (純関数)。 */

/** 円表示 (例: "12,000 円")。 */
export function formatYen(amount: number): string {
  return `${amount.toLocaleString('ja-JP')} 円`;
}

/** @db.Date (UTC 0 時保存) を JST 日付として表示する (getUTC* で読む既存慣習)。 */
export function formatDbDate(d: Date): string {
  return `${d.getUTCFullYear()}/${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
}

/** 現在の JST 年度 (西暦) を返す。 */
export function currentFiscalYear(now: Date = new Date()): number {
  return now.getFullYear();
}

/** date input 用 today (YYYY-MM-DD, JST)。 */
export function todayDateInput(now: Date = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}
