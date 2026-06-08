/**
 * アップロードファイル (CSV / Excel .xlsx) を ParsedSheet へ変換する。
 *
 * - サーバ側でのみ実行する (papaparse / xlsx を Node で動かす)。
 * - 1 行目をヘッダとして扱う。空ヘッダは "列N" で補完する。
 * - 全セルを文字列へ正規化する (数値・日付の解釈は各エンティティの toRecord に委ねる)。
 */

import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import type { ParsedSheet, RawRow } from './types';

export type SupportedFileKind = 'csv' | 'xlsx';

/**
 * インポート1ファイルあたりの最大データ行数 (DoS 予防)。
 * ファイルサイズ上限 (呼び出し側) だけだと圧縮率の高い CSV で大量行が通りうるため、
 * 行数でも頭打ちにする。実運用の名簿規模を十分に上回る値。
 */
export const MAX_IMPORT_ROWS = 50000;

export function detectFileKind(fileName: string): SupportedFileKind | null {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.csv')) return 'csv';
  if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) return 'xlsx';
  return null;
}

/** Excel のセル値 (数値・日付・真偽) を表示用文字列へ寄せる。 */
function cellToString(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) {
    // Excel 日付は JST 前提。YYYY-MM-DD へ寄せる (時刻は捨てる)。
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return String(value).trim();
}

/** 行列を「ヘッダ + 同じ長さに揃えたデータ行」へ整形する。 */
function normalizeMatrix(matrix: string[][]): ParsedSheet {
  const nonEmpty = matrix.filter((row) =>
    row.some((cell) => cell.trim().length > 0),
  );
  if (nonEmpty.length === 0) {
    return { headers: [], rows: [] };
  }

  const headerRow = nonEmpty[0] ?? [];
  const colCount = nonEmpty.reduce(
    (max, row) => Math.max(max, row.length),
    headerRow.length,
  );

  const headers: string[] = [];
  for (let i = 0; i < colCount; i += 1) {
    const raw = (headerRow[i] ?? '').trim();
    headers.push(raw.length > 0 ? raw : `列${i + 1}`);
  }

  const rows: RawRow[] = nonEmpty.slice(1).map((row) => {
    const out: string[] = [];
    for (let i = 0; i < colCount; i += 1) {
      out.push((row[i] ?? '').trim());
    }
    return out;
  });

  return { headers, rows };
}

/** CSV テキストをパースする (区切り自動判定・引用符対応は papaparse に委ねる)。 */
export function parseCsv(text: string): ParsedSheet {
  const result = Papa.parse<string[]>(text, {
    skipEmptyLines: 'greedy',
  });
  const matrix = (result.data as unknown[][]).map((row) =>
    row.map((cell) => cellToString(cell)),
  );
  return normalizeMatrix(matrix);
}

/** Excel (.xlsx) バイナリをパースする (最初のシートのみ)。 */
export function parseXlsx(buffer: ArrayBuffer): ParsedSheet {
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) return { headers: [], rows: [] };
  const sheet = workbook.Sheets[firstSheetName];
  if (!sheet) return { headers: [], rows: [] };

  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    blankrows: false,
    defval: '',
    raw: false,
  });
  const stringMatrix = matrix.map((row) =>
    (Array.isArray(row) ? row : []).map((cell) => cellToString(cell)),
  );
  return normalizeMatrix(stringMatrix);
}

/** CSV / Excel どちらでも ParsedSheet を返す統一エントリ。 */
export async function parseUpload(
  file: File,
): Promise<{ ok: true; sheet: ParsedSheet } | { ok: false; error: string }> {
  const kind = detectFileKind(file.name);
  if (kind === null) {
    return {
      ok: false,
      error: '対応していない形式です。CSV または Excel (.xlsx) をご利用ください。',
    };
  }

  try {
    let sheet: ParsedSheet;
    if (kind === 'csv') {
      // BOM 付き UTF-8 にも対応するため text() で読む。
      const text = await file.text();
      sheet = parseCsv(text);
    } else {
      const buffer = await file.arrayBuffer();
      sheet = parseXlsx(buffer);
    }
    if (sheet.rows.length > MAX_IMPORT_ROWS) {
      return {
        ok: false,
        error: `1 度に取り込める行数の上限 (${MAX_IMPORT_ROWS.toLocaleString()} 行) を超えています。ファイルを分割してください。`,
      };
    }
    return { ok: true, sheet };
  } catch {
    // パース失敗の詳細 (中身) はログにもメッセージにも出さない (個人情報保護)。
    return {
      ok: false,
      error: 'ファイルを読み取れませんでした。形式をご確認ください。',
    };
  }
}
