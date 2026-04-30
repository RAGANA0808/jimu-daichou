'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireCurrentTenantId } from '@/lib/auth';
import { assertValidUuid, withTenant } from '@/lib/db';
import type { HouseholdFieldName, HouseholdFormState } from './types';

function readField(formData: FormData, name: HouseholdFieldName): string {
  const v = formData.get(name);
  return typeof v === 'string' ? v.trim() : '';
}

function nullIfBlank(value: string): string | null {
  return value.length === 0 ? null : value;
}

type HouseholdValues = Record<HouseholdFieldName, string>;

function extractValues(formData: FormData): HouseholdValues {
  return {
    householderName: readField(formData, 'householderName'),
    nameKana: readField(formData, 'nameKana'),
    postalCode: readField(formData, 'postalCode'),
    address: readField(formData, 'address'),
    phone: readField(formData, 'phone'),
    mobile: readField(formData, 'mobile'),
    email: readField(formData, 'email'),
    memo: readField(formData, 'memo'),
  };
}

function validate(
  values: HouseholdValues,
): NonNullable<HouseholdFormState['errors']> {
  const errors: NonNullable<HouseholdFormState['errors']> = {};

  if (values.householderName.length === 0) {
    errors.householderName = '施主名をご入力ください。';
  } else if (values.householderName.length > 60) {
    errors.householderName = '60 文字以内でご入力ください。';
  }

  if (values.nameKana.length === 0) {
    errors.nameKana = 'ふりがな (かな) をご入力ください。';
  } else if (values.nameKana.length > 60) {
    errors.nameKana = '60 文字以内でご入力ください。';
  }

  if (
    values.email.length > 0 &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)
  ) {
    errors.email = 'メールアドレスの形式が正しくありません。';
  }

  return errors;
}

function toPrismaData(values: HouseholdValues) {
  return {
    householderName: values.householderName,
    nameKana: values.nameKana,
    postalCode: nullIfBlank(values.postalCode),
    address: nullIfBlank(values.address),
    phone: nullIfBlank(values.phone),
    mobile: nullIfBlank(values.mobile),
    email: nullIfBlank(values.email),
    memo: nullIfBlank(values.memo),
  };
}

/**
 * 世帯 (檀信徒カルテ) の新規登録。
 */
export async function createHouseholdAction(
  _prev: HouseholdFormState,
  formData: FormData,
): Promise<HouseholdFormState> {
  const values = extractValues(formData);
  const errors = validate(values);
  if (Object.keys(errors).length > 0) {
    return { status: 'error', errors, values };
  }

  const tenantId = await requireCurrentTenantId();
  await withTenant(tenantId, (tx) =>
    tx.household.create({ data: { tenantId, ...toPrismaData(values) } }),
  );

  revalidatePath('/danshintoto');
  redirect('/danshintoto');
}

/**
 * 世帯の編集。`id` は hidden input から受け取る。
 * RLS により他テナントの id は何も見えないので tenantId 検証は不要。
 */
export async function updateHouseholdAction(
  _prev: HouseholdFormState,
  formData: FormData,
): Promise<HouseholdFormState> {
  const idRaw = formData.get('id');
  if (typeof idRaw !== 'string' || idRaw.length === 0) {
    return {
      status: 'error',
      errors: {},
      values: extractValues(formData),
    };
  }
  assertValidUuid(idRaw, 'householdId');

  const values = extractValues(formData);
  const errors = validate(values);
  if (Object.keys(errors).length > 0) {
    return { status: 'error', errors, values };
  }

  const tenantId = await requireCurrentTenantId();
  await withTenant(tenantId, (tx) =>
    tx.household.update({
      where: { id: idRaw },
      data: toPrismaData(values),
    }),
  );

  revalidatePath('/danshintoto');
  revalidatePath(`/danshintoto/${idRaw}`);
  redirect(`/danshintoto/${idRaw}`);
}

/**
 * 離檀処理 (論理削除)。`isActive=false` にして一覧から外す。
 * 物理削除はしない (寺院の縁故・記録価値のため)。
 */
export async function setHouseholdInactiveAction(
  formData: FormData,
): Promise<void> {
  const idRaw = formData.get('id');
  if (typeof idRaw !== 'string') {
    throw new Error('id is required.');
  }
  assertValidUuid(idRaw, 'householdId');

  const tenantId = await requireCurrentTenantId();
  await withTenant(tenantId, (tx) =>
    tx.household.update({
      where: { id: idRaw },
      data: { isActive: false },
    }),
  );

  revalidatePath('/danshintoto');
  redirect('/danshintoto');
}
