'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireCapability } from '@/lib/auth';
import { recordAudit } from '@/lib/audit';
import { assertValidUuid, isValidUuid, withTenant } from '@/lib/db';
import { parseIsoDate } from '@/lib/grave/date';
import type { BurialFormState } from './types';

function readField(formData: FormData, name: string): string {
  const v = formData.get(name);
  return typeof v === 'string' ? v.trim() : '';
}

function nullIfBlank(value: string): string | null {
  return value.length === 0 ? null : value;
}

/**
 * 納骨を記録する (区画詳細「納骨を記録」フォーム)。
 * gravePlotId / personId は必須・UUID 検証。納骨日は @db.Date (UTC 保存)。
 */
export async function createBurialAction(
  _prev: BurialFormState,
  formData: FormData,
): Promise<BurialFormState> {
  const gravePlotId = readField(formData, 'gravePlotId');
  assertValidUuid(gravePlotId, 'gravePlotId');

  const personId = readField(formData, 'personId');
  const interredAtRaw = readField(formData, 'interredAt');
  const memo = readField(formData, 'memo');

  const errors: NonNullable<BurialFormState['errors']> = {};
  if (personId.length === 0) {
    errors.personId = '納骨する故人を選択してください。';
  } else if (!isValidUuid(personId)) {
    errors.personId = '故人の選択が不正です。';
  }

  let interredAt: Date | null = null;
  if (interredAtRaw.length > 0) {
    interredAt = parseIsoDate(interredAtRaw);
    if (interredAt === null) {
      errors.interredAt = '日付の形式が正しくありません。';
    }
  }

  if (memo.length > 500) {
    errors.memo = '500 文字以内でご入力ください。';
  }

  if (Object.keys(errors).length > 0) {
    return {
      status: 'error',
      errors,
      values: { personId, interredAt: interredAtRaw, memo },
    };
  }

  const user = await requireCapability('create');
  const tenantId = user.tenantId;
  const householdId = await withTenant(tenantId, async (tx) => {
    // person が同テナントに属するか RLS 配下で確認 (他テナント Person の納骨を防ぐ)。
    const person = await tx.person.findUnique({
      where: { id: personId },
      select: { householdId: true },
    });
    if (!person) {
      throw new Error('対象の故人が見つかりませんでした。');
    }
    const burial = await tx.burial.create({
      data: {
        tenantId,
        gravePlotId,
        personId,
        interredAt,
        memo: nullIfBlank(memo),
      },
      select: { id: true },
    });
    await recordAudit(tx, tenantId, {
      actorId: user.id,
      action: 'CREATE',
      entityType: 'Burial',
      entityId: burial.id,
      summary: '納骨を記録',
    });
    return person.householdId;
  });

  revalidatePath(`/kukaku/${gravePlotId}`);
  revalidatePath('/kukaku/map');
  if (householdId) revalidatePath(`/danshintoto/${householdId}`);
  redirect(`/kukaku/${gravePlotId}`);
}

/**
 * 改葬・分骨で区画から出した記録 (removedAt をセット)。論理削除ではなく履歴として残す。
 */
export async function setBurialRemovedAction(formData: FormData): Promise<void> {
  const burialId = readField(formData, 'burialId');
  const gravePlotId = readField(formData, 'gravePlotId');
  assertValidUuid(burialId, 'burialId');
  assertValidUuid(gravePlotId, 'gravePlotId');

  const removedAtRaw = readField(formData, 'removedAt');
  const removedAt = removedAtRaw.length > 0 ? parseIsoDate(removedAtRaw) : new Date();

  const user = await requireCapability('destructive');
  const tenantId = user.tenantId;
  const householdId = await withTenant(tenantId, async (tx) => {
    const burial = await tx.burial.findUnique({
      where: { id: burialId },
      select: { person: { select: { householdId: true } } },
    });
    await tx.burial.update({
      where: { id: burialId },
      data: { removedAt: removedAt ?? new Date() },
    });
    await recordAudit(tx, tenantId, {
      actorId: user.id,
      action: 'OTHER',
      entityType: 'Burial',
      entityId: burialId,
      summary: '納骨を改葬・分骨で区画から除外',
    });
    return burial?.person.householdId ?? null;
  });

  revalidatePath(`/kukaku/${gravePlotId}`);
  revalidatePath('/kukaku/map');
  if (householdId) revalidatePath(`/danshintoto/${householdId}`);
}

/**
 * 誤登録した納骨記録を除外する (論理削除)。物理削除はしない。
 */
export async function softDeleteBurialAction(formData: FormData): Promise<void> {
  const burialId = readField(formData, 'burialId');
  const gravePlotId = readField(formData, 'gravePlotId');
  assertValidUuid(burialId, 'burialId');
  assertValidUuid(gravePlotId, 'gravePlotId');

  const deletedReason = nullIfBlank(readField(formData, 'deletedReason'));

  const user = await requireCapability('softDelete');
  const tenantId = user.tenantId;
  const householdId = await withTenant(tenantId, async (tx) => {
    const burial = await tx.burial.findUnique({
      where: { id: burialId },
      select: { person: { select: { householdId: true } } },
    });
    await tx.burial.update({
      where: { id: burialId },
      data: { deletedAt: new Date(), deletedReason },
    });
    await recordAudit(tx, tenantId, {
      actorId: user.id,
      action: 'DELETE',
      entityType: 'Burial',
      entityId: burialId,
      summary: '納骨記録を誤登録として除外 (論理削除)',
    });
    return burial?.person.householdId ?? null;
  });

  revalidatePath(`/kukaku/${gravePlotId}`);
  revalidatePath('/kukaku/map');
  if (householdId) revalidatePath(`/danshintoto/${householdId}`);
}
