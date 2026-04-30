import type { TransactionCategory, TransactionDirection } from '@prisma/client';

export type TransactionFieldName =
  | 'direction'
  | 'category'
  | 'amount'
  | 'paidAt'
  | 'householdId'
  | 'paymentMethod'
  | 'memo';

export type TransactionFormState = {
  status: 'idle' | 'error';
  errors?: Partial<Record<TransactionFieldName, string>>;
  values?: Partial<Record<TransactionFieldName, string>>;
};

export const initialTransactionFormState: TransactionFormState = {
  status: 'idle',
};

export const TRANSACTION_DIRECTION_LABELS: Record<TransactionDirection, string> = {
  INCOME: '収入',
  EXPENSE: '支出',
};

export const TRANSACTION_DIRECTION_ORDER: TransactionDirection[] = [
  'INCOME',
  'EXPENSE',
];

export const TRANSACTION_CATEGORY_LABELS: Record<TransactionCategory, string> = {
  MAINTENANCE_FEE: '護持会費',
  OFFERING: '御布施',
  DONATION: '寄付',
  EVENT_FEE: '行事関連',
  EXPENSE: '経費',
  OTHER: 'その他',
};

/**
 * 入出金の方向ごとに自然なカテゴリ候補を返す。
 * フォームでは方向を切り替えると候補が動的に変わる UX。
 */
export const CATEGORY_BY_DIRECTION: Record<
  TransactionDirection,
  TransactionCategory[]
> = {
  INCOME: ['MAINTENANCE_FEE', 'OFFERING', 'DONATION', 'EVENT_FEE', 'OTHER'],
  EXPENSE: ['EXPENSE', 'EVENT_FEE', 'OTHER'],
};

/**
 * 一覧・集計でカテゴリを並べる時の固定順序。
 */
export const TRANSACTION_CATEGORY_ORDER: TransactionCategory[] = [
  'MAINTENANCE_FEE',
  'OFFERING',
  'DONATION',
  'EVENT_FEE',
  'EXPENSE',
  'OTHER',
];
