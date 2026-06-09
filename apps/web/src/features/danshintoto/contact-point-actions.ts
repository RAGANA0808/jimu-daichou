'use server';

import { revalidatePath } from 'next/cache';
import { requireCapability } from '@/lib/auth';
import { assertValidUuid, withTenant } from '@/lib/db';
import {
  normalizePhoneForStorage,
  normalizePostalCode,
} from '@/lib/search/normalize';
import type {
  ContactPointFieldName,
  ContactPointFormState,
} from './contact-point-types';

function readField(formData: FormData, name: string): string {
  const v = formData.get(name);
  return typeof v === 'string' ? v.trim() : '';
}

function nullIfBlank(value: string): string | null {
  return value.length === 0 ? null : value;
}

type ContactPointValues = Record<ContactPointFieldName, string>;

function extractValues(formData: FormData): ContactPointValues {
  return {
    relationLabel: readField(formData, 'relationLabel'),
    name: readField(formData, 'name'),
    phone: readField(formData, 'phone'),
    mobile: readField(formData, 'mobile'),
    email: readField(formData, 'email'),
    postalCode: readField(formData, 'postalCode'),
    address: readField(formData, 'address'),
    note: readField(formData, 'note'),
  };
}

/**
 * 入力検証。エラー文言は一般化し、連絡先の氏名・電話・メール等を含めない (個人情報非露出)。
 */
function validate(
  values: ContactPointValues,
): NonNullable<ContactPointFormState['errors']> {
  const errors: NonNullable<ContactPointFormState['errors']> = {};

  if (values.relationLabel.length === 0) {
    errors.relationLabel = '続柄・役割をご入力ください。';
  } else if (values.relationLabel.length > 60) {
    errors.relationLabel = '60 文字以内でご入力ください。';
  }

  if (values.name.length > 60) {
    errors.name = '60 文字以内でご入力ください。';
  }

  if (
    values.email.length > 0 &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)
  ) {
    errors.email = 'メールアドレスの形式が正しくありません。';
  }

  if (values.note.length > 500) {
    errors.note = '500 文字以内でご入力ください。';
  }

  return errors;
}

/** C-6 正規化を適用しつつ DB 書き込み用データへ整形する。 */
function toPrismaData(values: ContactPointValues) {
  return {
    relationLabel: values.relationLabel,
    name: nullIfBlank(values.name),
    phone: nullIfBlank(normalizePhoneForStorage(values.phone)),
    mobile: nullIfBlank(normalizePhoneForStorage(values.mobile)),
    email: nullIfBlank(values.email),
    postalCode: nullIfBlank(normalizePostalCode(values.postalCode)),
    address: nullIfBlank(values.address),
    note: nullIfBlank(values.note),
  };
}

/** personId 入力 (任意・select)。空 or 不正は null として扱う。 */
function readOptionalPersonId(formData: FormData): string | null {
  const raw = readField(formData, 'personId');
  if (raw.length === 0) return null;
  assertValidUuid(raw, 'personId');
  return raw;
}

/**
 * 連絡先の新規追加。sortOrder は当該世帯の現在最大 + 1 を採番し末尾へ。
 * person は任意紐付け。家族構成員以外 (世帯外の親族等) は personId なしで登録できる。
 */
export async function createContactPointAction(
  _prev: ContactPointFormState,
  formData: FormData,
): Promise<ContactPointFormState> {
  const householdId = readField(formData, 'householdId');
  assertValidUuid(householdId, 'householdId');

  const values = extractValues(formData);
  const errors = validate(values);
  if (Object.keys(errors).length > 0) {
    return { status: 'error', errors, values };
  }
  const personId = readOptionalPersonId(formData);

  const tenantId = (await requireCapability('create')).tenantId;
  await withTenant(tenantId, async (tx) => {
    const household = await tx.household.findUnique({
      where: { id: householdId },
      select: { id: true },
    });
    if (!household) {
      throw new Error('対象の世帯が見つかりませんでした。');
    }

    // 同一世帯の連絡先 (除外含む) の最大 sortOrder を採番起点にする。
    const last = await tx.contactPoint.findFirst({
      where: { householdId },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });
    const nextOrder = (last?.sortOrder ?? -1) + 1;

    await tx.contactPoint.create({
      data: {
        tenantId,
        householdId,
        personId,
        sortOrder: nextOrder,
        ...toPrismaData(values),
      },
      select: { id: true },
    });
  });

  revalidatePath(`/danshintoto/${householdId}`);
  return { status: 'success' };
}

