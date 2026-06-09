import type { PlanFieldName } from '@/lib/gojikai';

/** 会費台帳フォームの状態。 */
export type PlanFormState = {
  status: 'idle' | 'error';
  errors?: Partial<Record<PlanFieldName | 'householdId', string>>;
  values?: Partial<Record<PlanFieldName | 'householdId', string>>;
};

export const initialPlanFormState: PlanFormState = { status: 'idle' };

/** 年度請求 一括生成フォームの状態。 */
export type GenerateFormState = {
  status: 'idle' | 'error' | 'success';
  formError?: string;
  /** 成功時のサマリ。 */
  created?: number;
  skippedExisting?: number;
  skippedInactive?: number;
  fiscalYear?: number;
};

export const initialGenerateFormState: GenerateFormState = { status: 'idle' };

/** 入金記録フォームの状態。 */
export type PaymentFormState = {
  status: 'idle' | 'error';
  errors?: Partial<Record<'amount' | 'paidAt' | 'paymentMethod', string>>;
  values?: Partial<Record<'amount' | 'paidAt' | 'paymentMethod', string>>;
};

export const initialPaymentFormState: PaymentFormState = { status: 'idle' };

/** 督促状の発送記録フォームの状態。 */
export type DunningRecordState = {
  status: 'idle' | 'error' | 'success';
  formError?: string;
  /** 記録成功時の発送履歴 ID。 */
  createdBatchId?: string;
};

export const initialDunningRecordState: DunningRecordState = { status: 'idle' };
