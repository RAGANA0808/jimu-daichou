'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireCapability } from '@/lib/auth';
import { recordAudit } from '@/lib/audit';
import {
  assertNotStale,
  assertValidUuid,
  isStaleError,
  withTenant,
} from '@/lib/db';
import {
  normalizePhoneForStorage,
  normalizePostalCode,
} from '@/lib/search/normalize';
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
    // C-6: 電話・郵便番号は保存時に正規化する (全角→半角・余分な記号除去・7桁ハイフン整形)。
    postalCode: nullIfBlank(normalizePostalCode(values.postalCode)),
    address: nullIfBlank(values.address),
    phone: nullIfBlank(normalizePhoneForStorage(values.phone)),
    mobile: nullIfBlank(normalizePhoneForStorage(values.mobile)),
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

  const user = await requireCapability('create');
  const tenantId = user.tenantId;
  await withTenant(tenantId, async (tx) => {
    const created = await tx.household.create({
      data: { tenantId, ...toPrismaData(values) },
      select: { id: true },
    });
    await recordAudit(tx, tenantId, {
      actorId: user.id,
      action: 'CREATE',
      entityType: 'Household',
      entityId: created.id,
      summary: '世帯を新規登録',
    });
  });

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

  // M-5: 楽観ロックトークン (epoch ms 文字列)。空なら検証をスキップ (後方互換)。
  const expectedUpdatedAt = (() => {
    const v = formData.get('expectedUpdatedAt');
    return typeof v === 'string' ? v : '';
  })();

  const user = await requireCapability('update');
  const tenantId = user.tenantId;

  try {
    await withTenant(tenantId, async (tx) => {
      if (expectedUpdatedAt.length > 0) {
        const current = await tx.household.findUnique({
          where: { id: idRaw },
          select: { updatedAt: true },
        });
        if (!current) {
          throw new Error('対象の世帯が見つかりませんでした。');
        }
        assertNotStale(expectedUpdatedAt, current.updatedAt);
      }
      await tx.household.update({
        where: { id: idRaw },
        data: toPrismaData(values),
      });
      await recordAudit(tx, tenantId, {
        actorId: user.id,
        action: 'UPDATE',
        entityType: 'Household',
        entityId: idRaw,
        summary: '世帯を編集',
      });
    });
  } catch (e) {
    if (isStaleError(e)) {
      return {
        status: 'error',
        values,
        formError:
          '他の方がこの内容を更新されました。最新の内容を読み込み直してください。',
      };
    }
    throw e;
  }

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

  const user = await requireCapability('destructive');
  const tenantId = user.tenantId;
  await withTenant(tenantId, async (tx) => {
    await tx.household.update({
      where: { id: idRaw },
      data: { isActive: false },
    });
    await recordAudit(tx, tenantId, {
      actorId: user.id,
      action: 'DELETE',
      entityType: 'Household',
      entityId: idRaw,
      summary: '世帯を離檀 (論理削除)',
    });
  });

  revalidatePath('/danshintoto');
  redirect('/danshintoto');
}