/**
 * 連絡先の編集。RLS により他テナントの id は見えないため tenantId 検証は不要。
 */
export async function updateContactPointAction(
  _prev: ContactPointFormState,
  formData: FormData,
): Promise<ContactPointFormState> {
  const householdId = readField(formData, 'householdId');
  assertValidUuid(householdId, 'householdId');
  const contactPointId = readField(formData, 'contactPointId');
  assertValidUuid(contactPointId, 'contactPointId');

  const values = extractValues(formData);
  const errors = validate(values);
  if (Object.keys(errors).length > 0) {
    return { status: 'error', errors, values };
  }
  const personId = readOptionalPersonId(formData);

  const tenantId = (await requireCapability('update')).tenantId;
  await withTenant(tenantId, async (tx) => {
    const existing = await tx.contactPoint.findFirst({
      where: { id: contactPointId, householdId, deletedAt: null },
      select: { id: true },
    });
    if (!existing) {
      throw new Error('対象の連絡先が見つかりませんでした。');
    }
    await tx.contactPoint.update({
      where: { id: contactPointId },
      data: { personId, ...toPrismaData(values) },
    });
  });

  revalidatePath(`/danshintoto/${householdId}`);
  return { status: 'success' };
}

/**
 * 連絡先の「除外」(論理削除)。deletedAt を立てるのみで物理削除はしない。冪等。
 */
export async function deleteContactPointAction(
  formData: FormData,
): Promise<void> {
  const householdId = readField(formData, 'householdId');
  assertValidUuid(householdId, 'householdId');
  const contactPointId = readField(formData, 'contactPointId');
  assertValidUuid(contactPointId, 'contactPointId');

  const tenantId = (await requireCapability('softDelete')).tenantId;
  await withTenant(tenantId, async (tx) => {
    const existing = await tx.contactPoint.findFirst({
      where: { id: contactPointId, householdId },
      select: { id: true, deletedAt: true },
    });
    if (!existing) {
      throw new Error('対象の連絡先が見つかりませんでした。');
    }
    if (existing.deletedAt !== null) return; // 冪等
    await tx.contactPoint.update({
      where: { id: contactPointId },
      data: { deletedAt: new Date() },
    });
  });

  revalidatePath(`/danshintoto/${householdId}`);
}

/**
 * 主たる連絡先フラグ (isPrimary) のトグル。単なる目印で 1 件制約等は課さない。
 */
export async function toggleContactPointPrimaryAction(
  formData: FormData,
): Promise<void> {
  const householdId = readField(formData, 'householdId');
  assertValidUuid(householdId, 'householdId');
  const contactPointId = readField(formData, 'contactPointId');
  assertValidUuid(contactPointId, 'contactPointId');
  const target = formData.get('isPrimary') === 'true';

  const tenantId = (await requireCapability('update')).tenantId;
  await withTenant(tenantId, async (tx) => {
    const existing = await tx.contactPoint.findFirst({
      where: { id: contactPointId, householdId, deletedAt: null },
      select: { id: true },
    });
    if (!existing) {
      throw new Error('対象の連絡先が見つかりませんでした。');
    }
    await tx.contactPoint.update({
      where: { id: contactPointId },
      data: { isPrimary: target },
    });
  });

  revalidatePath(`/danshintoto/${householdId}`);
}

/**
 * 並べ替え: 対象世帯の連絡先 id 配列を受け、sortOrder を 0 始まりで一括再採番する。
 * 担当者の明示的な手動操作であり「更新順自動再配列」(特許回避線) には当たらない。
 * 当該世帯に属さない id は where で弾かれ更新 0 件となり安全。
 */
export async function reorderContactPointsAction(
  householdId: string,
  orderedIds: string[],
): Promise<void> {
  assertValidUuid(householdId, 'householdId');
  for (const id of orderedIds) {
    assertValidUuid(id, 'contactPointId');
  }

  const tenantId = (await requireCapability('update')).tenantId;
  await withTenant(tenantId, async (tx) => {
    for (let i = 0; i < orderedIds.length; i += 1) {
      await tx.contactPoint.updateMany({
        where: { id: orderedIds[i], householdId, deletedAt: null },
        data: { sortOrder: i },
      });
    }
  });

  revalidatePath(`/danshintoto/${householdId}`);
}
