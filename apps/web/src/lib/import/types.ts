/**
 * CSV/Excel インポート基盤の共通型 (純粋な型定義のみ)。
 *
 * 過去帳・区画・会計など後続のインポートが再利用できるよう、エンティティ非依存に保つ。
 * エンティティ固有の差分は EntityImportDef<TRecord> に集約する。
 */

import type { Prisma } from '@prisma/client';

/** パース結果の 1 セルは文字列に正規化して扱う (数値・日付は変換側の責務)。 */
export type RawCell = string;

/** パース結果の 1 行 (列見出し → セル値)。順序保持のため配列も併用する。 */
export type RawRow = RawCell[];

/** アップロードファイルをパースした結果。 */
export type ParsedSheet = {
  /** 1 行目から推測したヘッダ (列見出し)。空ヘッダは "列N" で補完する。 */
  headers: string[];
  /** ヘッダを除いたデータ行 (各行は headers と同じ長さに揃える)。 */
  rows: RawRow[];
};

/** インポート対象システム項目 1 つの定義。 */
export type ColumnDef = {
  /** システム内部キー (英語、レコード変換で参照)。 */
  key: string;
  /** UI 表示名 (日本語)。 */
  label: string;
  /** 必須項目か。 */
  required: boolean;
  /** 補足説明 (任意)。 */
  hint?: string;
  /** ヘッダ自動推測に使う別名 (日本語・英語ゆらぎ)。label / key も自動で候補に含む。 */
  aliases?: string[];
};

/** 列マッピング: システム項目 key → アップロードファイルの列インデックス (未割当は null)。 */
export type ColumnMapping = Record<string, number | null>;

/** 1 行のバリデーション深刻度。error 行は確定対象から除外する。 */
export type RowSeverity = 'ok' | 'warning' | 'error';

/** 1 行に対する判定 1 件。 */
export type RowIssue = {
  /** 対象のシステム項目 key (行全体に対する問題なら null)。 */
  column: string | null;
  severity: 'warning' | 'error';
  /** 利用者向けメッセージ (日本語)。氏名等の個人情報を含めてよい (画面表示のみ。ログには出さない)。 */
  message: string;
};

/** プレビュー用の 1 行評価結果。 */
export type EvaluatedRow<TRecord> = {
  /** データ行の 0 始まりインデックス (ヘッダ行を除く)。 */
  rowIndex: number;
  /** マッピング適用後の生値 (システム項目 key → 文字列)。表示用。 */
  values: Record<string, string>;
  /** error / warning がなければ ok。 */
  severity: RowSeverity;
  issues: RowIssue[];
  /** error が無い場合のみ、確定時に insert するレコード。 */
  record: TRecord | null;
};

/** プレビュー全体の集計。 */
export type ImportPreview<TRecord> = {
  rows: EvaluatedRow<TRecord>[];
  counts: {
    total: number;
    ok: number;
    warning: number;
    error: number;
  };
};

/** 既存データとの重複判定に使う、正規化済みキー集合。 */
export type ExistingKeyIndex = {
  /** 正規化済みキー文字列の集合。 */
  has(normalizedKey: string): boolean;
};

/**
 * エンティティ 1 種類分のインポート定義。
 *
 * - columns: 列定義 (必須/任意)
 * - toRecord: マッピング適用後の値 → 検証 + レコード変換
 * - loadExistingKeys: 既存データの照合用コンテキスト (重複索引・名寄せ表など) を作る
 * - insertBatch: 確定時の一括登録 (テナント分離必須。tx 経由)
 *
 * `TContext` は照合に必要な索引型。既定は重複判定用の {@link ExistingKeyIndex} だが、
 * 過去帳のように「施主名/かな → 世帯 id」の名寄せ表まで必要なエンティティは、
 * ExistingKeyIndex を拡張した型を指定して toRecord へ渡すことができる。
 */
export type EntityImportDef<
  TRecord,
  TContext extends ExistingKeyIndex = ExistingKeyIndex,
> = {
  /** 登録キー (URL 等で使う英語スラッグ)。 */
  id: string;
  /** UI 表示名 (例: "世帯 (檀信徒)")。 */
  label: string;
  /** 画面の説明文。 */
  description: string;
  columns: ColumnDef[];

  /**
   * マッピング適用後の 1 行 (key→生文字列) を検証し、レコードへ変換する。
   * - issues に error があれば record は null。
   * - 既存データ重複は existing を使って warning 判定する。
   */
  toRecord(
    values: Record<string, string>,
    ctx: { existing: TContext },
  ): { issues: RowIssue[]; record: TRecord | null };

  /**
   * 既存データの照合用コンテキストを構築する。
   * テナント内クエリのみ (RLS + withTenant 前提の tx を受け取る)。
   */
  loadExistingKeys(
    tx: Prisma.TransactionClient,
    tenantId: string,
  ): Promise<TContext>;

  /**
   * 検証済みレコード配列をテナント分離して一括登録する。
   * バッチ分割は実装側 (chunk) で行う。戻り値は登録件数。
   */
  insertBatch(
    tx: Prisma.TransactionClient,
    tenantId: string,
    records: TRecord[],
  ): Promise<number>;
};
