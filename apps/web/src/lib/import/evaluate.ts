/**
 * プレビュー評価: マッピング済みシートを、エンティティ定義の toRecord に通して
 * 行ごとの severity / issues / record を組み立てる。
 *
 * - 純関数 (DB アクセスは loadExistingKeys 側で済ませた ExistingKeyIndex を受け取る)。
 * - error 行は record=null となり、確定対象から除外される。
 */

import { applyMapping } from './mapping';
import type {
  ColumnMapping,
  EntityImportDef,
  EvaluatedRow,
  ExistingKeyIndex,
  ImportPreview,
  ParsedSheet,
  RowSeverity,
} from './types';

function severityOf(issues: { severity: 'warning' | 'error' }[]): RowSeverity {
  if (issues.some((i) => i.severity === 'error')) return 'error';
  if (issues.some((i) => i.severity === 'warning')) return 'warning';
  return 'ok';
}

export function evaluateSheet<TRecord, TContext extends ExistingKeyIndex>(
  sheet: ParsedSheet,
  mapping: ColumnMapping,
  def: EntityImportDef<TRecord, TContext>,
  existing: TContext,
): ImportPreview<TRecord> {
  const rows: EvaluatedRow<TRecord>[] = sheet.rows.map((row, rowIndex) => {
    const values = applyMapping(row, def.columns, mapping);
    const { issues, record } = def.toRecord(values, { existing });
    const severity = severityOf(issues);
    return {
      rowIndex,
      values,
      severity,
      issues,
      // error 行は確定に含めない (toRecord が record=null を返す契約だが、二重防御)。
      record: severity === 'error' ? null : record,
    };
  });

  const counts = rows.reduce(
    (acc, r) => {
      acc.total += 1;
      acc[r.severity] += 1;
      return acc;
    },
    { total: 0, ok: 0, warning: 0, error: 0 },
  );

  return { rows, counts };
}

/** 確定対象 (error でない) のレコードのみ抽出する。 */
export function collectInsertableRecords<TRecord>(
  preview: ImportPreview<TRecord>,
): TRecord[] {
  const out: TRecord[] = [];
  for (const row of preview.rows) {
    if (row.severity !== 'error' && row.record !== null) {
      out.push(row.record);
    }
  }
  return out;
}

/** 配列を size ごとのチャンクへ分割する (一括 insert のバッチ処理用)。 */
export function chunk<T>(items: T[], size: number): T[][] {
  if (size <= 0) return [items];
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

/** 文字列集合をラップした ExistingKeyIndex を作るユーティリティ。 */
export function makeKeyIndex(keys: Iterable<string>): ExistingKeyIndex {
  const set = new Set<string>();
  for (const k of keys) {
    if (k.length > 0) set.add(k);
  }
  return { has: (key) => set.has(key) };
}
