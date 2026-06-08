'use server';

import { Prisma } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { requireCapability } from '@/lib/auth';
import { assertValidUuid, withTenant } from '@/lib/db';
import { normalizeTagColor } from './tag-colors';
import type { TagFormState } from './tag-types';

function readField(formData: FormData, name: string): string {
  const v = formData.get(name);
  return typeof v === 'string' ? v.trim() : '';
}

function validateName(name: string): string | null {
  if (name.length === 0) return 'タグ名をご入力ください。';
  if (name.length > 30) return 'タグ名は 30 文字以内でご入力ください。';
  return null;
}

/**
 * タグマスタを新規作成する (世帯への付与は伴わない)。
 * (tenantId, name) 重複は P2002 を握って status:'error' に変換する。
 */
export async function createTagAction(
  _prev: TagFormState,
  formData: FormData,
): Promise<TagFormState> {
  const name = readField(formData, 'name');
  const color = normalizeTagColor(readField(formData, 'color'));

  const nameError = validateName(name);
  if (nameError) {
    return { status: 'error', error: nameError, values: { name, color } };
  }

  const tenantId = (await requireCapability('create')).tenantId;

  try {
    await withTenant(tenantId, (tx) =>
      tx.tag.create({
        data: { tenantId, name, color },
        select: { id: true },
      }),
    );
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2002'
    ) {
      return {
        status: 'error',
        error: '同名のタグが既にあります。',
        values: { name, color },
      };
    }
    throw err;
  }

  revalidatePath('/danshintoto');
  return { status: 'success' };
}

/**
 * 既存タグを世帯に付与する。
 * tagId が他テナントなら RLS で見えず弾く。重複付与は冪等 (成功扱い)。
 */
export async function addTagToHousehold(formData: FormData): Promise<void> {
  const householdId = readField(formData, 'householdId');
  assertValidUuid(householdId, 'householdId');
  const tagId = readField(formData, 'tagId');
  assertValidUuid(tagId, 'tagId');

  const tenantId = (await requireCapability('update')).tenantId;

  await withTenant(tenantId, async (tx) => {
    const household = await tx.household.findUnique({
      where: { id: householdId },
      select: { id: true },
    });
    if (!household) {
      throw new Error('対象の世帯が見つかりませんでした。');
    }
    const tag = await tx.tag.findUnique({
      where: { id: tagId },
      select: { id: true },
    });
    if (!tag) {
      throw new Error('対象のタグが見つかりませんでした。');
    }
    try {
      await tx.householdTag.create({
        data: { tenantId, householdId, tagId },
        select: { id: true },
      });
    } catch (err) {
      // 既に付与済み (@@unique([householdId, tagId])) は冪等に成功扱い。
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        return;
      }
      throw err;
    }
  });

  revalidatePath('/danshintoto');
  revalidatePath(`/danshintoto/${householdId}`);
}

/**
 * 新規タグを作成しつつ同時に世帯へ付与する。
 * 既存同名タグがあればそれを再利用する (二重作成 P2002 を回避)。
 */
export async function createAndAddTagToHousehold(
  _prev: TagFormState,
  formData: FormData,
): Promise<TagFormState> {
  const householdId = readField(formData, 'householdId');
  assertValidUuid(householdId, 'householdId');
  const name = readField(formData, 'name');
  const color = normalizeTagColor(readField(formData, 'color'));

  const nameError = validateName(name);
  if (nameError) {
    return { status: 'error', error: nameError, values: { name, color } };
  }

  const tenantId = (await requireCapability('create')).tenantId;

  try {
    await withTenant(tenantId, async (tx) => {
      const household = await tx.household.findUnique({
        where: { id: householdId },
        select: { id: true },
      });
      if (!household) {
        throw new Error('対象の世帯が見つかりませんでした。');
      }

      const existing = await tx.tag.findUnique({
        where: { tenantId_name: { tenantId, name } },
        select: { id: true },
      });
      const tag =
        existing ??
        (await tx.tag.create({
          data: { tenantId, name, color },
          select: { id: true },
        }));

      try {
        await tx.householdTag.create({
          data: { tenantId, householdId, tagId: tag.id },
          select: { id: true },
        });
      } catch (err) {
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === 'P2002'
        ) {
          return;
        }
        throw err;
      }
    });
  } catch (err) {
    if (err instanceof Error && err.message === '対象の世帯が見つかりませんでした。') {
      return { status: 'error', error: err.message, values: { name, color } };
    }
    throw err;
  }

  revalidatePath('/danshintoto');
  revalidatePath(`/danshintoto/${householdId}`);
  return { status: 'success' };
}

/**
 * 世帯からタグを解除する (HouseholdTag を物理削除。タグマスタ自体は残す)。
 */
export async function removeTagFromHousehold(formData: FormData): Promise<void> {
  const householdId = readField(formData, 'householdId');
  assertValidUuid(householdId, 'householdId');
  const tagId = readField(formData, 'tagId');
  assertValidUuid(tagId, 'tagId');

  const tenantId = (await requireCapability('softDelete')).tenantId;

  await withTenant(tenantId, (tx) =>
    tx.householdTag.deleteMany({
      where: { householdId, tagId },
    }),
  );

  revalidatePath('/danshintoto');
  revalidatePath(`/danshintoto/${householdId}`);
}
