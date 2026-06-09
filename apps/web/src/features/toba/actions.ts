'use server';

import { revalidatePath } from 'next/cache';
import { requireCapability } from '@/lib/auth';
import { assertValidUuid, withTenant } from '@/lib/db';
import { validateTobaInput, type TobaInput } from '@/lib/toba/validate';
import type { TobaFormState } from './types';

function readField(formData: FormData, name: string): string {
  const v = formData.get(name);
  return typeof v === 'string' ? v.trim() : '';
}

function nullIfBlank(value: string): string | null {
  return value.length === 0 ? null : value;
}

function extractValues(formData: FormData): TobaInput {
  return {
    applicantName: readField(formData, 'applicantName'),
    targetPersonId: readField(formData, 'targetPersonId'),
    count: readField(formData, 'count'),
    inscription: readField(formData, 'inscription'),
    offeringAmount: readField(formData, 'offeringAmount'),
    memo: readField(formData, 'memo'),
  };
}

function revalidateService(memorialServiceId: string): void {
  revalidatePath(`/houyou/${memorialServiceId}`);
  revalidatePath(`/houyou/${memorialServiceId}/toba`);
}

/**
 * 塔婆申込の新規登録。読上順は法要内の末尾 (現在の最大 readingOrder + 1) に置く。
 */
export async function createTobaAction(
  _prev: TobaFormState,
  formData: FormData,
): Promise<TobaFormState> {
  const memorialServiceId = readField(formData, 'memorialServiceId');
  if (memorialServiceId.length === 0) {
    return { status: 'error', errors: {}, values: extractValues(formData) };
  }
  assertValidUuid(memorialServiceId, 'memorialServiceId');

  const values = extractValues(formData);
  const v = validateTobaInput(values);
  if (Object.keys(v.errors).length > 0) {
    return { status: 'error', errors: v.errors, values };
  }

  const tenantId = (await requireCapability('create')).tenantId;

  await withTenant(tenantId, async (tx) => {
    const service = await tx.memorialService.findUnique({
      where: { id: memorialServiceId },
      select: { id: true, householdId: true },
    });
    if (!service) {
      throw new Error('対象の法要が見つかりませんでした。');
    }

    const last = await tx.toba.findFirst({
      where: { memorialServiceId },
      orderBy: { readingOrder: 'desc' },
      select: { readingOrder: true },
    });
    const nextOrder = (last?.readingOrder ?? -1) + 1;

    await tx.toba.create({
      data: {
        tenantId,
        memorialServiceId,
        householdId: service.householdId,
        applicantName: values.applicantName,
        targetPersonId: nullIfBlank(values.targetPersonId),
        count: v.count,
        inscription: values.inscription,
        readingOrder: nextOrder,
        offeringAmount: v.offeringAmount,
        memo: nullIfBlank(values.memo),
      },
    });
  });

  revalidateService(memorialServiceId);
  return { status: 'idle' };
}

/**
 * 塔婆申込の編集。読上順は本アクションでは変更しない (並べ替えは reorder で扱う)。
 */
export async function updateTobaAction(
  _prev: TobaFormState,
  formData: FormData,
): Promise<TobaFormState> {
  const id = readField(formData, 'tobaId');
  const memorialServiceId = readField(formData, 'memorialServiceId');
  if (id.length === 0 || memorialServiceId.length === 0) {
    return { status: 'error', errors: {}, values: extractValues(formData) };
  }
  assertValidUuid(id, 'tobaId');
  assertValidUuid(memorialServiceId, 'memorialServiceId');

  const values = extractValues(formData);
  const v = validateTobaInput(values);
  if (Object.keys(v.errors).length > 0) {
    return { status: 'error', errors: v.errors, values };
  }

  const tenantId = (await requireCapability('update')).tenantId;

  await withTenant(tenantId, async (tx) => {
    const existing = await tx.toba.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) {
      throw new Error('対象の塔婆申込が見つかりませんでした。');
    }
    await tx.toba.update({
      where: { id },
      data: {
        applicantName: values.applicantName,
        targetPersonId: nullIfBlank(values.targetPersonId),
        count: v.count,
        inscription: values.inscription,
        offeringAmount: v.offeringAmount,
        memo: nullIfBlank(values.memo),
      },
    });
  });

  revalidateService(memorialServiceId);
  return { status: 'idle' };
}

export type TobaMutationResult =
  | { status: 'ok' }
  | { status: 'error'; message: string };

/**
 * 塔婆申込を削除する。塔婆は記録系ではなく運用データ (法要準備) なので物理削除でよい。
 */
export async function deleteTobaAction(input: {
  tobaId: string;
  memorialServiceId: string;
}): Promise<TobaMutationResult> {
  const { tobaId, memorialServiceId } = input;
  if (typeof tobaId !== 'string' || typeof memorialServiceId !== 'string') {
    return { status: 'error', message: '不正なリクエストです。' };
  }
  assertValidUuid(tobaId, 'tobaId');
  assertValidUuid(memorialServiceId, 'memorialServiceId');

  const tenantId = (await requireCapability('softDelete')).tenantId;
  try {
    await withTenant(tenantId, async (tx) => {
      const existing = await tx.toba.findUnique({
        where: { id: tobaId },
        select: { id: true },
      });
      if (!existing) {
        throw new Error('対象の塔婆申込が見つかりませんでした。');
      }
      await tx.toba.delete({ where: { id: tobaId } });
    });
  } catch (err) {
    return {
      status: 'error',
      message: err instanceof Error ? err.message : '削除に失敗しました。',
    };
  }

  revalidateService(memorialServiceId);
  return { status: 'ok' };
}

/**
 * 読上順を 1 つ上 / 下に入れ替える。
 * 法要内の readingOrder 昇順で隣り合う 2 件の readingOrder を swap する。
 */
export async function moveTobaAction(input: {
  tobaId: string;
  memorialServiceId: string;
  direction: 'up' | 'down';
}): Promise<TobaMutationResult> {
  const { tobaId, memorialServiceId, direction } = input;
  if (
    typeof tobaId !== 'string' ||
    typeof memorialServiceId !== 'string' ||
    (direction !== 'up' && direction !== 'down')
  ) {
    return { status: 'error', message: '不正なリクエストです。' };
  }
  assertValidUuid(tobaId, 'tobaId');
  assertValidUuid(memorialServiceId, 'memorialServiceId');

  const tenantId = (await requireCapability('update')).tenantId;
  try {
    await withTenant(tenantId, async (tx) => {
      const list = await tx.toba.findMany({
        where: { memorialServiceId },
        orderBy: [{ readingOrder: 'asc' }, { createdAt: 'asc' }],
        select: { id: true, readingOrder: true },
      });
      const index = list.findIndex((t) => t.id === tobaId);
      if (index === -1) {
        throw new Error('対象の塔婆申込が見つかりませんでした。');
      }
      const swapIndex = direction === 'up' ? index - 1 : index + 1;
      if (swapIndex < 0 || swapIndex >= list.length) {
        return; // 端なので何もしない
      }
      const current = list[index];
      const neighbor = list[swapIndex];
      if (!current || !neighbor) return;

      // readingOrder が同値 (旧データ等) の場合に備え、index ベースで再採番する。
      await tx.toba.update({
        where: { id: current.id },
        data: { readingOrder: swapIndex },
      });
      await tx.toba.update({
        where: { id: neighbor.id },
        data: { readingOrder: index },
      });
    });
  } catch (err) {
    return {
      status: 'error',
      message: err instanceof Error ? err.message : '並べ替えに失敗しました。',
    };
  }

  revalidateService(memorialServiceId);
  return { status: 'ok' };
}
