'use server';

import type { CircuitStopStatus, CircuitTourType } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireCapability } from '@/lib/auth';
import { recordAudit } from '@/lib/audit';
import { assertValidUuid, withTenant } from '@/lib/db';
import type {
  StopFieldName,
  StopFormState,
  TourFieldName,
  TourFormState,
} from './types';

function readField(formData: FormData, name: string): string {
  const v = formData.get(name);
  return typeof v === 'string' ? v.trim() : '';
}

function nullIfBlank(value: string): string | null {
  return value.length === 0 ? null : value;
}

// kukaku/actions.ts#parseIsoDate と同一実装 (@db.Date を UTC0時で保存・getUTC* で検証)。
function parseIsoDate(raw: string): Date | null {
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

const TOUR_TYPES = ['TANAGYO', 'TSUKIMAIRI', 'OTHER'] as const;
const TOUR_STATUSES = ['PLANNED', 'DONE', 'CANCELED'] as const;
const STOP_STATUSES = ['PENDING', 'VISITED', 'SKIPPED'] as const;

function parseEnum<T extends string>(
  raw: string,
  allowed: readonly T[],
): T | null {
  return (allowed as readonly string[]).includes(raw) ? (raw as T) : null;
}

// ---- 巡回 (CircuitTour) ----

type TourValues = Record<TourFieldName, string>;

function extractTourValues(formData: FormData): TourValues {
  return {
    title: readField(formData, 'title'),
    tourType: readField(formData, 'tourType'),
    scheduledDate: readField(formData, 'scheduledDate'),
    assignedUserId: readField(formData, 'assignedUserId'),
    memo: readField(formData, 'memo'),
  };
}

function validateTour(values: TourValues): {
  errors: NonNullable<TourFormState['errors']>;
  tourType: CircuitTourType;
  scheduledDate: Date | null;
} {
  const errors: NonNullable<TourFormState['errors']> = {};

  if (values.title.length === 0) {
    errors.title = '巡回名をご入力ください。';
  } else if (values.title.length > 60) {
    errors.title = '60 文字以内でご入力ください。';
  }

  // 空なら既定 TANAGYO。値が入っているが不正なら誤りとして返す。
  let tourType: CircuitTourType = 'TANAGYO';
  if (values.tourType.length > 0) {
    const parsed = parseEnum(values.tourType, TOUR_TYPES);
    if (parsed === null) {
      errors.tourType = '巡回種別が正しくありません。';
    } else {
      tourType = parsed;
    }
  }

  let scheduledDate: Date | null = null;
  if (values.scheduledDate.length === 0) {
    errors.scheduledDate = '実施日をご入力ください。';
  } else {
    scheduledDate = parseIsoDate(values.scheduledDate);
    if (scheduledDate === null) {
      errors.scheduledDate = '日付の形式が正しくありません。';
    }
  }

  if (values.assignedUserId.length > 0) {
    assertValidUuid(values.assignedUserId, 'assignedUserId');
  }

  if (values.memo.length > 2000) {
    errors.memo = '2000 文字以内でご入力ください。';
  }

  return { errors, tourType, scheduledDate };
}

/**
 * 巡回 (棚経・月参り) の新規登録。詳細ページ内編集の流儀に合わせ FormState を返す。
 */
export async function createCircuitTourAction(
  _prev: TourFormState,
  formData: FormData,
): Promise<TourFormState> {
  const values = extractTourValues(formData);
  const v = validateTour(values);
  if (Object.keys(v.errors).length > 0 || v.scheduledDate === null) {
    return { status: 'error', errors: v.errors, values };
  }

  const user = await requireCapability('create');
  const tenantId = user.tenantId;
  const scheduledDate = v.scheduledDate;

  await withTenant(tenantId, async (tx) => {
    const created = await tx.circuitTour.create({
      data: {
        tenantId,
        title: values.title,
        tourType: v.tourType,
        scheduledDate,
        assignedUserId: nullIfBlank(values.assignedUserId),
        memo: nullIfBlank(values.memo),
      },
      select: { id: true },
    });
    await recordAudit(tx, tenantId, {
      actorId: user.id,
      action: 'CREATE',
      entityType: 'CircuitTour',
      entityId: created.id,
      summary: `巡回を新規登録 (${v.tourType})`,
    });
  });

  revalidatePath('/junkai');
  return { status: 'success' };
}

/**
 * 巡回の編集。RLS により他テナントの id は不可視。論理削除済みは対象外。
 */
export async function updateCircuitTourAction(
  _prev: TourFormState,
  formData: FormData,
): Promise<TourFormState> {
  const id = readField(formData, 'circuitTourId');
  if (id.length === 0) {
    return { status: 'error', errors: {}, values: extractTourValues(formData) };
  }
  assertValidUuid(id, 'circuitTourId');

  const values = extractTourValues(formData);
  const v = validateTour(values);
  if (Object.keys(v.errors).length > 0 || v.scheduledDate === null) {
    return { status: 'error', errors: v.errors, values };
  }

  const user = await requireCapability('update');
  const tenantId = user.tenantId;
  const scheduledDate = v.scheduledDate;

  await withTenant(tenantId, async (tx) => {
    const existing = await tx.circuitTour.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });
    if (!existing) {
      throw new Error('対象の巡回が見つかりませんでした。');
    }
    await tx.circuitTour.update({
      where: { id },
      data: {
        title: values.title,
        tourType: v.tourType,
        scheduledDate,
        assignedUserId: nullIfBlank(values.assignedUserId),
        memo: nullIfBlank(values.memo),
      },
    });
    await recordAudit(tx, tenantId, {
      actorId: user.id,
      action: 'UPDATE',
      entityType: 'CircuitTour',
      entityId: id,
      summary: '巡回を編集',
    });
  });

  revalidatePath('/junkai');
  revalidatePath(`/junkai/${id}`);
  return { status: 'success' };
}

