'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireCapability } from '@/lib/auth';
import { withTenant } from '@/lib/db';
import type {
  TenantSettingsFieldName,
  TenantSettingsFormState,
} from './types';

function readField(formData: FormData, name: TenantSettingsFieldName): string {
  const v = formData.get(name);
  return typeof v === 'string' ? v.trim() : '';
}

function nullIfBlank(value: string): string | null {
  return value.length === 0 ? null : value;
}

/**
 * 自テナントの表示用設定 (寺院名・住職氏名) を更新する。
 * slug は URL 識別子のため編集不可。
 */
export async function updateTenantSettingsAction(
  _prev: TenantSettingsFormState,
  formData: FormData,
): Promise<TenantSettingsFormState> {
  const values = {
    name: readField(formData, 'name'),
    headPriestName: readField(formData, 'headPriestName'),
  };

  const errors: NonNullable<TenantSettingsFormState['errors']> = {};
  if (values.name.length === 0) {
    errors.name = '寺院名をご入力ください。';
  } else if (values.name.length > 60) {
    errors.name = '60 文字以内でご入力ください。';
  }

  if (values.headPriestName.length > 60) {
    errors.headPriestName = '60 文字以内でご入力ください。';
  }

  if (Object.keys(errors).length > 0) {
    return { status: 'error', errors, values };
  }

  const tenantId = (await requireCapability('admin')).tenantId;
  await withTenant(tenantId, (tx) =>
    tx.tenant.update({
      where: { id: tenantId },
      data: {
        name: values.name,
        headPriestName: nullIfBlank(values.headPriestName),
      },
    }),
  );

  revalidatePath('/settings');
  revalidatePath('/dashboard');
  redirect('/settings');
}
