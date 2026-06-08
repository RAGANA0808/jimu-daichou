import 'server-only';
import type { GravePlot, GravePlotArea, Household } from '@prisma/client';
import { requireCurrentTenantId } from '@/lib/auth';
import { assertValidUuid, withTenant } from '@/lib/db';

export type MapPlot = Pick<
  GravePlot,
  | 'id'
  | 'plotNumber'
  | 'plotType'
  | 'status'
  | 'areaId'
  | 'positionX'
  | 'positionY'
  | 'monumentName'
> & {
  household: Pick<Household, 'id' | 'householderName'> | null;
};

export type MapAreaData = {
  area: GravePlotArea;
  placed: MapPlot[];   // 配置済み (positionX/Y 両方セット)
  palette: MapPlot[];  // 当該エリアに属するが未配置 (positionX/Y どちらかが NULL)
};

/**
 * 地図ページ用。指定エリア配下の区画を palette / placed に分類して返す。
 */
export async function getMapAreaData(
  areaId: string,
): Promise<MapAreaData | null> {
  assertValidUuid(areaId, 'gravePlotAreaId');
  const tenantId = await requireCurrentTenantId();

  return withTenant(tenantId, async (tx) => {
    const area = await tx.gravePlotArea.findUnique({ where: { id: areaId } });
    if (!area) return null;

    const plots = await tx.gravePlot.findMany({
      where: { areaId },
      select: {
        id: true,
        plotNumber: true,
        plotType: true,
        status: true,
        areaId: true,
        positionX: true,
        positionY: true,
        monumentName: true,
        household: { select: { id: true, householderName: true } },
      },
      orderBy: { plotNumber: 'asc' },
    });

    const placed: MapPlot[] = [];
    const palette: MapPlot[] = [];
    for (const p of plots) {
      if (p.positionX !== null && p.positionY !== null) {
        placed.push(p);
      } else {
        palette.push(p);
      }
    }
    return { area, placed, palette };
  });
}
