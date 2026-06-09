/**
 * 表形式データを CSV / Excel (.xlsx) のバイナリへ直列化する純関数群。
 *
 * - CSV は BOM 付き UTF-8 (Excel で開いても文字化けしない)。
 * - すべて文字列セルへ正規化してから書き出す (値の整形は呼び出し側 = エンティティ定義の責務)。
 * - DB アクセス・副作用は持たない (テスト容易性のため lib に隔離する)。
 */

import * as XLSX from 'xlsx';

/** UTF-8 BOM。Excel が文字コードを UTF-8 と認識するための先頭バイト。 */
const UTF8_BOM = '﻿';

/**
 * 1 セルを CSV のフィールドへエスケープする (RFC 4180)。
 * - ダブルクォート・カンマ・改行を含む場合は全体を "" で囲む。
 * - 内部のダブルクォートは "" へ二重化する。
 */
function escapeCsvField(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * ヘッダ行 + データ行を BOM 付き UTF-8 CSV 文字列へ変換する。
 * 改行は CRLF (Excel 互換)。
 */
export function toCsv(headers: string[], rows: string[][]): string {
  const lines: string[] = [];
  lines.push(headers.map(escapeCsvField).join(','));
  for (const row of rows) {
    lines.push(row.map(escapeCsvField).join(','));
  }
  return UTF8_BOM + lines.join('\r\n');
}

/** CSV 文字列を Uint8Array (UTF-8) へ。ダウンロード応答に使う。 */
export function csvToBytes(csv: string): Uint8Array {
  return new TextEncoder().encode(csv);
}

/**
 * ヘッダ行 + データ行を Excel (.xlsx) バイナリへ変換する。
 * - 1 シート (sheetName) に書き出す。先頭行をヘッダにする。
 * - すべて文字列セルとして書き込む (前ゼロ・電話番号の桁落ちを防ぐ)。
 */
export function toXlsx(
  headers: string[],
  rows: string[][],
  sheetName: string,
): Uint8Array {
  const matrix: string[][] = [headers, ...rows];
  const sheet = XLSX.utils.aoa_to_sheet(matrix);

  // 全セルをテキスト型 (t: 's') に固定して数値変換 (前ゼロ落ち) を防ぐ。
  const range = XLSX.utils.decode_range(sheet['!ref'] ?? 'A1');
  for (let r = range.s.r; r <= range.e.r; r += 1) {
    for (let c = range.s.c; c <= range.e.c; c += 1) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = sheet[addr];
      if (cell && cell.v !== undefined && cell.v !== null) {
        cell.t = 's';
        cell.v = String(cell.v);
      }
    }
  }

  // 列幅をヘッダ・値の最大長からおおまかに設定する (見やすさのため)。
  sheet['!cols'] = headers.map((h, i) => {
    let max = h.length;
    for (const row of rows) {
      const len = (row[i] ?? '').length;
      if (len > max) max = len;
    }
    return { wch: Math.min(Math.max(max + 2, 8), 50) };
  });

  const workbook = XLSX.utils.book_new();
  // シート名は 31 文字以内・禁止文字なしへ寄せる。
  const safeName = sheetName.replace(/[\\/?*[\]:]/g, '_').slice(0, 31) || 'Sheet1';
  XLSX.utils.book_append_sheet(workbook, sheet, safeName);

  const out = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
  return new Uint8Array(out as ArrayBuffer);
}

export type ExportFormat = 'csv' | 'xlsx';

/** 形式に応じた MIME タイプ。 */
export function mimeTypeFor(format: ExportFormat): string {
  return format === 'csv'
    ? 'text/csv; charset=utf-8'
    : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
}

/** 形式に応じたファイル拡張子。 */
export function extensionFor(format: ExportFormat): string {
  return format === 'csv' ? 'csv' : 'xlsx';
}
