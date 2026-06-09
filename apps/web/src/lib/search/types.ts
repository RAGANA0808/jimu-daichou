/**
 * 横断検索の結果型 (世帯・過去帳をまたぐサジェスト)。
 */

export type SearchResultKind =
  | 'household'
  | 'deathLedgerEntry'
  | 'gravePlot'
  | 'noteHit';

/**
 * 世帯ヒット。クリックで世帯詳細 (/danshintoto/[id]) へ遷移する。
 */
export type HouseholdSearchResult = {
  kind: 'household';
  /** 世帯 id */
  id: string;
  /** 施主名 */
  householderName: string;
  /** ふりがな */
  nameKana: string;
  /** 表示用の連絡先 (phone 優先, なければ mobile) */
  phone: string | null;
  /** 備考メモ/住所への一致でヒットしたか (本文は含めない＝個人情報非露出) */
  memoMatch: boolean;
};

/**
 * 過去帳エントリのヒット。クリックで過去帳詳細
 * (/danshintoto/[householdId]/kakochou/[entryId]) へ遷移する。
 */
export type DeathLedgerSearchResult = {
  kind: 'deathLedgerEntry';
  /** 過去帳エントリ id */
  id: string;
  /** 故人が属する世帯 id (遷移先解決に使用) */
  householdId: string;
  /** 戒名 */
  kaimyoName: string | null;
  /** 俗名 */
  secularName: string;
};

/**
 * 区画ヒット (G-2 逆引き)。クリックで区画詳細 (/kukaku/[id]) へ遷移する。
 * 墓標名・刻名・使用者姓のいずれからでもヒットする。
 */
export type GravePlotSearchResult = {
  kind: 'gravePlot';
  /** 区画 id */
  id: string;
  /** 区画番号 */
  plotNumber: string;
  /** 墓標名 */
  monumentName: string | null;
  /** 刻名 */
  inscription: string | null;
  /** 使用者 (契約世帯) の施主名 */
  householderName: string | null;
};

/**
 * 履歴本文・備考メモへの全文一致ヒット (S-3)。クリックで遷移先の世帯詳細へ。
 *
 * 一致箇所周辺の抜粋 (snippet) はアプリ側で生成する。本文全体は返さず、
 * 一致語周辺のみを切り出して付与する (露出を必要最小限に抑える)。
 */
export type NoteSearchResult = {
  kind: 'noteHit';
  /** 一致元の種別: 対応履歴 (interaction) か 世帯の備考メモ (memo) か */
  source: 'interaction' | 'memo';
  /** 一意キー (interaction はノート id、memo は世帯 id) */
  id: string;
  /** 遷移先の世帯 id */
  householdId: string;
  /** 一致した世帯の施主名 (どの家の記録かの手掛かり) */
  householderName: string;
  /** 一致箇所周辺の抜粋 (前後を省略記号で詰める) */
  snippet: string;
};

export type SearchResult =
  | HouseholdSearchResult
  | DeathLedgerSearchResult
  | GravePlotSearchResult
  | NoteSearchResult;

export type SearchResults = {
  households: HouseholdSearchResult[];
  deathLedgerEntries: DeathLedgerSearchResult[];
  gravePlots: GravePlotSearchResult[];
  noteHits: NoteSearchResult[];
};

/** 各カテゴリで返す最大件数 (recognition over recall: サジェストは絞る)。 */
export const SEARCH_LIMIT_PER_KIND = 8;
