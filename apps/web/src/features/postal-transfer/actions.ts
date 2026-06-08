'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireCapability } from '@/lib/auth';
import { assertValidUuid, withTenant } from '@/lib/db';
import {
  validateAccountInput,
  validateSubjectInput,
  type AccountInput,
  type SubjectInput,
} from '@/lib/postal-transfer';
import {
  initialAccountFormState,
  initialSubjectFormState,
  type AccountFormState,
  type SubjectFormState,
} from './types';

function readField(formData: FormData, name: string): string {
  const v = formData.get(name);
  return typeof v === 'string' ? v : '';
}

function extractSubject(formData: FormData): SubjectInput {
  return {
    name: readField(formData, 'name'),
    defaultAmount: readField(formData, 'defaultAmount'),
    sortOrder: readField(formData, 'sortOrder'),
    amountSource: readField(formData, 'amountSource'),
  };
}

/** 科目テンプレの新規作成。 */
export async function createSubjectAction(
  _prev: SubjectFormState,
  formData: FormData,
): Promise<SubjectFormState> {
  const input = extractSubject(formData);
  const { errors, values } = validateSubjectInput(input);
  if (Object.keys(errors).length > 0) {
    return { status: 'error', errors, values: input };
  }

  const tenantId = (await requireCapability('create')).tenantId;
  try {
    await withTenant(tenantId, (tx) =>
      tx.postalTransferSubject.create({
        data: {
          tenantId,
          name: values.name,
          defaultAmount: values.defaultAmount,
          sortOrder: values.sortOrder,
          amountSource: values.amountSource,
        },
        select: { id: true },
      }),
    );
  } catch {
    return {
      status: 'error',
      values: input,
      formError: '科目の登録に失敗しました。時間をおいて再度お試しください。',
    };
  }

  revalidatePath('/furikae/settings');
  revalidatePath('/furikae');
  redirect('/furikae/settings');
}

/** 科目テンプレの編集。 */
export async function updateSubjectAction(
  _prev: SubjectFormState,
  formData: FormData,
): Promise<SubjectFormState> {
  const id = readField(formData, 'subjectId').trim();
  if (id.length === 0) return initialSubjectFormState;
  assertValidUuid(id, 'subjectId');

  const input = extractSubject(formData);
  const { errors, values } = validateSubjectInput(input);
  if (Object.keys(errors).length > 0) {
    return { status: 'error', errors, values: input };
  }

  const isActive = readField(formData, 'isActive') === 'on';
  const isVisible = readField(formData, 'isVisible') === 'on';

  const tenantId = (await requireCapability('update')).tenantId;
  try {
    await withTenant(tenantId, async (tx) => {
      const existing = await tx.postalTransferSubject.findUnique({
        where: { id },
        select: { id: true },
      });
      if (!existing) throw new Error('対象の科目が見つかりませんでした。');
      await tx.postalTransferSubject.update({
        where: { id },
        data: {
          name: values.name,
          defaultAmount: values.defaultAmount,
          sortOrder: values.sortOrder,
          amountSource: values.amountSource,
          isActive,
          isVisible,
        },
      });
    });
  } catch {
    return {
      status: 'error',
      values: input,
      formError: '科目の更新に失敗しました。時間をおいて再度お試しください。',
    };
  }

  revalidatePath('/furikae/settings');
  revalidatePath('/furikae');
  redirect('/furikae/settings');
}

/** 科目テンプレを休止 (論理的に除外)。物理削除はせず isActive=false にする。 */
export async function deactivateSubjectAction(formData: FormData): Promise<void> {
  const id = readField(formData, 'subjectId').trim();
  if (id.length === 0) return;
  assertValidUuid(id, 'subjectId');
  const tenantId = (await requireCapability('softDelete')).tenantId;
  await withTenant(tenantId, (tx) =>
    tx.postalTransferSubject.updateMany({
      where: { id },
      data: { isActive: false },
    }),
  );
  revalidatePath('/furikae/settings');
  revalidatePath('/furikae');
}

function extractAccount(formData: FormData): AccountInput {
  return {
    postalAccountName: readField(formData, 'postalAccountName'),
    postalAccountSymbol: readField(formData, 'postalAccountSymbol'),
    postalAccountNumber: readField(formData, 'postalAccountNumber'),
    postalTransferNote: readField(formData, 'postalTransferNote'),
    postalPrintOffsetXMm: readField(formData, 'postalPrintOffsetXMm'),
    postalPrintOffsetYMm: readField(formData, 'postalPrintOffsetYMm'),
  };
}

/** 寺口座情報 + 印字オフセットを更新する。 */
export async function updateAccountAction(
  _prev: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  const input = extractAccount(formData);
  const { errors, values } = validateAccountInput(input);
  if (Object.keys(errors).length > 0) {
    return { status: 'error', errors, values: input };
  }

  const tenantId = (await requireCapability('admin')).tenantId;
  try {
    await withTenant(tenantId, (tx) =>
      tx.tenant.update({
        where: { id: tenantId },
        data: {
          postalAccountName: values.postalAccountName,
          postalAccountSymbol: values.postalAccountSymbol,
          postalAccountNumber: values.postalAccountNumber,
          postalTransferNote: values.postalTransferNote,
          postalPrintOffsetXMm: values.postalPrintOffsetXMm,
          postalPrintOffsetYMm: values.postalPrintOffsetYMm,
        },
      }),
    );
  } catch {
    return {
      status: 'error',
      values: input,
      formError: '口座情報の保存に失敗しました。時間をおいて再度お試しください。',
    };
  }

  revalidatePath('/furikae/settings');
  revalidatePath('/furikae');
  return { ...initialAccountFormState, status: 'success' };
}
