'use server';

import { Prisma } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireCapability } from '@/lib/auth';
import { assertValidUuid, withTenant } from '@/lib/db';
import type {
  GravePlotAreaFieldName,
  GravePlotAreaFormState,
} from './types';
import {
  GRAVE_PLOT_AREA_CANVAS_MAX,
  GRAVE_PLOT_AREA_CANVAS_MIN,
} from './types';

function readField(formData: FormData, name: string): string {
  const v = formData.get(name);
  return typeof v === 'string' ? v.trim() : '';
}

type AreaValues = Record<GravePlotAreaFieldName, string>;

function extractValues(formData: FormData): AreaValues {
  return {
    name: readField(formData, 'name'),
    sortOrder: readField(formData, 'sortOrder'),
    canvasWidth: readField(formData, 'canvasWidth'),
    canvasHeight: readField(formData, 'canvasHeight'),
  };
}

function parseInt0(raw: string): number | null {
  if (raw.length === 0) return null;
  if (!/^-?\d+$/.test(raw)) return null;
  const n = Number.parseInt(raw, 10);
  return Number.isNaN(n) ? null : n;
}

function validate(values: AreaValues): {
  errors: NonNullable<GravePlotAreaFormState['errors']>;
  name: string;
  sortOrder: number;
  canvasWidth: number;
  canvasHeight: number;
} {
  const errors: NonNullable<GravePlotAreaFormState['errors']> = {};

  if (values.name.length === 0) {
    errors.name = 'エリア名をご入力ください。';
  } else if (values.name.length > 40) {
    errors.name = '40 文字以内でご入力ください。';
  }

  let sortOrder = 0;
  if (values.sortOrder.length > 0) {
    const n = parseInt0(values.sortOrder);
    if (n === null || n < 0 || n > 999) {
      errors.sortOrder = '0〜999 の整数でご入力ください。';
    } else {
      sortOrder = n;
    }
  }

  let canvasWidth = 1200;
  if (values.canvasWidth.length > 0) {
    const n = parseInt0(values.canvasWidth);
    if (
      n === null ||
      n < GRAVE_PLOT_AREA_CANVAS_MIN ||
      n > GRAVE_PLOT_AREA_CANVAS_MAX
    ) {
      errors.canvasWidth = `${GRAVE_PLOT_AREA_CANVAS_MIN}〜${GRAVE_PLOT_AREA_CANVAS_MAX} の整数でご入力ください。`;
    } else {
      canvasWidth = n;
    }
  }

  let canvasHeight = 800;
  if (values.canvasHeight.length > 0) {
    const n = parseInt0(values.canvasHeight);
    if (
      n === null ||
      n < GRAVE_PLOT_AREA_CANVAS_MIN ||
      n > GRAVE_PLOT_AREA_CANVAS_MAX
    ) {
      errors.canvasHeight = `${GRAVE_PLOT_AREA_CANVAS_MIN}〜${GRAVE_PLOT_AREA_CANVAS_MAX} の整数でご入力ください。`;
    } else {
      canvasHeight = n;
    }
  }

  return {
    errors,
    name: values.name,
    sortOrder,
    canvasWidth,
    canvasHeight,
  };
}

export async function createGravePlotAreaAction(
  _prev: GravePlotAreaFormState,
  formData: FormData,
): Promise<GravePlotAreaFormState> {
  const values = extractValues(formData);
  const v = validate(values);
  if (Object.keys(v.errors).length > 0) {
    return { status: 'error', errors: v.errors, values };
  }

  const tenantId = (await requireCapability('create')).tenantId;

  try {
    await withTenant(tenantId, (tx) =>
      tx.gravePlotArea.create({
        data: {
          tenantId,
          name: v.name,
          sortOrder: v.sortOrder,
          canvasWidth: v.canvasWidth,
          canvasHeight: v.canvasHeight,
        },
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
        errors: { name: 'この名前のエリアは既に登録されています。' },
        values,
      };
    }
    throw err;
  }

  revalidatePath('/kukaku/areas');
  revalidatePath('/kukaku/map');
  revalidatePath('/kukaku');
  redirect('/kukaku/areas');
}

export async function updateGravePlotAreaAction(
  _prev: GravePlotAreaFormState,
  formData: FormData,
): Promise<GravePlotAreaFormState> {
  const id = readField(formData, 'gravePlotAreaId');
  if (id.length === 0) {
    return { status: 'error', errors: {}, values: extractValues(formData) };
  }
  assertValidUuid(id, 'gravePlotAreaId');

  const values = extractValues(formData);
  const v = validate(values);
  if (Object.keys(v.errors).length > 0) {
    return { status: 'error', errors: v.errors, values };
  }

  const tenantId = (await requireCapability('update')).tenantId;

  try {
    await withTenant(tenantId, async (tx) => {
      const existing = await tx.gravePlotArea.findUnique({
        where: { id },
        select: { id: true },
      });
      if (!existing) {
        throw new Error('対象のエリアが見つかりませんでした。');
      }
      await tx.gravePlotArea.update({
        where: { id },
        data: {
          name: v.name,
          sortOrder: v.sortOrder,
          canvasWidth: v.canvasWidth,
          canvasHeight: v.canvasHeight,
        },
      });
    });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2002'
    ) {
      return {
        status: 'error',
        errors: { name: 'この名前のエリアは既に登録されています。' },
        values,
      };
    }
    throw err;
  }

  revalidatePath('/kukaku/areas');
  revalidatePath('/kukaku/map');
  revalidatePath('/kukaku');
  redirect('/kukaku/areas');
}

/**
 * エリア削除。
 * - 配下区画は FK の ON DELETE SET NULL で areaId が自動的に NULL 化されるが、
 *   positionX/Y は DB では自動削除されないため、先に明示的に NULL 化する
 *   (未配置パレットに戻す挙動と一致させるため)。
 */
export async function deleteGravePlotAreaAction(
  formData: FormData,
): Promise<void> {
  const id = readField(formData, 'gravePlotAreaId');
  if (id.length === 0) return;
  assertValidUuid(id, 'gravePlotAreaId');

  const tenantId = (await requireCapability('softDelete')).tenantId;

  await withTenant(tenantId, async (tx) => {
    await tx.gravePlot.updateMany({
      where: { areaId: id },
      data: { areaId: null, positionX: null, positionY: null },
    });
    await tx.gravePlotArea.delete({ where: { id } });
  });

  revalidatePath('/kukaku/areas');
  revalidatePath('/kukaku/map');
  revalidatePath('/kukaku');
  redirect('/kukaku/areas');
}
