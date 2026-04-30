'use server';

import { revalidatePath } from 'next/cache';
import { requireCurrentTenantId } from '@/lib/auth';
import { assertValidUuid, withTenant } from '@/lib/db';
import { normalizePosition } from './grid';

export type PlacementResult =
  | { status: 'ok' }
  | { status: 'error'; message: string };

/**
 * 区画のキャンバス配置を更新する (ドラッグ終了時に client から直接呼ぶ軽量 action)。
 * - エリアの canvas サイズ内に収まるようサーバー側でも再 clamp + snap する
 *   (クライアント改ざん対策)
 */
export async function updateGravePlotPlacementAction(input: {
  gravePlotId: string;
  areaId: string;
  positionX: number;
  positionY: number;
}): Promise<PlacementResult> {
  const { gravePlotId, areaId } = input;

  if (typeof gravePlotId !== 'string' || typeof areaId !== 'string') {
    return { status: 'error', message: '不正なリクエストです。' };
  }
  assertValidUuid(gravePlotId, 'gravePlotId');
  assertValidUuid(areaId, 'gravePlotAreaId');

  if (
    !Number.isInteger(input.positionX) ||
    !Number.isInteger(input.positionY)
  ) {
    return { status: 'error', message: '座標が整数ではありません。' };
  }

  const tenantId = await requireCurrentTenantId();

  try {
    await withTenant(tenantId, async (tx) => {
      const area = await tx.gravePlotArea.findUnique({
        where: { id: areaId },
        select: { canvasWidth: true, canvasHeight: true },
      });
      if (!area) {
        throw new Error('エリアが見つかりませんでした。');
      }
      const plot = await tx.gravePlot.findUnique({
        where: { id: gravePlotId },
        select: { id: true },
      });
      if (!plot) {
        throw new Error('区画が見つかりませんでした。');
      }

      const { x, y } = normalizePosition(
        input.positionX,
        input.positionY,
        area.canvasWidth,
        area.canvasHeight,
      );

      await tx.gravePlot.update({
        where: { id: gravePlotId },
        data: { areaId, positionX: x, positionY: y },
      });
    });
  } catch (err) {
    return {
      status: 'error',
      message: err instanceof Error ? err.message : '保存に失敗しました。',
    };
  }

  revalidatePath('/kukaku/map');
  revalidatePath('/kukaku');
  revalidatePath(`/kukaku/${gravePlotId}`);
  return { status: 'ok' };
}

/**
 * 区画をキャンバスから未配置 (パレット) に戻す。
 * areaId は保持し positionX/Y のみ NULL 化する設計も考えられるが、
 * 「未配置 = areaId === null OR (positionX === null AND positionY === null)」の
 * ルールを単純化するため、ここでは areaId は保持し positionX/Y のみクリアする。
 */
export async function unplaceGravePlotAction(input: {
  gravePlotId: string;
}): Promise<PlacementResult> {
  const { gravePlotId } = input;
  if (typeof gravePlotId !== 'string') {
    return { status: 'error', message: '不正なリクエストです。' };
  }
  assertValidUuid(gravePlotId, 'gravePlotId');

  const tenantId = await requireCurrentTenantId();

  try {
    await withTenant(tenantId, async (tx) => {
      const existing = await tx.gravePlot.findUnique({
        where: { id: gravePlotId },
        select: { id: true },
      });
      if (!existing) {
        throw new Error('区画が見つかりませんでした。');
      }
      await tx.gravePlot.update({
        where: { id: gravePlotId },
        data: { positionX: null, positionY: null },
      });
    });
  } catch (err) {
    return {
      status: 'error',
      message: err instanceof Error ? err.message : '保存に失敗しました。',
    };
  }

  revalidatePath('/kukaku/map');
  revalidatePath('/kukaku');
  revalidatePath(`/kukaku/${gravePlotId}`);
  return { status: 'ok' };
}