/**
 * 巡回の「除外」(論理削除)。deletedAt を立てるのみで物理削除はしない。冪等。
 */
export async function softDeleteCircuitTourAction(
  formData: FormData,
): Promise<void> {
  const id = readField(formData, 'circuitTourId');
  if (id.length === 0) {
    throw new Error('circuitTourId is required.');
  }
  assertValidUuid(id, 'circuitTourId');
  const reason = readField(formData, 'deletedReason');

  const user = await requireCapability('softDelete');
  const tenantId = user.tenantId;

  await withTenant(tenantId, async (tx) => {
    const existing = await tx.circuitTour.findFirst({
      where: { id },
      select: { id: true, deletedAt: true },
    });
    if (!existing) {
      throw new Error('対象の巡回が見つかりませんでした。');
    }
    if (existing.deletedAt !== null) return; // 冪等
    await tx.circuitTour.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedBy: user.id,
        deletedReason: nullIfBlank(reason),
      },
    });
    await recordAudit(tx, tenantId, {
      actorId: user.id,
      action: 'DELETE',
      entityType: 'CircuitTour',
      entityId: id,
      summary: '巡回を除外 (論理削除)',
    });
  });

  revalidatePath('/junkai');
  // 編集ページからの除外後に、論理削除済みで notFound() になる同ページへ留まらせず一覧へ戻す。
  redirect('/junkai');
}

/**
 * 巡回ステータスの変更 (PLANNED / DONE / CANCELED)。
 */
export async function setCircuitTourStatusAction(
  formData: FormData,
): Promise<void> {
  const id = readField(formData, 'circuitTourId');
  assertValidUuid(id, 'circuitTourId');
  const status = parseEnum(readField(formData, 'status'), TOUR_STATUSES);
  if (status === null) {
    throw new Error('巡回ステータスが正しくありません。');
  }

  const user = await requireCapability('update');
  const tenantId = user.tenantId;

  await withTenant(tenantId, async (tx) => {
    const existing = await tx.circuitTour.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });
    if (!existing) {
      throw new Error('対象の巡回が見つかりませんでした。');
    }
    await tx.circuitTour.update({
      where: { id },
      data: { status },
    });
    await recordAudit(tx, tenantId, {
      actorId: user.id,
      action: 'UPDATE',
      entityType: 'CircuitTour',
      entityId: id,
      summary: `巡回ステータス変更 (${status})`,
    });
  });

  revalidatePath('/junkai');
  revalidatePath(`/junkai/${id}`);
}

