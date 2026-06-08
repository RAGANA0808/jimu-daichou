/**
 * CSV/Excel エクスポート基盤の共通型 (純粋な型定義のみ)。
 *
 * インポート (lib/import) と対になる。インポートの列定義 (ColumnDef.label) を
 * エクスポートのヘッダにも流用できるよう、列のキー・ラベルは同じ語彙を使う。
 * これにより「エクスポート → 編集 → 再インポート」の往復がしやすくなる。
 */

import type { Prisma } from '@prisma/client';

/** エクスポート 1 列の定義。 */
export type ExportColumn = {
  /** システム内部キー (英語)。インポートの ColumnDef.key と揃える。 */
  key: string;
  /** 出力ヘッダ (日本語ラベル)。インポートの ColumnDef.label と揃える。 */
  label: string;
};

/** エクスポートのフィルタ条件 (エンティティ非依存の入れ物)。 */
export type ExportFilter = {
  /** 会計の対象年 (西暦)。未指定は全期間。 */
  year?: number | null;
  /** 会計の対象月 (1-12)。year と併用。未指定は年全体。 */
  month?: number | null;
  /** 過去帳の期間 (没年 西暦) の開始。未指定は下限なし。 */
  fromYear?: number | null;
  /** 過去帳の期間 (没年 西暦) の終了。未指定は上限なし。 */
  toYear?: number | null;
};

/**
 * エンティティ 1 種類分のエクスポート定義。
 *
 * - columns: 出力列 (順序保持。ヘッダ生成に使う)
 * - fetchRows: テナント内データを取得し、列キー → 文字列の行配列へ整形する
 *   (取得は必ず withTenant 経由・N+1 回避。整形は純粋に)。
 */
export type EntityExportDef = {
  /** 登録キー (URL 等で使う英語スラッグ)。インポートの id と揃える。 */
  id: string;
  /** UI 表示名。 */
  label: string;
  /** 画面の説明文。 */
  description: string;
  /** 出力ファイル名のベース (拡張子なし、英語)。 */
  fileBaseName: string;
  /** Excel のシート名 (日本語可)。 */
  sheetName: string;
  columns: ExportColumn[];
  /**
   * 利用可能なフィルタ種別。UI のフィルタ表示制御に使う。
   * - 'month': 年/月 (会計)
   * - 'yearRange': 没年の期間 (過去帳)
   */
  filterKind: 'none' | 'month' | 'yearRange';

  /**
   * テナント内データを取得し、各行を「列キー → セル文字列」のレコードへ整形する。
   * tx は withTenant 配下のトランザクションクライアント (RLS 有効)。
   */
  fetchRows(
    tx: Prisma.TransactionClient,
    tenantId: string,
    filter: ExportFilter,
  ): Promise<Record<string, string>[]>;
};

/** 列定義と行レコードから、ヘッダ配列・文字列行配列 (列順) を組み立てる純関数。 */
export function buildTable(
  columns: ExportColumn[],
  records: Record<string, string>[],
): { headers: string[]; rows: string[][] } {
  const headers = columns.map((c) => c.label);
  const rows = records.map((rec) => columns.map((c) => rec[c.key] ?? ''));
  return { headers, rows };
}
