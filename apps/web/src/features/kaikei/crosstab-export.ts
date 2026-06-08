'use server';

import {
  csvToBytes,
  extensionFor,
  mimeTypeFor,
  toCsv,
} from '@/lib/export';
import { calendarMonthForIndex, type CrossTabResult } from './crosstab';
import { getCrossTabByFiscalYear } from './queries';
import { TRANSACTION_CATEGORY_LABELS } from './types';

export type CrossTabExportResult =
  | {
      status: 'ok';
      base64: string;
      fileName: string;
      mimeType: string;
    }
  | { status: 'error'; message: string };

/** 会計月インデックス順のヘッダ (4月..翌3月)。 */
function monthHeaders(): string[] {
  return Array.from({ length: 12 }, (_, i) => `${calendarMonthForIndex(i)}月`);
}

function buildCsvRows(result: CrossTabResult): string[][] {
  const rows: string[][] = [];

  // 収入ブロック
  rows.push(['【収入】', ...Array.from({ length: 13 }, () => '')]);
  for (const row of result.incomeRows) {
    rows.push([
      TRANSACTION_CATEGORY_LABELS[row.category],
      ...row.months.map((c) => String(c.total)),
      String(row.yearTotal.total),
    ]);
  }
  rows.push([
    '収入合計',
    ...result.monthIncomeTotals.map((v) => String(v)),
    String(result.yearIncomeTotal),
  ]);

  // 支出ブロック
  rows.push(['【支出】', ...Array.from({ length: 13 }, () => '')]);
  for (const row of result.expenseRows) {
    rows.push([
      TRANSACTION_CATEGORY_LABELS[row.category],
      ...row.months.map((c) => String(c.total)),
      String(row.yearTotal.total),
    ]);
  }
  rows.push([
    '支出合計',
    ...result.monthExpenseTotals.map((v) => String(v)),
    String(result.yearExpenseTotal),
  ]);

  // 差引
  rows.push([
    '差引',
    ...result.monthNetTotals.map((v) => String(v)),
    String(result.yearNetTotal),
  ]);

  return rows;
}

/**
 * 会計クロス集計を CSV (BOM 付き UTF-8) として書き出す。
 * 認証・テナント検証・RLS は getCrossTabByFiscalYear に内包。
 * 金額はカンマなしの数値文字列にして再取込互換にする。
 */
export async function exportCrossTabAction(
  fiscalYear: number,
): Promise<CrossTabExportResult> {
  if (
    !Number.isInteger(fiscalYear) ||
    fiscalYear < 2000 ||
    fiscalYear > 2200
  ) {
    return { status: 'error', message: '対象年度が不正です。' };
  }

  try {
    const result = await getCrossTabByFiscalYear(fiscalYear);
    const headers = ['科目', ...monthHeaders(), '年計'];
    const rows = buildCsvRows(result);

    const bytes = csvToBytes(toCsv(headers, rows));
    const base64 = Buffer.from(bytes).toString('base64');
    const fileName = `kaikei_shukei_${fiscalYear}年度.${extensionFor('csv')}`;

    return {
      status: 'ok',
      base64,
      fileName,
      mimeType: mimeTypeFor('csv'),
    };
  } catch {
    return {
      status: 'error',
      message:
        '書き出し中に問題が発生しました。お手数ですが時間をおいて再度お試しください。',
    };
  }
}
