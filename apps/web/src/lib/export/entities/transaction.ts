/**
 * 会計 (Transaction) のエクスポート定義。
 *
 * 列はインポート (lib/import/entities/transaction) と同じキー・ラベルを使う。
 * 入出金区分・項目は日本語ラベルへ戻し (再インポート互換)、対象世帯の施主名も添える。
 * 年/月で絞り込める (未指定は全期間)。
 */

import {
  blankIfNull,
  formatCategory,
  formatDateCell,
  formatDirection,
  formatIntCell,
} from '../format';
import type { EntityExportDef, ExportColumn, ExportFilter } from '../types';

const COLUMNS: ExportColumn[] = [
  { key: 'direction', label: '入出金' },
  { key: 'category', label: '項目' },
  { key: 'amount', label: '金額' },
  { key: 'paidAt', label: '入出金日' },
  { key: 'paymentMethod', label: '支払方法' },
  { key: 'householderName', label: '対象世帯 (施主名)' },
  { key: 'memo', label: '備考' },
];

/**
 * 年/月フィルタを JST の半開区間 [from, to) へ変換する純関数。
 * Asia/Tokyo は UTC+9 固定なのでローカル 0:00 をそのまま使ってよい。
 * year 未指定なら null (= 全期間)。
 */
export function paidAtRange(filter: ExportFilter): { from: Date; to: Date } | null {
  const { year, month } = filter;
  if (typeof year !== 'number') return null;
  if (typeof month === 'number') {
    return { from: new Date(year, month - 1, 1), to: new Date(year, month, 1) };
  }
  return { from: new Date(year, 0, 1), to: new Date(year + 1, 0, 1) };
}

export const transactionExportDef: EntityExportDef = {
  id: 'transaction',
  label: '会計 (入出金)',
  description: '入出金記録を CSV / Excel で書き出します。年・月で絞り込めます。',
  fileBaseName: 'transactions',
  sheetName: '会計',
  columns: COLUMNS,
  filterKind: 'month',

  async fetchRows(tx, _tenantId, filter) {
    const range = paidAtRange(filter);
    // RLS 配下。household を include して N+1 を避ける。
    const transactions = await tx.transaction.findMany({
      where: range ? { paidAt: { gte: range.from, lt: range.to } } : {},
      include: {
        household: { select: { householderName: true } },
      },
      orderBy: [{ paidAt: 'asc' }, { createdAt: 'asc' }],
    });

    return transactions.map((t) => ({
      direction: formatDirection(t.direction),
      category: formatCategory(t.category),
      amount: formatIntCell(t.amount),
      paidAt: formatDateCell(t.paidAt),
      paymentMethod: blankIfNull(t.paymentMethod),
      householderName: blankIfNull(t.household?.householderName ?? null),
      memo: blankIfNull(t.memo),
    }));
  },
};