// ---- 巡回訪問先 (CircuitStop) ----

type StopValues = Record<StopFieldName, string>;

function extractStopValues(formData: FormData): StopValues {
  return {
    householdId: readField(formData, 'householdId'),
    gravePlotId: readField(formData, 'gravePlotId'),
    visitLabel: readField(formData, 'visitLabel'),
    memo: readField(formData, 'memo'),
  };
}

/**
 * 巡回訪問先の追加。訪問先は世帯 / 区画 / 自由記述のいずれか1つ以上が必須。
 * sortOrder は当該巡回の現在最大 + 1 を採番し末尾へ。
 */
export async function addCircuitStopAction(
  _prev: StopFormState,
  formData: FormData,
): Promise<StopFormState> {
  const circuitTourId = readField(formData, 'circuitTourId');
  assertValidUuid(circuitTourId, 'circuitTourId');

  const values = extractStopValues(formData);
  const errors: NonNullable<StopFormState['errors']> = {};

  if (values.householdId.length > 0) {
    assertValidUuid(values.householdId, 'householdId');
  }
  if (values.gravePlotId.length > 0) {
    assertValidUuid(values.gravePlotId, 'gravePlotId');
  }
  if (
    values.householdId.length === 0 &&
    values.gravePlotId.length === 0 &&
    values.visitLabel.length === 0
  ) {
    errors.visitLabel = '訪問先 (世帯・区画・または記述) をご指定ください。';
  }
  if (values.visitLabel.length > 120) {
    errors.visitLabel = '120 文字以内でご入力ください。';
  }
  if (values.memo.length > 500) {
    errors.memo = '500 文字以内でご入力ください。';
  }
  if (Object.keys(errors).length > 0) {
    return { status: 'error', errors, values };
  }

  const householdId = nullIfBlank(values.householdId);
  const gravePlotId = nullIfBlank(values.gravePlotId);

  const user = await requireCapability('create');
  const tenantId = user.tenantId;

  await withTenant(tenantId, async (tx) => {
    const tour = await tx.circuitTour.findFirst({
      where: { id: circuitTourId, deletedAt: null },
      select: { id: true },
    });
    if (!tour) {
      throw new Error('対象の巡回が見つかりませんでした。');
    }

    // 指定された世帯 / 区画が自テナントに実在するか検証 (RLS 配下)。
    if (householdId !== null) {
      const household = await tx.household.findUnique({
        where: { id: householdId },
        select: { id: true },
      });
      if (!household) {
        throw new Error('対象が見つかりませんでした。');
      }
    }
    if (gravePlotId !== null) {
      const gravePlot = await tx.gravePlot.findUnique({
        where: { id: gravePlotId },
        select: { id: true },
      });
      if (!gravePlot) {
        throw new Error('対象が見つかりませんでした。');
      }
    }

    const last = await tx.circuitStop.findFirst({
      where: { circuitTourId },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });
    const nextOrder = (last?.sortOrder ?? -1) + 1;

    const created = await tx.circuitStop.create({
      data: {
        tenantId,
        circuitTourId,
        householdId,
        gravePlotId,
        visitLabel: nullIfBlank(values.visitLabel),
        sortOrder: nextOrder,
        memo: nullIfBlank(values.memo),
      },
      select: { id: true },
    });
    await recordAudit(tx, tenantId, {
      actorId: user.id,
      action: 'CREATE',
      entityType: 'CircuitStop',
      entityId: created.id,
      summary: '巡回訪問先を追加',
    });
  });

  revalidatePath(`/junkai/${circuitTourId}`);
  return { status: 'success' };
}

/**
 * 巡回訪問先の削除。履歴性が低いため物理削除する (権限は update)。
 */
