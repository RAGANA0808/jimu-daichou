'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireCurrentTenantId } from '@/lib/auth';
import { assertValidUuid, withTenant } from '@/lib/db';
import type {
  FamilyMemberFieldName,
  FamilyMemberFormState,
} from './types';

function readField(formData: FormData, name: string): string {
  const v = formData.get(name);
  return typeof v === 'string' ? v.trim() : '';
}

function nullIfBlank(value: string): string | null {
  return value.length === 0 ? null : value;
}

type FamilyMemberValues = Record<FamilyMemberFieldName, string>;

function extractValues(formData: FormData): FamilyMemberValues {
  return {
    name: readField(formData, 'name'),
    nameKana: readField(formData, 'nameKana'),
    familyRelation: readField(formData, 'familyRelation'),
    birthDate: readField(formData, 'birthDate'),
  };
}

function parseBirthDate(raw: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const [y, m, d] = raw.split('-').map((s) => Number.parseInt(s, 10));
  if (
    typeof y !== 'number' ||
    typeof m !== 'number' ||
    typeof d !== 'number' ||
    Number.isNaN(y) ||
    Number.isNaN(m) ||
    Number.isNaN(d)
  ) {
    return null;
  }
  const date = new Date(Date.UTC(y, m - 1, d));
  if (
    date.getUTCFullYear() !== y ||
    date.getUTCMonth() + 1 !== m ||
    date.getUTCDate() !== d
  ) {
    return null;
  }
  return date;
}

function validate(values: FamilyMemberValues): {
  errors: NonNullable<FamilyMemberFormState['errors']>;
  birthDate: Date | null;
} {
  const errors: NonNullable<FamilyMemberFormState['errors']> = {};

  if (values.name.length === 0) {
    errors.name = '氏名をご入力ください。';
  } else if (values.name.length > 60) {
    errors.name = '60 文字以内でご入力ください。';
  }

  if (values.nameKana.length === 0) {
    errors.nameKana = 'ふりがなをご入力ください。';
  } else if (values.nameKana.length > 60) {
    errors.nameKana = '60 文字以内でご入力ください。';
  }

  if (values.familyRelation.length > 40) {
    errors.familyRelation = '40 文字以内でご入力ください。';
  }

  let birthDate: Date | null = null;
  if (values.birthDate.length > 0) {
    birthDate = parseBirthDate(values.birthDate);
    if (birthDate === null) {
      errors.birthDate = '日付の形式が正しくありません。';
    }
  }

  return { errors, birthDate };
}

/**
 * 家族構成員 (生存者) の新規登録。
 */
export async function createFamilyMemberAction(
  _prev: FamilyMemberFormState,
  formData: FormData,
): Promise<FamilyMemberFormState> {
  const householdId = readField(formData, 'householdId');
  if (householdId.length === 0) {
    return { status: 'error', errors: {}, values: extractValues(formData) };
  }
  assertValidUuid(householdId, 'householdId');

  const values = extractValues(formData);
  const v = validate(values);
  if (Object.keys(v.errors).length > 0) {
    return { status: 'error', errors: v.errors, values };
  }

  const tenantId = await requireCurrentTenantId();

  await withTenant(tenantId, (tx) =>
    tx.person.create({
      data: {
        tenantId,
        householdId,
        name: values.name,
        nameKana: values.nameKana,
        familyRelation: nullIfBlank(values.familyRelation),
        birthDate: v.birthDate,
        isDeceased: false,
      },
    }),
  );

  revalidatePath(`/danshintoto/${householdId}`);
  redirect(`/danshintoto/${householdId}`);
}

/**
 * 家族構成員の編集。
 * 故人 (isDeceased=true) の編集はここではさせない (過去帳経由のみ)。
 */
export async function updateFamilyMemberAction(
  _prev: FamilyMemberFormState,
  formData: FormData,
): Promise<FamilyMemberFormState> {
  const personId = readField(formData, 'personId');
  if (personId.length === 0) {
    return { status: 'error', errors: {}, values: extractValues(formData) };
  }
  assertValidUuid(personId, 'personId');

  const values = extractValues(formData);
  const v = validate(values);
  if (Object.keys(v.errors).length > 0) {
    return { status: 'error', errors: v.errors, values };
  }

  const tenantId = await requireCurrentTenantId();

  const householdId = await withTenant(tenantId, async (tx) => {
    const existing = await tx.person.findUnique({
      where: { id: personId },
      select: { householdId: true, isDeceased: true },
    });
    if (!existing) {
      throw new Error('対象の家族構成員が見つかりませんでした。');
    }
    if (existing.isDeceased) {
      throw new Error(
        '故人の情報は過去帳から編集してください (家族構成員からは編集できません)。',
      );
    }
    await tx.person.update({
      where: { id: personId },
      data: {
        name: values.name,
        nameKana: values.nameKana,
        familyRelation: nullIfBlank(values.familyRelation),
        birthDate: v.birthDate,
      },
    });
    return existing.householdId;
  });

  revalidatePath(`/danshintoto/${householdId}`);
  redirect(`/danshintoto/${householdId}`);
}

/**
 * 家族構成員の削除 (物理削除)。
 * 故人 (過去帳に紐づく Person) は削除できない (過去帳の歴史的価値のため)。
 * living member のみ削除可。
 */
export async function deleteFamilyMemberAction(
  formData: FormData,
): Promise<void> {
  const personId = readField(formData, 'personId');
  if (personId.length === 0) {
    throw new Error('personId is required.');
  }
  assertValidUuid(personId, 'personId');

  const tenantId = await requireCurrentTenantId();

  const householdId = await withTenant(tenantId, async (tx) => {
    const existing = await tx.person.findUnique({
      where: { id: personId },
      select: {
        householdId: true,
        isDeceased: true,
        deathLedgerEntry: { select: { id: true } },
      },
    });
    if (!existing) {
      throw new Error('対象の家族構成員が見つかりませんでした。');
    }
    if (existing.isDeceased || existing.deathLedgerEntry) {
      throw new Error(
        '過去帳に登録されている故人は削除できません (論理削除は過去帳側で行ってください)。',
      );
    }
    await tx.person.delete({ where: { id: personId } });
    return existing.householdId;
  });

  revalidatePath(`/danshintoto/${householdId}`);
  redirect(`/danshintoto/${householdId}`);
}
