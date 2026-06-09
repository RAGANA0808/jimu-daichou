/** 郵便振替 UI 共通の表示ヘルパ (純関数)。 */

export function formatYen(amount: number): string {
  return `${amount.toLocaleString('ja-JP')} 円`;
}

/** 現在の JST 年度 (西暦)。 */
export function currentFiscalYear(now: Date = new Date()): number {
  return now.getFullYear();
}