export async function removeCircuitStopAction(
  formData: FormData,
): Promise<void> {
  const circuitTourId = readField(formData, 'circuitTourId');
  assertValidUuid(circuitTourId, 'circuitTourId');
  const circuitStopId = readField(formData, 'circuitStopId');
  assertValidUuid(circuitStopId, 'circuitStopId');

  const user = await requireCapability('update');
  const tenantId = user.tenantId;

  await withTenant(tenantId, async (tx) => {
    const existing = await tx.circuitStop.findFirst({
      where: { id: circuitStopId, circuitTourId },
      select: { id: true },
    });
    if (!existing) {
      throw new Error('対象の訪問先が見つかりませんでした。');
    }
    await tx.circuitStop.delete({ where: { id: circuitStopId } });
    await recordAudit(tx, tenantId, {
      actorId: user.id,
      action: 'DELETE',
      entityType: 'CircuitStop',
      entityId: circuitStopId,
      summary: '巡回訪問先を削除',
    });
  });

  revalidatePath(`/junkai/${circuitTourId}`);
}

/**
 * 訪問先の並べ替え: 対象巡回の stop id 配列を受け、sortOrder を 0 始まりで一括再採番する。
 * 担当者の明示的な手動操作であり「更新順自動再配列」(特許回避線) には当たらない。
 * 別巡回の id は where で弾かれ更新 0 件となり安全。
 */
export async function reorderCircuitStopsAction(
  circuitTourId: string,
  orderedIds: string[],
): Promise<void> {
  assertValidUuid(circuitTourId, 'circuitTourId');
  for (const id of orderedIds) {
    assertValidUuid(id, 'circuitStopId');
  }

  const user = await requireCapability('update');
  const tenantId = user.tenantId;

  await withTenant(tenantId, async (tx) => {
    const tour = await tx.circuitTour.findFirst({
      where: { id: circuitTourId, deletedAt: null },
      select: { id: true },
    });
    if (!tour) {
      throw new Error('対象の巡回が見つかりませんでした。');
    }
    // 部分配列・重複 id を受け取ると未採番の stop が残り sortOrder が重複しうる
    // (表示順が不定化)。当該巡回の全 stop をちょうど 1 度ずつ網羅する配列のみ許可する。
    if (new Set(orderedIds).size !== orderedIds.length) {
      throw new Error('訪問先の並べ替え対象が重複しています。');
    }
    const stopCount = await tx.circuitStop.count({ where: { circuitTourId } });
    if (stopCount !== orderedIds.length) {
      throw new Error('訪問先の並べ替え対象が一致しません。最新の内容を読み込み直してください。');
    }
    for (let i = 0; i < orderedIds.length; i += 1) {
      await tx.circuitStop.updateMany({
        where: { id: orderedIds[i], circuitTourId },
        data: { sortOrder: i },
      });
    }
    await recordAudit(tx, tenantId, {
      actorId: user.id,
      action: 'UPDATE',
      entityType: 'CircuitStop',
      entityId: circuitTourId,
      summary: `巡回訪問先を並べ替え (${orderedIds.length} 件)`,
    });
  });

  revalidatePath(`/junkai/${circuitTourId}`);
}

/**
 * 訪問先ステータスの変更 (PENDING / VISITED / SKIPPED)。
 */
export async function setCircuitStopStatusAction(
  formData: FormData,
): Promise<void> {
  const circuitTourId = readField(formData, 'circuitTourId');
  assertValidUuid(circuitTourId, 'circuitTourId');
  const circuitStopId = readField(formData, 'circuitStopId');
  assertValidUuid(circuitStopId, 'circuitStopId');
  const status: CircuitStopStatus | null = parseEnum(
    readField(formData, 'status'),
    STOP_STATUSES,
  );
  if (status === null) {
    throw new Error('訪問先ステータスが正しくありません。');
  }

  const user = await requireCapability('update');
  const tenantId = user.tenantId;

  await withTenant(tenantId, async (tx) => {
    const existing = await tx.circuitStop.findFirst({
      where: { id: circuitStopId, circuitTourId },
      select: { id: true },
    });
    if (!existing) {
      throw new Error('対象の訪問先が見つかりませんでした。');
    }
    await tx.circuitStop.update({
      where: { id: circuitStopId },
      data: { status },
    });
    await recordAudit(tx, tenantId, {
      actorId: user.id,
      action: 'UPDATE',
      entityType: 'CircuitStop',
      entityId: circuitStopId,
      summary: `巡回訪問先ステータス変更 (${status})`,
    });
  });

  revalidatePath(`/junkai/${circuitTourId}`);
}
