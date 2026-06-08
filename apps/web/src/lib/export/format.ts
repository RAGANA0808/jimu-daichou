/**
 * エクスポート用のセル整形 純関数群。
 *
 * - 列挙値 (区画種別・状態・入出金区分・項目) は、インポートが受け付ける日本語ラベルへ
 *   戻す (往復可能性の担保: エクスポート結果をそのまま再インポートできる)。
 * - 日付は JST 前提で YYYY-MM-DD へ整形 (インポートの parseDateCell が受ける形)。
 * - DB アクセス・副作用なし。
 */

import type {
  GravePlotStatus,
  GravePlotType,
  TransactionCategory,
  TransactionDirection,
  DateOfDeathPrecision,
} from '@prisma/client';

/** null/undefined を空文字へ。 */
export function blankIfNull(value: string | null | undefined): string {
  return value ?? '';
}

/**
 * @db.Date の Date を JST の YYYY-MM-DD へ整形する。
 * Prisma の @db.Date は UTC 00:00 の Date として返るため UTC の年月日を読む。
 */
export function formatDateCell(value: Date | null | undefined): string {
  if (!value) return '';
  const y = value.getUTCFullYear();
  const m = String(value.getUTCMonth() + 1).padStart(2, '0');
  const d = String(value.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** 整数 (円・行年 等) を文字列へ。null は空文字。 */
export function formatIntCell(value: number | null | undefined): string {
  return value === null || value === undefined ? '' : String(value);
}

// --- 列挙値 → インポート互換の日本語ラベル ---

const GRAVE_PLOT_TYPE_LABEL: Record<GravePlotType, string> = {
  INDIVIDUAL: '個人墓',
  COUPLE: '夫婦墓',
  FAMILY: '家族墓',
  ETERNAL_MEMORIAL: '永代供養墓',
  OSSUARY: '納骨堂',
};

export function formatGravePlotType(value: GravePlotType): string {
  return GRAVE_PLOT_TYPE_LABEL[value];
}

const GRAVE_PLOT_STATUS_LABEL: Record<GravePlotStatus, string> = {
  AVAILABLE: '空き',
  RESERVED: '予約済',
  IN_USE: '使用中',
  OVERDUE: '管理料滞納',
  UNCLAIMED: '無縁化',
  INTERRED_TOGETHER: '合祀済',
  CLOSED: '墓じまい済',
};

export function formatGravePlotStatus(value: GravePlotStatus): string {
  return GRAVE_PLOT_STATUS_LABEL[value];
}

const DIRECTION_LABEL: Record<TransactionDirection, string> = {
  INCOME: '収入',
  EXPENSE: '支出',
};

export function formatDirection(value: TransactionDirection): string {
  return DIRECTION_LABEL[value];
}

const CATEGORY_LABEL: Record<TransactionCategory, string> = {
  MAINTENANCE_FEE: '護持会費',
  OFFERING: '御布施',
  DONATION: '寄付',
  EVENT_FEE: '行事関連',
  EXPENSE: '経費',
  OTHER: 'その他',
};

export function formatCategory(value: TransactionCategory): string {
  return CATEGORY_LABEL[value];
}

/**
 * 没年月日を精度に応じて整形する。
 * - FULL: YYYY-MM-DD (再インポート互換)
 * - YEAR_MONTH: YYYY-MM
 * - YEAR: YYYY
 * - UNKNOWN: 空文字
 */
export function formatDeathDate(value: {
  precision: DateOfDeathPrecision;
  year: number | null;
  month: number | null;
  day: number | null;
}): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  switch (value.precision) {
    case 'FULL':
      if (value.year === null || value.month === null || value.day === null) return '';
      return `${value.year}-${pad(value.month)}-${pad(value.day)}`;
    case 'YEAR_MONTH':
      if (value.year === null || value.month === null) return '';
      return `${value.year}-${pad(value.month)}`;
    case 'YEAR':
      return value.year === null ? '' : String(value.year);
    case 'UNKNOWN':
      return '';
  }
}
