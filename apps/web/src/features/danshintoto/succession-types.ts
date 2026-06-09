import type { SuccessionReason, SuccessionStatus } from '@prisma/client';

export type SuccessionFieldName =
  | 'reason'
  | 'previousHouseholderName'
  | 'nextHouseholderName'
  | 'occurredAt'
  | 'note';

export type SuccessionFormState = {
  status: 'idle' | 'error' | 'success';
  errors?: Partial<Record<SuccessionFieldName, string>>;
  values?: Partial<Record<SuccessionFieldName, string>>;
};

export const initialSuccessionFormState: SuccessionFormState = {
  status: 'idle',
};

export const SUCCESSION_REASON_ORDER: readonly SuccessionReason[] = [
  'DEATH',
  'RELOCATION',
  'OTHER',
];

export const SUCCESSION_REASON_LABELS: Record<SuccessionReason, string> = {
  DEATH: '死亡',
  RELOCATION: '転居',
  OTHER: 'その他',
};

export const SUCCESSION_STATUS_LABELS: Record<SuccessionStatus, string> = {
  PROPOSED: '承継候補',
  APPROVED: '承認済',
  REJECTED: '却下',
};
