'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireCapability } from '@/lib/auth';
import { withTenant } from '@/lib/db';
import {
  DISPLAY_NAME_MAX_LENGTH,
  type AccountProfileFieldName,
  type AccountProfileFormState,
} from './types';

function readField(formData: FormData, name: AccountProfileFieldName): string {
  const v = formData.get(name);
  return typeof v === 'string' ? v.trim() : '';
}

/**
 * ログイン中ユーザー自身の表示名 (displayName) のみを更新する。
 *
 * - 更新対象は requireCapability('read') で解決した自分の行に固定 (where: { id }) し、
 *   さらに withTenant(自テナント) でラップするため、他人・他テナントは更新できない。
 * - 役割・メール・テナントは本アクションでは変更しない。
 */
export async function updateMyDisplayNameAction(
  _prev: AccountProfileFormState,
  formData: FormData,
): Promise<AccountProfileFormState> {
  const values = {
    displayName: readField(formData, 'displayName'),
  };

  const errors: NonNullable<AccountProfileFormState['errors']> = {};
  if (values.displayName.length === 0) {
    errors.displayName = '表示名をご入力ください。';
  } else if (values.displayName.length > DISPLAY_NAME_MAX_LENGTH) {
    errors.displayName = `${DISPLAY_NAME_MAX_LENGTH} 文字以内でご入力ください。`;
  }

  if (Object.keys(errors).length > 0) {
    return { status: 'error', errors, values };
  }

  // 自分の表示名のみの更新。READ_ONLY も自プロフィールは変更可 (read で全員通過)。
  // requireCapability 経由で無効化アカウント (isActive=false) は弾く。
  const user = await requireCapability('read');
  await withTenant(user.tenantId, (tx) =>
    tx.user.update({
      where: { id: user.id },
      data: { displayName: values.displayName },
    }),
  );

  revalidatePath('/settings');
  revalidatePath('/dashboard');
  redirect('/settings?account=updated');
}
