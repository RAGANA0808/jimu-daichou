'use server';

import type { GravePlotStatus, GravePlotType } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireCurrentTenantId } from '@/lib/auth';
import { assertValidUuid, isValidUuid, withTenant } from '@/lib/db';
import type {
  GravePlotFieldName,
  GravePlotFormState,
} from './types';
import {
  GRAVE_PLOT_STATUS_ORDER,
  GRAVE_PLOT_TYPE_ORDER,
} from './types';

function readField(formData: FormData, name: string): string {
  const v = formData.get(name);
  return typeof v === 'string' ? v.trim() : '';
}

function nullIfBlank(value: string): string | null {
  return value.length === 0 ? null : value;
}

type GravePlotValues = Record<GravePlotFieldName, string>;

function extractValues(formData: FormData): GravePlotValues {
  return {
    plotNumber: readField(formData, 'plotNumber'),
    plotType: readField(formData, 'plotType'),
    status: readField(formData, 'status'),
    householdId: readField(formData, 'householdId'),
    areaId: readField(formData, 'areaId'),
    contractDate: readField(formData, 'contractDate'),
    contractPlan: readField(formData, 'contractPlan'),
    memo: readField(formData, 'memo'),
  };
}

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

function validate(values: GravePlotValues): {
  errors: NonNullable<GravePlotFormState['errors']>;
  plotType: GravePlotType | null;
  status: GravePlotStatus | null;
  householdId: string | null;
  areaId: string | null;
  contractDate: Date | null;
} {
  const errors: NonNullable<GravePlotFormState['errors']> = {};

  if (values.plotNumber.length === 0) {
    errors.plotNumber = '区画番号をご入力ください。';
  } else if (values.plotNumber.length > 40) {
    errors.plotNumber = '40 文字以内でご入力ください。';
  }

  let plotType: GravePlotType | null = null;
  if (values.plotType.length === 0) {
    errors.plotType = '区画種別を選択してください。';
  } else if ((GRAVE_PLOT_TYPE_ORDER as string[]).includes(values.plotType)) {
    plotType = values.plotType as GravePlotType;
  } else {
    errors.plotType = '区画種別の値が不正です。';
  }

  let status: GravePlotStatus = 'AVAILABLE';
  if (values.status.length > 0) {
    if ((GRAVE_PLOT_STATUS_ORDER as string[]).includes(values.status)) {
      status = values.status as GravePlotStatus;
    } else {
      errors.status = '状態の値が不正です。';
    }
  }

  let householdId: string | null = null;
  if (values.householdId.length > 0) {
    if (isValidUuid(values.householdId)) {
      householdId = values.householdId;
    } else {
      errors.householdId = '契約世帯の選択が不正です。';
    }
  }

  // IN_USE / RESERVED の場合は契約世帯が必要 (業務ルール)
  if (
    (status === 'IN_USE' || status === 'RESERVED') &&
    householdId === null &&
    !errors.householdId
  ) {
    errors.householdId =
      '使用中・予約済の区画には契約世帯の選択が必要です。';
  }

  let areaId: string | null = null;
  if (values.areaId.length > 0) {
    if (isValidUuid(values.areaId)) {
      areaId = values.areaId;
    } else {
      errors.areaId = 'エリアの選択が不正です。';
    }
  }

  let contractDate: Date | null = null;
  if (values.contractDate.length > 0) {
    contractDate = parseIsoDate(values.contractDate);
    if (contractDate === null) {
      errors.contractDate = '日付の形式が正しくありません。';
    }
  }

  if (values.contractPlan.length > 60) {
    errors.contractPlan = '60 文字以内でご入力ください。';
  }

  return {
    errors,
    plotType,
    status: errors.status ? null : status,
    householdId,
    areaId,
    contractDate,
  };
}

function buildDataFromValues(
  values: GravePlotValues,
  v: ReturnType<typeof validate>,
) {
  return {
    plotNumber: values.plotNumber,
    plotType: v.plotType!,
    status: v.status!,
    householdId: v.householdId,
    areaId: v.areaId,
    contractDate: v.contractDate,
    contractPlan: nullIfBlank(values.contractPlan),
    memo: nullIfBlank(values.memo),
  };
}

/**
 * 区画の新規登録。
 * plotNumber はテナント内で一意制約あり。重複時は errors.plotNumber で返す。
 */
export async function createGravePlotAction(
  _prev: GravePlotFormState,
  formData: FormData,
): Promise<GravePlotFormState> {
  const values = extractValues(formData);
  const v = validate(values);
  if (Object.keys(v.errors).length > 0 || v.plotType === null) {
    return { status: 'error', errors: v.errors, values };
  }

  const tenantId = await requireCurrentTenantId();

  let created: { id: string };
  try {
    created = await withTenant(tenantId, (tx) =>
      tx.gravePlot.create({
        data: { tenantId, ...buildDataFromValues(values, v) },
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
        errors: { plotNumber: 'この区画番号は既に登録されています。' },
        values,
      };
    }
    throw err;
  }

  revalidatePath('/kukaku');
  revalidatePath('/kukaku/map');
  if (v.householdId) {
    revalidatePath(`/danshintoto/${v.householdId}`);
  }
  redirect(`/kukaku/${created.id}`);
}

/**
 * 区画の編集。
 */
export async function updateGravePlotAction(
  _prev: GravePlotFormState,
  formData: FormData,
): Promise<GravePlotFormState> {
  const id = readField(formData, 'gravePlotId');
  if (id.length === 0) {
    return { status: 'error', errors: {}, values: extractValues(formData) };
  }
  assertValidUuid(id, 'gravePlotId');

  const values = extractValues(formData);
  const v = validate(values);
  if (Object.keys(v.errors).length > 0 || v.plotType === null) {
    return { status: 'error', errors: v.errors, values };
  }

  const tenantId = await requireCurrentTenantId();

  let prevHouseholdId: string | null;
  try {
    prevHouseholdId = await withTenant(tenantId, async (tx) => {
      const existing = await tx.gravePlot.findUnique({
        where: { id },
        select: { householdId: true, areaId: true },
      });
      if (!existing) {
        throw new Error('対象の区画が見つかりませんでした。');
      }

      // エリアが変わった場合は positionX/Y をリセット (新エリアでドラッグ配置し直してもらう)
      const areaChanged = existing.areaId !== v.areaId;
      const data = buildDataFromValues(values, v);
      const updatePayload = areaChanged
        ? { ...data, positionX: null, positionY: null }
        : data;

      await tx.gravePlot.update({
        where: { id },
        data: updatePayload,
      });
      return existing.householdId;
    });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2002'
    ) {
      return {
        status: 'error',
        errors: { plotNumber: 'この区画番号は既に登録されています。' },
        values,
      };
    }
    throw err;
  }

  revalidatePath('/kukaku');
  revalidatePath('/kukaku/map');
  revalidatePath(`/kukaku/${id}`);
  if (prevHouseholdId) revalidatePath(`/danshintoto/${prevHouseholdId}`);
  if (v.householdId && v.householdId !== prevHouseholdId) {
    revalidatePath(`/danshintoto/${v.householdId}`);
  }
  redirect(`/kukaku/${id}`);
}
