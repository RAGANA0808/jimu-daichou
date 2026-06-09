/**
 * 列マッピング: アップロードファイルのヘッダ → システム項目 (ColumnDef.key) の対応付け。
 *
 * - 1 行目ヘッダから自動推測する (別名・部分一致)。利用者は画面で手動修正できる。
 * - 純関数のみ (DB アクセスなし)。
 */

import type { ColumnDef, ColumnMapping, ParsedSheet, RawRow } from './types';

/** 比較用にヘッダ文字列を正規化する (全角→半角・空白除去・小文字化・記号除去)。 */
function normalizeHeader(value: string): string {
  return value
    .replace(/[！-～]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .replace(/[\s　()（）_\-/／・]/g, '')
    .toLowerCase();
}

/** ColumnDef が受け付ける推測候補 (key / label / aliases) を正規化して返す。 */
function candidatesFor(col: ColumnDef): string[] {
  const raw = [col.key, col.label, ...(col.aliases ?? [])];
  return raw.map(normalizeHeader).filter((s) => s.length > 0);
}

/**
 * ヘッダ配列から、各システム項目に最も合致する列インデックスを推測する。
 * 1 列を複数項目へ割り当てない (先に確定したものを優先)。
 */
export function guessMapping(
  headers: string[],
  columns: ColumnDef[],
): ColumnMapping {
  const normalizedHeaders = headers.map(normalizeHeader);
  const used = new Set<number>();
  const mapping: ColumnMapping = {};

  for (const col of columns) {
    const cands = candidatesFor(col);
    let found: number | null = null;

    // 1) 完全一致を優先
    for (let i = 0; i < normalizedHeaders.length; i += 1) {
      if (used.has(i)) continue;
      if (cands.includes(normalizedHeaders[i] ?? '')) {
        found = i;
        break;
      }
    }
    // 2) 部分一致 (ヘッダが候補を含む / 候補がヘッダを含む)
    if (found === null) {
      for (let i = 0; i < normalizedHeaders.length; i += 1) {
        if (used.has(i)) continue;
        const h = normalizedHeaders[i] ?? '';
        if (h.length === 0) continue;
        if (cands.some((c) => h.includes(c) || c.includes(h))) {
          found = i;
          break;
        }
      }
    }

    mapping[col.key] = found;
    if (found !== null) used.add(found);
  }

  return mapping;
}

/** マッピングを 1 行へ適用し、システム項目 key → セル値 (文字列) を返す。 */
export function applyMapping(
  row: RawRow,
  columns: ColumnDef[],
  mapping: ColumnMapping,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const col of columns) {
    const idx = mapping[col.key];
    out[col.key] = idx === null || idx === undefined ? '' : (row[idx] ?? '').trim();
  }
  return out;
}

/** 必須項目がすべてマッピングされているか検証する (確定前ゲート)。 */
export function findUnmappedRequired(
  columns: ColumnDef[],
  mapping: ColumnMapping,
): ColumnDef[] {
  return columns.filter(
    (col) => col.required && (mapping[col.key] === null || mapping[col.key] === undefined),
  );
}

/** ParsedSheet が空 (データ行なし) か。 */
export function isEmptySheet(sheet: ParsedSheet): boolean {
  return sheet.rows.length === 0;
}
