import type { InteractionCategory, InteractionKind } from '@prisma/client';

export type InteractionFieldName = 'kind' | 'category' | 'content' | 'occurredAt';

export type InteractionFormState = {
  status: 'idle' | 'error' | 'success';
  errors?: Partial<Record<InteractionFieldName, string>>;
  values?: Partial<Record<InteractionFieldName, string>> & {
    /** ピン留めチェックの復元用。'true' のとき固定。 */
    isPinned?: string;
  };
};

export const initialInteractionFormState: InteractionFormState = {
  status: 'idle',
};

export const INTERACTION_KIND_LABELS: Record<InteractionKind, string> = {
  PHONE: 'お電話',
  VISIT: 'ご訪問',
  EMAIL: 'メール',
  CONVERSATION: '対面でのお話',
  NOTE: 'その他メモ',
};

/**
 * 種別選択・タイムライン表示の固定順序。
 */
export const INTERACTION_KIND_ORDER: InteractionKind[] = [
  'PHONE',
  'VISIT',
  'CONVERSATION',
  'EMAIL',
  'NOTE',
];

/**
 * 種別ごとのバッジ配色。色のみに依存せずラベルと併用する (E13 基準)。
 */
export const INTERACTION_KIND_BADGE_VARIANT: Record<
  InteractionKind,
  'success' | 'warning' | 'danger' | 'info' | 'neutral'
> = {
  PHONE: 'info',
  VISIT: 'success',
  CONVERSATION: 'success',
  EMAIL: 'warning',
  NOTE: 'neutral',
};

/**
 * 話題 (category) の日本語ラベル。
 */
export const INTERACTION_CATEGORY_LABELS: Record<InteractionCategory, string> = {
  CONTRACT: '契約',
  MEMORIAL: '法要',
  FUNERAL: '葬儀',
  TOUR: '見学',
  FAMILY: '家族',
  HEALTH: '健康',
  MESSAGE: '伝言',
  SCHEDULE: '予定',
  GRAVE_VISIT: 'お参り',
  KAIMYO: '戒名',
  OTHER: 'その他',
};

/**
 * 話題選択・絞り込みチップの固定順序。運用頻度の高いものを先頭に。
 */
export const INTERACTION_CATEGORY_ORDER: InteractionCategory[] = [
  'MESSAGE',
  'SCHEDULE',
  'MEMORIAL',
  'FUNERAL',
  'KAIMYO',
  'GRAVE_VISIT',
  'CONTRACT',
  'TOUR',
  'FAMILY',
  'HEALTH',
  'OTHER',
];

/**
 * 話題ごとのチップ配色。Badge variant (5 種) では 12 分類を表現できないため
 * 専用の Tailwind クラスマップを用いる。JIT purge 対策で完全なクラス文字列を
 * ベタ書きする。色のみに依存せずラベルと併用する (E13 基準)。
 */
export const INTERACTION_CATEGORY_CHIP_CLASS: Record<InteractionCategory, string> = {
  MESSAGE: 'border-amber-300 bg-amber-50 text-amber-800',
  SCHEDULE: 'border-sky-300 bg-sky-50 text-sky-800',
  MEMORIAL: 'border-violet-300 bg-violet-50 text-violet-800',
  FUNERAL: 'border-slate-300 bg-slate-100 text-slate-700',
  KAIMYO: 'border-indigo-300 bg-indigo-50 text-indigo-800',
  GRAVE_VISIT: 'border-emerald-300 bg-emerald-50 text-emerald-800',
  CONTRACT: 'border-rose-300 bg-rose-50 text-rose-800',
  TOUR: 'border-fuchsia-300 bg-fuchsia-50 text-fuchsia-800',
  FAMILY: 'border-orange-300 bg-orange-50 text-orange-800',
  HEALTH: 'border-lime-300 bg-lime-50 text-lime-800',
  OTHER: 'border-border bg-muted text-muted-foreground',
};
