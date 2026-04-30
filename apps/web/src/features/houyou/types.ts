import type { PreparationStatus } from '@prisma/client';

export type MemorialServiceFieldName =
  | 'serviceName'
  | 'scheduledAt'
  | 'location'
  | 'attendeeCount'
  | 'tobaCount'
  | 'offeringAmount'
  | 'preparationStatus'
  | 'memo';

export type MemorialServiceFormState = {
  status: 'idle' | 'error';
  errors?: Partial<Record<MemorialServiceFieldName, string>>;
  values?: Partial<Record<MemorialServiceFieldName, string>>;
};

export const initialMemorialServiceFormState: MemorialServiceFormState = {
  status: 'idle',
};

export const PREPARATION_STATUS_LABELS: Record<PreparationStatus, string> = {
  TENTATIVE: '未定',
  CONFIRMED: '確定',
  DONE: '完了',
  CANCELED: '中止',
};

export const PREPARATION_STATUS_ORDER: PreparationStatus[] = [
  'TENTATIVE',
  'CONFIRMED',
  'DONE',
  'CANCELED',
];
