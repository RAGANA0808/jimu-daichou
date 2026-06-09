import type { AccountFieldName, SubjectFieldName } from '@/lib/postal-transfer';

export type SubjectFormState = {
  status: 'idle' | 'error';
  errors?: Partial<Record<SubjectFieldName, string>>;
  values?: Partial<Record<SubjectFieldName, string>>;
  formError?: string;
};

export const initialSubjectFormState: SubjectFormState = { status: 'idle' };

export type AccountFormState = {
  status: 'idle' | 'error' | 'success';
  errors?: Partial<Record<AccountFieldName, string>>;
  values?: Partial<Record<AccountFieldName, string>>;
  formError?: string;
};

export const initialAccountFormState: AccountFormState = { status: 'idle' };

import type { PostalTransferAmountSource } from '@prisma/client';

export const AMOUNT_SOURCE_LABELS: Record<PostalTransferAmountSource, string> = {
  NONE: '連動なし（既定金額を使う）',
  MAINTENANCE_FEE: '護持会費（当年度請求額）',
  GRAVE_MAINTENANCE: '墓地年間管理料（当年度請求額）',
};
